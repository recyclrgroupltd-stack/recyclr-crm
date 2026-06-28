import json
from decimal import Decimal, InvalidOperation
from urllib.parse import quote

from django.contrib.auth import get_user_model
from django.db.models import Prefetch, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt

from accounts_api.views import get_request_user_from_request
from expenses.models import ExpenseClaim, ExpenseLine
from purchase_orders.models import PurchaseOrder, PurchaseOrderLine

from .models import Asset, AssetEvent


User = get_user_model()


def _parse_json_body(request):
    try:
        if not request.body:
            return {}
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _decimal(value):
    if value in (None, ""):
        return Decimal("0.00")
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")


def _blank_to_none(value):
    return value or None


def _staff_display_name(user):
    if not user:
        return ""
    return user.get_full_name() or user.username or str(user)


def _asset_qr_url(asset):
    return f"https://api.qrserver.com/v1/create-qr-code/?size=180x180&data={quote(asset.qr_payload)}"


def _format_money(value):
    return f"GBP {Decimal(value or 0):,.2f}"


def _purchase_order_option_label(order):
    line = next(iter(getattr(order, "prefetched_lines", [])), None)
    description = line.description if line else "No line description"
    supplier = order.supplier.name if order.supplier_id else "Supplier not set"
    return " | ".join(
        [
            order.po_number or f"PO-{order.id:06d}",
            supplier,
            description,
            order.get_status_display(),
            _format_money(order.total_inc_vat),
            order.order_date.strftime("%d/%m/%Y") if order.order_date else "No date",
        ]
    )


def _expense_option_label(expense):
    staff_name = _staff_display_name(expense.submitted_by)
    line = next(iter(getattr(expense, "prefetched_lines", [])), None)
    item = line.description if line and line.description else expense.description or expense.category.name
    merchant = expense.merchant or (line.merchant if line and line.merchant else expense.category.name)
    return " | ".join(
        [
            f"EXP-{expense.id:06d}",
            item,
            merchant,
            expense.category.name,
            staff_name or "Staff not set",
            expense.get_status_display(),
            _format_money(expense.amount),
            expense.expense_date.strftime("%d/%m/%Y") if expense.expense_date else "No date",
        ]
    )


def _serialize_asset(asset, include_events=False):
    return {
        "id": asset.id,
        "asset_uid": asset.asset_uid,
        "name": asset.name,
        "category": asset.category,
        "category_label": asset.get_category_display(),
        "status": asset.status,
        "status_label": asset.get_status_display(),
        "serial_number": asset.serial_number,
        "location": asset.location,
        "assigned_to_id": asset.assigned_to_id,
        "assigned_to_name": _staff_display_name(asset.assigned_to),
        "purchase_date": asset.purchase_date.isoformat() if asset.purchase_date else "",
        "purchase_value": float(asset.purchase_value or 0),
        "supplier": asset.supplier,
        "warranty_expiry": asset.warranty_expiry.isoformat() if asset.warranty_expiry else "",
        "notes": asset.notes,
        "purchase_order_id": asset.purchase_order_id,
        "purchase_order_number": asset.purchase_order.po_number if asset.purchase_order_id else "",
        "expense_claim_id": asset.expense_claim_id,
        "qr_payload": asset.qr_payload,
        "qr_url": _asset_qr_url(asset),
        "created_at": asset.created_at.isoformat() if asset.created_at else "",
        "updated_at": asset.updated_at.isoformat() if asset.updated_at else "",
        "events": [
            {
                "id": event.id,
                "title": event.title,
                "notes": event.notes,
                "old_status": event.old_status,
                "new_status": event.new_status,
                "created_by": event.created_by,
                "created_at": event.created_at.isoformat() if event.created_at else "",
            }
            for event in asset.events.all()
        ] if include_events else [],
    }


def options(request):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    staff = User.objects.filter(is_staff=True, is_active=True).order_by("username")
    purchase_orders = (
        PurchaseOrder.objects.select_related("supplier")
        .prefetch_related(Prefetch("lines", queryset=PurchaseOrderLine.objects.order_by("line_order", "id"), to_attr="prefetched_lines"))
        .order_by("-id")[:250]
    )
    expenses = (
        ExpenseClaim.objects.select_related("submitted_by", "category")
        .prefetch_related(Prefetch("lines", queryset=ExpenseLine.objects.order_by("id"), to_attr="prefetched_lines"))
        .order_by("-id")[:250]
    )
    return JsonResponse(
        {
            "success": True,
            "categories": [{"value": value, "label": label} for value, label in Asset.CATEGORY_CHOICES],
            "statuses": [{"value": value, "label": label} for value, label in Asset.STATUS_CHOICES],
            "staff": [{"id": user.id, "name": _staff_display_name(user)} for user in staff],
            "purchase_orders": [
                {
                    "id": order.id,
                    "label": _purchase_order_option_label(order),
                }
                for order in purchase_orders
            ],
            "expenses": [
                {
                    "id": expense.id,
                    "label": _expense_option_label(expense),
                }
                for expense in expenses
            ],
        }
    )


