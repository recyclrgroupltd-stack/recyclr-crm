import json
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts_api.views import get_request_user_from_username, require_permission, user_has_permission

from .models import PurchaseOrder, PurchaseOrderLine, StaffNotification, Supplier

User = get_user_model()


def _bool_value(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ["true", "1", "yes", "on"]
    return bool(value)


def _money(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _decimal(value, default="0.00"):
    if value in (None, ""):
        return Decimal(default)

    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _clean_text(value):
    return (value or "").strip()


def _get_acting_user(request):
    username = request.headers.get("X-Staff-Username", "").strip()
    return get_request_user_from_username(username)


def _is_admin_approver(user):
    return user_has_permission(user, "purchase_orders.approve")


def _get_admin_approvers():
    users = User.objects.filter(is_staff=True).prefetch_related("groups", "permission_overrides").order_by("username")
    return [user for user in users if user_has_permission(user, "purchase_orders.approve")]


def _require_po_view_access(request):
    return require_permission(request, "purchase_orders.view", "You do not have permission to view purchase orders.")


def _require_po_edit_access(request):
    return require_permission(request, "purchase_orders.edit", "You do not have permission to edit purchase orders.")


def _require_po_approve_access(request):
    return require_permission(request, "purchase_orders.approve", "You do not have permission to approve purchase orders.")


def _create_notification(recipient, title, message="", notification_type=StaffNotification.TYPE_GENERAL, purchase_order=None):
    StaffNotification.objects.create(
        recipient=recipient,
        title=title,
        message=message,
        notification_type=notification_type,
        purchase_order=purchase_order,
    )


def _notify_admins_po_pending(order):
    for admin_user in _get_admin_approvers():
        _create_notification(
            recipient=admin_user,
            title=f"PO approval needed: {order.po_number}",
            message=f"{order.requested_by or 'A staff member'} submitted {order.po_number} for approval.",
            notification_type=StaffNotification.TYPE_PO_APPROVAL,
            purchase_order=order,
        )


def _notify_requester_po_decision(order, decision):
    if not order.requested_by:
        return

    recipient = get_request_user_from_username(order.requested_by)
    if not recipient:
        return

    decision_label = "approved" if decision == "approved" else "rejected"

    _create_notification(
        recipient=recipient,
        title=f"PO {decision_label}: {order.po_number}",
        message=f"{order.po_number} has been {decision_label} by {order.approved_by or 'an administrator'}.",
        notification_type=StaffNotification.TYPE_PO_DECISION,
        purchase_order=order,
    )


def _serialize_supplier(supplier):
    return {
        "id": supplier.id,
        "name": supplier.name,
        "contact_name": supplier.contact_name,
        "email": supplier.email,
        "phone": supplier.phone,
        "notes": supplier.notes,
        "active": supplier.active,
        "created_at": supplier.created_at.isoformat() if supplier.created_at else "",
        "purchase_order_count": getattr(supplier, "purchase_order_count", supplier.purchase_orders.count()),
    }


def _serialize_line(line):
    return {
        "id": line.id,
        "description": line.description,
        "quantity": float(line.quantity or 0),
        "unit_cost": _money(line.unit_cost),
        "line_total": _money(line.line_total),
        "line_order": line.line_order,
    }


def _serialize_purchase_order(order):
    lines = [_serialize_line(line) for line in order.lines.all()]
    subtotal = sum((Decimal(str(line["line_total"])) for line in lines), Decimal("0.00"))
    vat_amount = (subtotal * Decimal("0.20")).quantize(Decimal("0.01"))
    total_inc_vat = (subtotal + vat_amount).quantize(Decimal("0.01"))

    return {
        "id": order.id,
        "po_number": order.po_number,
        "supplier_id": order.supplier.id,
        "supplier_name": order.supplier.name,
        "order_date": order.order_date.isoformat() if order.order_date else "",
        "requested_by": order.requested_by,
        "status": order.status,
        "status_label": order.get_status_display(),
        "notes": order.notes,
        "approval_note": order.approval_note,
        "approved_by": order.approved_by,
        "approved_at": order.approved_at.isoformat() if order.approved_at else "",
        "received_by": order.received_by,
        "received_at": order.received_at.isoformat() if order.received_at else "",
        "received_note": order.received_note,
        "supplier_reference": order.supplier_reference,
        "received_proof_url": order.received_proof.url if order.received_proof else "",
        "line_count": len(lines),
        "subtotal": float(subtotal.quantize(Decimal("0.01"))),
        "vat_amount": float(vat_amount),
        "total_inc_vat": float(total_inc_vat),
        "total": float(subtotal.quantize(Decimal("0.01"))),
        "created_at": order.created_at.isoformat() if order.created_at else "",
        "updated_at": order.updated_at.isoformat() if order.updated_at else "",
        "lines": lines,
    }


def _serialize_notification(notification):
    return {
        "id": notification.id,
        "notification_type": notification.notification_type,
        "title": notification.title,
        "message": notification.message,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat() if notification.created_at else "",
        "purchase_order_id": notification.purchase_order_id,
        "purchase_order_number": notification.purchase_order.po_number if notification.purchase_order else "",
        "target_url": notification.target_url,
        "source_type": notification.source_type,
        "source_id": notification.source_id,
    }


def _build_lines(lines_payload):
    built = []

    for index, raw_line in enumerate(lines_payload or []):
        description = _clean_text(raw_line.get("description"))
        quantity = _decimal(raw_line.get("quantity"), "0.00")
        unit_cost = _decimal(raw_line.get("unit_cost"), "0.00")

        if not description:
            continue

        if quantity <= 0:
            raise ValueError(f"Line {index + 1}: quantity must be greater than 0.")

        if unit_cost < 0:
            raise ValueError(f"Line {index + 1}: unit cost cannot be negative.")

        built.append(
            {
                "description": description,
                "quantity": quantity.quantize(Decimal("0.01")),
                "unit_cost": unit_cost.quantize(Decimal("0.01")),
                "line_order": index,
            }
        )

    if not built:
        raise ValueError("At least one valid line item is required.")

    return built


def _save_lines(order, lines_data):
    order.lines.all().delete()

    for line in lines_data:
        PurchaseOrderLine.objects.create(
            purchase_order=order,
            description=line["description"],
            quantity=line["quantity"],
            unit_cost=line["unit_cost"],
            line_order=line["line_order"],
        )


@csrf_exempt
def suppliers_list(request):
    if request.method == "GET":
        _, error_response = _require_po_view_access(request)
        if error_response:
            return error_response

        suppliers = (
            Supplier.objects.all()
            .annotate(purchase_order_count=Count("purchase_orders"))
            .order_by("name")
        )
        return JsonResponse([_serialize_supplier(supplier) for supplier in suppliers], safe=False)

    if request.method == "POST":
        _, error_response = _require_po_edit_access(request)
        if error_response:
            return error_response

        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        name = _clean_text(payload.get("name"))

        if not name:
            return JsonResponse({"success": False, "message": "Supplier name is required."}, status=400)

        if Supplier.objects.filter(name__iexact=name).exists():
            return JsonResponse({"success": False, "message": "A supplier with that name already exists."}, status=400)

        supplier = Supplier.objects.create(
            name=name,
            contact_name=_clean_text(payload.get("contact_name")),
            email=_clean_text(payload.get("email")),
            phone=_clean_text(payload.get("phone")),
            notes=_clean_text(payload.get("notes")),
            active=_bool_value(payload.get("active", True)),
        )

        return JsonResponse(
            {
                "success": True,
                "message": "Supplier created successfully.",
                "supplier": _serialize_supplier(supplier),
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def supplier_detail(request, supplier_id):
    supplier = get_object_or_404(Supplier, pk=supplier_id)

    if request.method == "GET":
        _, error_response = _require_po_view_access(request)
        if error_response:
            return error_response

        return JsonResponse(_serialize_supplier(supplier))

    if request.method == "POST":
        _, error_response = _require_po_edit_access(request)
        if error_response:
            return error_response

        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        name = _clean_text(payload.get("name"))

        if not name:
            return JsonResponse({"success": False, "message": "Supplier name is required."}, status=400)

        if Supplier.objects.exclude(pk=supplier.id).filter(name__iexact=name).exists():
            return JsonResponse({"success": False, "message": "A supplier with that name already exists."}, status=400)

        supplier.name = name
        supplier.contact_name = _clean_text(payload.get("contact_name"))
        supplier.email = _clean_text(payload.get("email"))
        supplier.phone = _clean_text(payload.get("phone"))
        supplier.notes = _clean_text(payload.get("notes"))
        supplier.active = _bool_value(payload.get("active", True))
        supplier.save()

        return JsonResponse(
            {
                "success": True,
                "message": "Supplier updated successfully.",
                "supplier": _serialize_supplier(supplier),
            }
        )

    if request.method == "DELETE":
        _, error_response = _require_po_edit_access(request)
        if error_response:
            return error_response

        if supplier.purchase_orders.exists():
            return JsonResponse(
                {
                    "success": False,
                    "message": "This supplier cannot be deleted because it already has purchase orders."
                },
                status=400,
            )

        supplier.delete()
        return JsonResponse({"success": True, "message": "Supplier deleted successfully."})

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def notifications_list(request):
    acting_user = _get_acting_user(request)
    if not acting_user:
        return JsonResponse({"success": False, "message": "Please sign in again."}, status=401)

    notifications = StaffNotification.objects.filter(recipient=acting_user).select_related("purchase_order")
    unread_count = notifications.filter(is_read=False).count()
    latest = notifications.order_by("is_read", "-created_at")[:20]

    return JsonResponse(
        {
            "success": True,
            "unread_count": unread_count,
            "notifications": [_serialize_notification(item) for item in latest],
        }
    )


@csrf_exempt
def notifications_mark_all_read(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    acting_user = _get_acting_user(request)
    if not acting_user:
        return JsonResponse({"success": False, "message": "Please sign in again."}, status=401)

    StaffNotification.objects.filter(recipient=acting_user, is_read=False).update(is_read=True)

    return JsonResponse({"success": True, "message": "All notifications marked as read."})


@csrf_exempt
def notification_detail(request, notification_id):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    acting_user = _get_acting_user(request)
    if not acting_user:
        return JsonResponse({"success": False, "message": "Please sign in again."}, status=401)

    notification = get_object_or_404(StaffNotification, pk=notification_id, recipient=acting_user)
    notification.is_read = True
    notification.save(update_fields=["is_read"])

    return JsonResponse({"success": True, "message": "Notification marked as read."})


@csrf_exempt
def purchase_orders_list(request):
    acting_user, error_response = _require_po_view_access(request)
    if error_response:
        return error_response

    if request.method == "GET":
        status_value = request.GET.get("status")
        supplier_id = request.GET.get("supplier_id")
        search = _clean_text(request.GET.get("search"))

        orders = PurchaseOrder.objects.select_related("supplier").prefetch_related("lines").all()

        if status_value and status_value != "all":
            orders = orders.filter(status=status_value)

        if supplier_id and supplier_id != "all":
            orders = orders.filter(supplier_id=supplier_id)

        if search:
            orders = orders.filter(
                Q(po_number__icontains=search)
                | Q(supplier__name__icontains=search)
                | Q(requested_by__icontains=search)
                | Q(notes__icontains=search)
                | Q(supplier_reference__icontains=search)
            )

        orders = orders.order_by("-id")

        return JsonResponse([_serialize_purchase_order(order) for order in orders], safe=False)

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        action = _clean_text(payload.get("action")) or "save_draft"

        if action in ["save_draft", "submit_for_approval", "cancel", "mark_received"]:
            _, error_response = _require_po_edit_access(request)
            if error_response:
                return error_response

        if action in ["approve", "reject"]:
            _, error_response = _require_po_approve_access(request)
            if error_response:
                return error_response

        supplier_id = payload.get("supplier_id")

        if not supplier_id:
            return JsonResponse({"success": False, "message": "Supplier is required."}, status=400)

        supplier = get_object_or_404(Supplier, pk=supplier_id)

        try:
            lines_data = _build_lines(payload.get("lines", []))
        except ValueError as exc:
            return JsonResponse({"success": False, "message": str(exc)}, status=400)

        status_value = PurchaseOrder.STATUS_DRAFT
        if action == "submit_for_approval":
            status_value = PurchaseOrder.STATUS_PENDING

        with transaction.atomic():
            order = PurchaseOrder.objects.create(
                supplier=supplier,
                order_date=payload.get("order_date") or None,
                requested_by=_clean_text(payload.get("requested_by")) or acting_user.username,
                status=status_value,
                notes=_clean_text(payload.get("notes")),
            )

            _save_lines(order, lines_data)

            if status_value == PurchaseOrder.STATUS_PENDING:
                _notify_admins_po_pending(order)

        order = PurchaseOrder.objects.select_related("supplier").prefetch_related("lines").get(pk=order.id)

        return JsonResponse(
            {
                "success": True,
                "message": "Purchase order submitted for approval." if status_value == PurchaseOrder.STATUS_PENDING else "Draft purchase order created successfully.",
                "purchase_order": _serialize_purchase_order(order),
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def purchase_order_detail(request, purchase_order_id):
    acting_user, error_response = _require_po_view_access(request)
    if error_response:
        return error_response

    order = get_object_or_404(
        PurchaseOrder.objects.select_related("supplier").prefetch_related("lines"),
        pk=purchase_order_id,
    )

    if request.method == "GET":
        return JsonResponse(_serialize_purchase_order(order))

    if request.method == "DELETE":
        _, error_response = _require_po_edit_access(request)
        if error_response:
            return error_response

        if order.status in [PurchaseOrder.STATUS_APPROVED, PurchaseOrder.STATUS_RECEIVED]:
            return JsonResponse(
                {"success": False, "message": "Approved or received purchase orders cannot be deleted."},
                status=400,
            )

        order.delete()
        return JsonResponse({"success": True, "message": "Purchase order deleted successfully."})

    if request.method == "POST":
        content_type = request.content_type or ""

        if "multipart/form-data" in content_type:
            _, error_response = _require_po_edit_access(request)
            if error_response:
                return error_response

            action = _clean_text(request.POST.get("action"))

            if action != "mark_received":
                return JsonResponse({"success": False, "message": "Unsupported form submission."}, status=400)

            if order.status != PurchaseOrder.STATUS_APPROVED:
                return JsonResponse(
                    {"success": False, "message": "Only approved purchase orders can be marked as received."},
                    status=400,
                )

            received_proof = request.FILES.get("received_proof")
            received_note = _clean_text(request.POST.get("received_note"))
            supplier_reference = _clean_text(request.POST.get("supplier_reference"))

            if not received_proof:
                return JsonResponse(
                    {"success": False, "message": "Proof upload is required before marking this as received."},
                    status=400,
                )

            order.status = PurchaseOrder.STATUS_RECEIVED
            order.received_by = acting_user.username
            order.received_at = timezone.now()
            order.received_note = received_note
            order.supplier_reference = supplier_reference
            order.received_proof = received_proof
            order.save()

            order = PurchaseOrder.objects.select_related("supplier").prefetch_related("lines").get(pk=order.id)

            return JsonResponse(
                {
                    "success": True,
                    "message": "Purchase order marked as received.",
                    "purchase_order": _serialize_purchase_order(order),
                }
            )

        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        action = _clean_text(payload.get("action")) or "save_draft"

        supplier_id = payload.get("supplier_id")
        if not supplier_id:
            return JsonResponse({"success": False, "message": "Supplier is required."}, status=400)

        supplier = get_object_or_404(Supplier, pk=supplier_id)

        if action in ["save_draft", "submit_for_approval"]:
            if order.status in [PurchaseOrder.STATUS_APPROVED, PurchaseOrder.STATUS_RECEIVED]:
                return JsonResponse(
                    {"success": False, "message": "Approved or received purchase orders cannot be edited this way."},
                    status=400,
                )

            try:
                lines_data = _build_lines(payload.get("lines", []))
            except ValueError as exc:
                return JsonResponse({"success": False, "message": str(exc)}, status=400)

            with transaction.atomic():
                order.supplier = supplier
                order.order_date = payload.get("order_date") or order.order_date
                order.requested_by = _clean_text(payload.get("requested_by")) or order.requested_by or acting_user.username
                order.notes = _clean_text(payload.get("notes"))

                if action == "submit_for_approval":
                    order.status = PurchaseOrder.STATUS_PENDING
                else:
                    order.status = PurchaseOrder.STATUS_DRAFT
                    order.approval_note = ""
                    order.approved_by = ""
                    order.approved_at = None

                order.save()
                _save_lines(order, lines_data)

                if action == "submit_for_approval":
                    _notify_admins_po_pending(order)

            order = PurchaseOrder.objects.select_related("supplier").prefetch_related("lines").get(pk=order.id)

            return JsonResponse(
                {
                    "success": True,
                    "message": "Purchase order submitted for approval." if action == "submit_for_approval" else "Draft purchase order updated successfully.",
                    "purchase_order": _serialize_purchase_order(order),
                }
            )

        if action == "approve":
            if not _is_admin_approver(acting_user):
                return JsonResponse(
                    {"success": False, "message": "Only staff with purchase order approval permission can approve purchase orders."},
                    status=403,
                )

            if order.status != PurchaseOrder.STATUS_PENDING:
                return JsonResponse(
                    {"success": False, "message": "Only pending purchase orders can be approved."},
                    status=400,
                )

            order.status = PurchaseOrder.STATUS_APPROVED
            order.approval_note = _clean_text(payload.get("approval_note"))
            order.approved_by = acting_user.username
            order.approved_at = timezone.now()
            order.save()

            _notify_requester_po_decision(order, "approved")

            return JsonResponse(
                {
                    "success": True,
                    "message": "Purchase order approved.",
                    "purchase_order": _serialize_purchase_order(order),
                }
            )

        if action == "reject":
            if not _is_admin_approver(acting_user):
                return JsonResponse(
                    {"success": False, "message": "Only staff with purchase order approval permission can reject purchase orders."},
                    status=403,
                )

            if order.status != PurchaseOrder.STATUS_PENDING:
                return JsonResponse(
                    {"success": False, "message": "Only pending purchase orders can be rejected."},
                    status=400,
                )

            order.status = PurchaseOrder.STATUS_REJECTED
            order.approval_note = _clean_text(payload.get("approval_note"))
            order.approved_by = acting_user.username
            order.approved_at = timezone.now()
            order.save()

            _notify_requester_po_decision(order, "rejected")

            return JsonResponse(
                {
                    "success": True,
                    "message": "Purchase order rejected.",
                    "purchase_order": _serialize_purchase_order(order),
                }
            )

        if action == "mark_received":
            return JsonResponse(
                {"success": False, "message": "This action now requires proof upload and must be submitted as a form."},
                status=400,
            )

        if action == "cancel":
            if order.status == PurchaseOrder.STATUS_RECEIVED:
                return JsonResponse(
                    {"success": False, "message": "Received purchase orders cannot be cancelled."},
                    status=400,
                )

            order.status = PurchaseOrder.STATUS_CANCELLED
            order.save()

            return JsonResponse(
                {
                    "success": True,
                    "message": "Purchase order cancelled.",
                    "purchase_order": _serialize_purchase_order(order),
                }
            )

        return JsonResponse({"success": False, "message": "Invalid action."}, status=400)

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)
