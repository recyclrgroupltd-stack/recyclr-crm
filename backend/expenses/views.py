import json
import re
from io import BytesIO
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.db.models import Q, Sum
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts_api.models import CompanyDetails
from accounts_api.views import require_permission, user_has_permission
from purchase_orders.models import StaffNotification

from .models import ExpenseCategory, ExpenseClaim, ExpenseLine

User = get_user_model()


DEFAULT_CATEGORIES = [
    "Mileage",
    "Parking",
    "Tools",
    "Uniform",
    "Materials",
    "Accommodation",
    "Meals",
    "Training",
    "Other",
]


def _clean(value):
    return str(value or "").strip()


def _decimal(value, default="0.00"):
    if value in (None, ""):
        return Decimal(default)
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _date(value, default=None):
    if isinstance(value, date):
        return value
    value = _clean(value)
    if not value:
        return default or timezone.localdate()
    for pattern in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, pattern).date()
        except ValueError:
            pass
    return default or timezone.localdate()


def ensure_default_categories():
    ExpenseCategory.objects.filter(name__iexact="Fuel").update(active=False)
    for name in DEFAULT_CATEGORIES:
        ExpenseCategory.objects.get_or_create(name=name, defaults={"active": True, "requires_receipt": name != "Mileage"})


def _json_error_response(response):
    data = getattr(response, "data", None) or {"success": False, "message": "Permission denied."}
    return JsonResponse(data, status=getattr(response, "status_code", 403))


def _receipt_text(receipt_file):
    if not receipt_file:
        return "", "not_run", ""

    original_position = receipt_file.tell()
    try:
        receipt_file.seek(0)
        raw = receipt_file.read()
    finally:
        receipt_file.seek(original_position)

    if not raw:
        return "", "empty", "Receipt file was empty."

    if raw.startswith(b"%PDF"):
        try:
            from pypdf import PdfReader

            reader = PdfReader(BytesIO(raw))
            pages = []
            for page in reader.pages[:10]:
                pages.append(page.extract_text() or "")
            readable = _clean_extracted_receipt_text("\n".join(pages))
            if readable:
                return readable[:20000], "extracted", "Text was read from the uploaded PDF receipt."
            return "", "stored_only", "Receipt PDF saved, but no readable text was found."
        except Exception:
            return "", "stored_only", "Receipt PDF saved. Text extraction is not available, so please check the fields manually."

    try:
        text = raw.decode("utf-8", errors="ignore")
        readable = _clean_extracted_receipt_text(text)
        if readable:
            return readable[:20000], "extracted", "Text was read from the uploaded file."
    except Exception:
        pass

    try:
        from PIL import Image
        import pytesseract

        receipt_file.seek(0)
        image = Image.open(receipt_file)
        text = pytesseract.image_to_string(image)
        if text.strip():
            return text[:20000], "extracted", "OCR text was read from the receipt image."
    except Exception:
        return "", "stored_only", "Receipt saved. OCR is not available locally, so please check the fields manually."

    return "", "stored_only", "Receipt saved, but no readable text was found."


def _clean_extracted_receipt_text(text):
    readable = "".join(char for char in str(text or "") if char.isprintable() or char in "\n\r\t")
    lines = [line.strip() for line in readable.splitlines() if line.strip()]
    if not lines:
        return ""

    pdf_noise_markers = (
        "%PDF",
        "ReportLab Generated PDF document",
        "obj",
        "endobj",
        "/BaseFont",
        "/Subtype /Type",
        "/Filter [ /ASCII85Decode /FlateDecode ]",
        "xref",
        "trailer",
        "startxref",
    )
    noise_hits = sum(1 for line in lines[:30] if any(marker in line for marker in pdf_noise_markers))
    if readable.lstrip().startswith("%PDF") or noise_hits >= 3:
        return ""

    clean_lines = [line for line in lines if not any(marker in line for marker in pdf_noise_markers)]
    cleaned = "\n".join(clean_lines).strip()
    if len(cleaned) < 30:
        return ""
    return cleaned