@csrf_exempt
def assets_list(request):
    if request.method == "GET":
        search = request.GET.get("search", "").strip()
        status_filter = request.GET.get("status", "all").strip()
        category_filter = request.GET.get("category", "all").strip()
        assets = Asset.objects.select_related("assigned_to", "purchase_order", "purchase_order__supplier", "expense_claim")
        if search:
            assets = assets.filter(
                Q(asset_uid__icontains=search)
                | Q(name__icontains=search)
                | Q(serial_number__icontains=search)
                | Q(location__icontains=search)
                | Q(supplier__icontains=search)
            )
        if status_filter and status_filter != "all":
            assets = assets.filter(status=status_filter)
        if category_filter and category_filter != "all":
            assets = assets.filter(category=category_filter)

        all_assets = Asset.objects.all()
        return JsonResponse(
            {
                "success": True,
                "summary": {
                    "total": all_assets.count(),
                    "active": all_assets.filter(status=Asset.STATUS_ACTIVE).count(),
                    "in_repair": all_assets.filter(status=Asset.STATUS_IN_REPAIR).count(),
                    "retired": all_assets.filter(status__in=[Asset.STATUS_RETIRED, Asset.STATUS_SOLD]).count(),
                    "filtered": assets.count(),
                },
                "rows": [_serialize_asset(asset) for asset in assets[:250]],
            }
        )

    if request.method == "POST":
        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"success": False, "message": "Invalid JSON."}, status=400)

        name = str(data.get("name") or "").strip()
        if not name:
            return JsonResponse({"success": False, "message": "Asset name is required."}, status=400)

        acting_user = get_request_user_from_request(request)
        asset = Asset.objects.create(
            name=name,
            category=str(data.get("category") or "other"),
            status=str(data.get("status") or Asset.STATUS_ACTIVE),
            serial_number=str(data.get("serial_number") or "").strip(),
            location=str(data.get("location") or "").strip(),
            assigned_to_id=_blank_to_none(data.get("assigned_to_id")),
            purchase_date=_blank_to_none(data.get("purchase_date")),
            purchase_value=_decimal(data.get("purchase_value")),
            supplier=str(data.get("supplier") or "").strip(),
            warranty_expiry=_blank_to_none(data.get("warranty_expiry")),
            notes=str(data.get("notes") or "").strip(),
            purchase_order_id=_blank_to_none(data.get("purchase_order_id")),
            expense_claim_id=_blank_to_none(data.get("expense_claim_id")),
            created_by=acting_user if acting_user and acting_user.is_authenticated else None,
        )
        AssetEvent.objects.create(
            asset=asset,
            title="Asset created",
            notes=f"{asset.asset_uid} added to the asset register.",
            new_status=asset.status,
            created_by=_staff_display_name(acting_user),
        )
        return JsonResponse({"success": True, "message": f"{asset.asset_uid} created.", "asset": _serialize_asset(asset)})

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def asset_detail(request, asset_id):
    asset = get_object_or_404(
        Asset.objects.select_related("assigned_to", "purchase_order", "purchase_order__supplier", "expense_claim"),
        pk=asset_id,
    )

    if request.method == "GET":
        return JsonResponse({"success": True, "asset": _serialize_asset(asset, include_events=True)})

    if request.method == "PATCH":
        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"success": False, "message": "Invalid JSON."}, status=400)
        old_status = asset.status
        fields = [
            "name",
            "category",
            "status",
            "serial_number",
            "location",
            "purchase_date",
            "supplier",
            "warranty_expiry",
            "notes",
        ]
        for field in fields:
            if field in data:
                value = str(data.get(field) or "").strip()
                setattr(asset, field, value or None if field in {"purchase_date", "warranty_expiry"} else value)
        if "purchase_value" in data:
            asset.purchase_value = _decimal(data.get("purchase_value"))
        if "assigned_to_id" in data:
            asset.assigned_to_id = _blank_to_none(data.get("assigned_to_id"))
        if "purchase_order_id" in data:
            asset.purchase_order_id = _blank_to_none(data.get("purchase_order_id"))
        if "expense_claim_id" in data:
            asset.expense_claim_id = _blank_to_none(data.get("expense_claim_id"))
        asset.save()

        acting_user = get_request_user_from_request(request)
        AssetEvent.objects.create(
            asset=asset,
            title="Asset updated",
            notes=str(data.get("change_note") or "Asset details updated.").strip(),
            old_status=old_status,
            new_status=asset.status,
            created_by=_staff_display_name(acting_user),
        )
        return JsonResponse({"success": True, "message": f"{asset.asset_uid} updated.", "asset": _serialize_asset(asset, include_events=True)})

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)