def _extract_receipt_fields(text):
    result = {
        "merchant": "",
        "expense_date": None,
        "amount": None,
    }
    if not text:
        return result

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines[:8]:
        if len(line) >= 3 and not re.search(r"\d{4,}", line):
            result["merchant"] = line[:255]
            break

    date_match = re.search(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\b", text)
    if date_match:
        result["expense_date"] = _date(date_match.group(1), default=None)

    candidates = []
    for match in re.finditer(r"(?:£|GBP)?\s*(\d{1,5}\.\d{2})", text, flags=re.IGNORECASE):
        try:
            candidates.append(Decimal(match.group(1)))
        except InvalidOperation:
            pass
    if candidates:
        result["amount"] = max(candidates).quantize(Decimal("0.01"))

    return result


def _vat_from_amount(amount, vat_rate):
    amount = _decimal(amount)
    vat_rate = _decimal(vat_rate)
    if amount <= 0 or vat_rate <= 0:
        return Decimal("0.00")
    return (amount * vat_rate / Decimal("100")).quantize(Decimal("0.01"))


def _parse_lines(raw_lines, default_category, vat_rate):
    try:
        lines = json.loads(raw_lines or "[]")
    except json.JSONDecodeError:
        lines = []

    parsed = []
    if not isinstance(lines, list):
        lines = []

    for line in lines:
        if not isinstance(line, dict):
            continue
        amount = _decimal(line.get("amount"))
        if amount <= 0:
            continue
        category = default_category
        category_id = line.get("category_id")
        if category_id:
            try:
                category = ExpenseCategory.objects.get(pk=category_id, active=True)
            except ExpenseCategory.DoesNotExist:
                category = default_category
        vat_amount = _decimal(line.get("vat_amount"))
        if vat_amount <= 0:
            vat_amount = _vat_from_amount(amount, vat_rate)
        parsed.append(
            {
                "category": category,
                "description": _clean(line.get("description")),
                "merchant": _clean(line.get("merchant")),
                "amount": amount.quantize(Decimal("0.01")),
                "vat_amount": vat_amount.quantize(Decimal("0.01")),
            }
        )
    return parsed


def _serialize_line(line):
    return {
        "id": line.id,
        "category_id": line.category_id,
        "category": line.category.name if line.category_id else "",
        "description": line.description,
        "merchant": line.merchant,
        "amount": float(line.amount or 0),
        "vat_amount": float(line.vat_amount or 0),
    }


def _get_admin_approvers():
    users = User.objects.filter(is_staff=True, is_active=True).prefetch_related("groups", "permission_overrides")
    approvers = [user for user in users if user_has_permission(user, "expenses.approve")]
    if approvers:
        return approvers
    return [user for user in users if user_has_permission(user, "staff.manage")]


def _notify_approvers(expense):
    submitter = expense.submitted_by.get_username()
    for approver in _get_admin_approvers():
        StaffNotification.objects.create(
            recipient=approver,
            notification_type=StaffNotification.TYPE_GENERAL,
            title=f"Expense approval needed: £{expense.amount}",
            message=f"{submitter} submitted a {expense.category.name} expense for approval.",
            target_url="/expenses",
            source_type="expense",
            source_id=expense.id,
        )


def _notify_submitter(expense, title, message):
    StaffNotification.objects.create(
        recipient=expense.submitted_by,
        notification_type=StaffNotification.TYPE_GENERAL,
        title=title,
        message=message,
        target_url="/expenses",
        source_type="expense",
        source_id=expense.id,
    )


def _serialize_category(category):
    return {
        "id": category.id,
        "name": category.name,
        "active": category.active,
        "requires_receipt": category.requires_receipt,
        "notes": category.notes,
    }


def _serialize_expense(expense):
    lines = list(getattr(expense, "lines", []).all()) if expense.id else []
    extracted_text = _clean_extracted_receipt_text(expense.extracted_text)
    return {
        "id": expense.id,
        "submitted_by_id": expense.submitted_by_id,
        "submitted_by": expense.submitted_by.get_username(),
        "category_id": expense.category_id,
        "category": expense.category.name,
        "expense_type": expense.expense_type,
        "expense_type_label": expense.get_expense_type_display(),
        "expense_date": expense.expense_date.isoformat() if expense.expense_date else "",
        "merchant": expense.merchant,
        "description": expense.description,
        "amount": float(expense.amount or 0),
        "vat_amount": float(expense.vat_amount or 0),
        "lines": [_serialize_line(line) for line in lines],
        "mileage": float(expense.mileage or 0),
        "mileage_rate": float(expense.mileage_rate or 0),
        "receipt_url": expense.receipt.url if expense.receipt else "",
        "receipt_original_name": expense.receipt_original_name,
        "extraction_status": expense.extraction_status,
        "extraction_message": expense.extraction_message,
        "extracted_text": extracted_text,
        "extracted_merchant": expense.extracted_merchant,
        "extracted_date": expense.extracted_date.isoformat() if expense.extracted_date else "",
        "extracted_amount": float(expense.extracted_amount) if expense.extracted_amount is not None else None,
        "status": expense.status,
        "status_label": expense.get_status_display(),
        "submitted_at": expense.submitted_at.isoformat() if expense.submitted_at else "",
        "approved_by": expense.approved_by.get_username() if expense.approved_by else "",
        "approved_at": expense.approved_at.isoformat() if expense.approved_at else "",
        "rejection_reason": expense.rejection_reason,
        "created_at": expense.created_at.isoformat() if expense.created_at else "",
        "updated_at": expense.updated_at.isoformat() if expense.updated_at else "",
    }


@csrf_exempt
def expenses_list(request):
    user, error_response = require_permission(request, "expenses.view", "You do not have permission to view expenses.")
    if error_response:
        return _json_error_response(error_response)

    ensure_default_categories()

    if request.method == "GET":
        status_value = _clean(request.GET.get("status") or "all")
        scope = _clean(request.GET.get("scope") or "mine")
        search = _clean(request.GET.get("search"))

        expenses = ExpenseClaim.objects.select_related("submitted_by", "category", "approved_by").all()
        if scope != "all" or not user_has_permission(user, "expenses.approve"):
            expenses = expenses.filter(submitted_by=user)
        if status_value != "all":
            expenses = expenses.filter(status=status_value)
        if search:
            expenses = expenses.filter(
                Q(merchant__icontains=search)
                | Q(description__icontains=search)
                | Q(category__name__icontains=search)
                | Q(submitted_by__username__icontains=search)
            )

        all_for_summary = ExpenseClaim.objects.all()
        if not user_has_permission(user, "expenses.approve"):
            all_for_summary = all_for_summary.filter(submitted_by=user)

        return JsonResponse(
            {
                "success": True,
                "expenses": [_serialize_expense(expense) for expense in expenses[:250]],
                "categories": [_serialize_category(category) for category in ExpenseCategory.objects.all()],
                "mileage_rate": float(CompanyDetails.get_solo().mileage_rate or 0),
                "vat_rate": float(CompanyDetails.get_solo().vat_rate or 0),
                "can_approve": user_has_permission(user, "expenses.approve"),
                "summary": {
                    "pending_count": all_for_summary.filter(status=ExpenseClaim.STATUS_SUBMITTED).count(),
                    "approved_this_month": float(
                        all_for_summary.filter(
                            status=ExpenseClaim.STATUS_APPROVED,
                            approved_at__date__gte=timezone.localdate().replace(day=1),
                        ).aggregate(total=Sum("amount"))["total"]
                        or 0
                    ),
                    "mine_pending": ExpenseClaim.objects.filter(
                        submitted_by=user,
                        status=ExpenseClaim.STATUS_SUBMITTED,
                    ).count(),
                },
            }
        )

    if request.method == "POST":
        category_id = request.POST.get("category_id")
        category = get_object_or_404(ExpenseCategory, pk=category_id, active=True)
        receipt = request.FILES.get("receipt")
        receipt_text, extraction_status, extraction_message = _receipt_text(receipt) if receipt else ("", "not_run", "")
        extracted = _extract_receipt_fields(receipt_text)

        expense_type = _clean(request.POST.get("expense_type") or ExpenseClaim.TYPE_GENERAL)
        company_details = CompanyDetails.get_solo()
        mileage_rate = _decimal(request.POST.get("mileage_rate"), company_details.mileage_rate)
        vat_rate = _decimal(request.POST.get("vat_rate"), company_details.vat_rate)
        mileage = _decimal(request.POST.get("mileage"))
        amount = _decimal(request.POST.get("amount"))
        line_items = _parse_lines(request.POST.get("lines"), category, vat_rate)

        if expense_type == ExpenseClaim.TYPE_MILEAGE:
            amount = (mileage * mileage_rate).quantize(Decimal("0.01"))
            vat_amount = Decimal("0.00")
        elif line_items:
            amount = sum((line["amount"] for line in line_items), Decimal("0.00")).quantize(Decimal("0.01"))
            vat_amount = sum((line["vat_amount"] for line in line_items), Decimal("0.00")).quantize(Decimal("0.01"))
        elif amount <= 0 and extracted["amount"]:
            amount = extracted["amount"]
            vat_amount = _vat_from_amount(amount, vat_rate)
            line_items = [
                {
                    "category": category,
                    "description": "Receipt total",
                    "merchant": _clean(request.POST.get("merchant")) or extracted["merchant"],
                    "amount": amount,
                    "vat_amount": vat_amount,
                }
            ]
        else:
            vat_amount = _decimal(request.POST.get("vat_amount"))
            if vat_amount <= 0:
                vat_amount = _vat_from_amount(amount, vat_rate)

        expense = ExpenseClaim.objects.create(
            submitted_by=user,
            category=category,
            expense_type=expense_type,
            expense_date=_date(request.POST.get("expense_date"), extracted["expense_date"] or timezone.localdate()),
            merchant=_clean(request.POST.get("merchant")) or extracted["merchant"],
            description=_clean(request.POST.get("description")),
            amount=amount,
            vat_amount=vat_amount,
            mileage=mileage,
            mileage_rate=mileage_rate,
            receipt=receipt,
            receipt_original_name=receipt.name if receipt else "",
            extracted_text=receipt_text,
            extracted_merchant=extracted["merchant"],
            extracted_date=extracted["expense_date"],
            extracted_amount=extracted["amount"],
            extraction_status=extraction_status,
            extraction_message=extraction_message,
            status=ExpenseClaim.STATUS_SUBMITTED,
        )
        for line in line_items:
            ExpenseLine.objects.create(claim=expense, **line)
        _notify_approvers(expense)
        return JsonResponse({"success": True, "message": "Expense submitted for approval.", "expense": _serialize_expense(expense)})

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def expense_detail(request, expense_id):
    user, error_response = require_permission(request, "expenses.view", "You do not have permission to view expenses.")
    if error_response:
        return _json_error_response(error_response)

    expense = get_object_or_404(ExpenseClaim.objects.select_related("submitted_by", "category", "approved_by"), pk=expense_id)
    if expense.submitted_by_id != user.id and not user_has_permission(user, "expenses.approve"):
        return JsonResponse({"success": False, "message": "You cannot view this expense."}, status=403)

    if request.method == "GET":
        return JsonResponse({"success": True, "expense": _serialize_expense(expense)})

    if request.method in {"POST", "PATCH"}:
        if expense.submitted_by_id != user.id or expense.status != ExpenseClaim.STATUS_SUBMITTED:
            return JsonResponse({"success": False, "message": "Only submitted expenses can be edited by the submitter."}, status=400)
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)
        expense.expense_date = _date(payload.get("expense_date"), expense.expense_date)
        expense.merchant = _clean(payload.get("merchant")) or expense.merchant
        expense.description = _clean(payload.get("description"))
        expense.amount = _decimal(payload.get("amount"), expense.amount)
        expense.vat_amount = _decimal(payload.get("vat_amount"), expense.vat_amount)
        expense.save()
        return JsonResponse({"success": True, "message": "Expense updated.", "expense": _serialize_expense(expense)})

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def expense_approve(request, expense_id):
    approver, error_response = require_permission(request, "expenses.approve", "You do not have permission to approve expenses.")
    if error_response:
        return _json_error_response(error_response)
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    expense = get_object_or_404(ExpenseClaim, pk=expense_id)
    expense.status = ExpenseClaim.STATUS_APPROVED
    expense.approved_by = approver
    expense.approved_at = timezone.now()
    expense.rejection_reason = ""
    expense.save(update_fields=["status", "approved_by", "approved_at", "rejection_reason", "updated_at"])
    _notify_submitter(expense, "Expense approved", f"Your {expense.category.name} expense for £{expense.amount} was approved.")
    return JsonResponse({"success": True, "message": "Expense approved.", "expense": _serialize_expense(expense)})


@csrf_exempt
def expense_reject(request, expense_id):
    approver, error_response = require_permission(request, "expenses.approve", "You do not have permission to reject expenses.")
    if error_response:
        return _json_error_response(error_response)
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        payload = {}

    expense = get_object_or_404(ExpenseClaim, pk=expense_id)
    reason = _clean(payload.get("reason"))
    expense.status = ExpenseClaim.STATUS_REJECTED
    expense.approved_by = approver
    expense.approved_at = timezone.now()
    expense.rejection_reason = reason
    expense.save(update_fields=["status", "approved_by", "approved_at", "rejection_reason", "updated_at"])
    _notify_submitter(
        expense,
        "Expense rejected",
        f"Your {expense.category.name} expense for £{expense.amount} was rejected. {reason}".strip(),
    )
    return JsonResponse({"success": True, "message": "Expense rejected.", "expense": _serialize_expense(expense)})


@csrf_exempt
def categories_list(request):
    user, error_response = require_permission(request, "expenses.view", "You do not have permission to view expense categories.")
    if error_response:
        return _json_error_response(error_response)

    ensure_default_categories()

    if request.method == "GET":
        return JsonResponse({"success": True, "categories": [_serialize_category(category) for category in ExpenseCategory.objects.all()]})

    if request.method == "POST":
        if not user_has_permission(user, "expenses.approve"):
            return JsonResponse({"success": False, "message": "Only expense approvers can manage categories."}, status=403)
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)
        name = _clean(payload.get("name"))
        if not name:
            return JsonResponse({"success": False, "message": "Category name is required."}, status=400)
        category, created = ExpenseCategory.objects.get_or_create(
            name=name,
            defaults={
                "active": bool(payload.get("active", True)),
                "requires_receipt": bool(payload.get("requires_receipt", True)),
                "notes": _clean(payload.get("notes")),
            },
        )
        if not created:
            return JsonResponse({"success": False, "message": "That category already exists."}, status=400)
        return JsonResponse({"success": True, "message": "Expense category created.", "category": _serialize_category(category)})

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def category_detail(request, category_id):
    user, error_response = require_permission(request, "expenses.approve", "Only expense approvers can manage categories.")
    if error_response:
        return _json_error_response(error_response)
    category = get_object_or_404(ExpenseCategory, pk=category_id)

    if request.method in {"POST", "PATCH"}:
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)
        category.name = _clean(payload.get("name")) or category.name
        category.active = bool(payload.get("active", category.active))
        category.requires_receipt = bool(payload.get("requires_receipt", category.requires_receipt))
        category.notes = _clean(payload.get("notes"))
        category.save()
        return JsonResponse({"success": True, "message": "Expense category updated.", "category": _serialize_category(category)})

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)
