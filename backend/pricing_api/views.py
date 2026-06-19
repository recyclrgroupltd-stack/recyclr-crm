import json

from django.db import models
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import csrf_exempt

from accounts_api.models import CompanyDetails
from accounts_api.views import require_permission
from pricing.models import PriceBookItem


def _decimal_from_payload(data, key, fallback=0):
    value = data.get(key, fallback)
    if value in ("", None):
        return fallback
    return value


def _date_from_payload(data, key):
    value = data.get(key)
    if not value:
        return None
    return parse_date(str(value))


def _require_pricing_view_access(request):
    return require_permission(request, "pricing.view", "You do not have permission to view pricing.")


def _require_pricing_edit_access(request):
    return require_permission(request, "pricing.edit", "You do not have permission to edit pricing.")


def _serialize_item(item):
    sample_revenue = item.monthly_customer_total()
    sample_cost = item.monthly_supplier_cost()
    sample_margin = item.monthly_margin()
    sample_margin_percent = item.monthly_margin_percent()

    return {
        "id": item.id,
        "waste_type": item.waste_type,
        "bin_size": item.bin_size,
        "price_per_lift": float(item.price_per_lift),
        "rental_per_day": float(item.rental_per_day),
        "supplier_price_per_lift": float(item.supplier_price_per_lift),
        "supplier_rental_per_day": float(item.supplier_rental_per_day),
        "delivery_charge": float(item.delivery_charge),
        "minimum_monthly_charge": float(item.minimum_monthly_charge),
        "target_margin_percent": float(item.target_margin_percent),
        "effective_from": item.effective_from.isoformat() if item.effective_from else "",
        "effective_to": item.effective_to.isoformat() if item.effective_to else "",
        "sample_monthly_revenue": float(sample_revenue),
        "sample_monthly_cost": float(sample_cost),
        "sample_monthly_margin": float(sample_margin),
        "sample_margin_percent": float(sample_margin_percent),
        "margin_warning": sample_margin_percent < item.target_margin_percent,
        "active": item.active,
        "notes": item.notes,
    }


def pricing_list(request):
    _, error_response = _require_pricing_view_access(request)
    if error_response:
        return error_response

    if request.method == "GET":
        items = PriceBookItem.objects.all().order_by("waste_type", "bin_size")
        active = request.GET.get("active")
        if active == "true":
            today = timezone.localdate()
            items = items.filter(active=True).filter(
                (models.Q(effective_from__isnull=True) | models.Q(effective_from__lte=today))
                & (models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today))
            )
        return JsonResponse([_serialize_item(item) for item in items], safe=False)

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def pricing_create(request):
    _, error_response = _require_pricing_edit_access(request)
    if error_response:
        return error_response

    if request.method == "POST":
        try:
            data = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        default_margin = CompanyDetails.get_solo().default_target_margin_percent or 30

        item = PriceBookItem.objects.create(
            waste_type=data.get("waste_type"),
            bin_size=data.get("bin_size"),
            price_per_lift=_decimal_from_payload(data, "price_per_lift", 0),
            rental_per_day=_decimal_from_payload(data, "rental_per_day", 0.25),
            supplier_price_per_lift=_decimal_from_payload(data, "supplier_price_per_lift", 0),
            supplier_rental_per_day=_decimal_from_payload(data, "supplier_rental_per_day", 0),
            delivery_charge=_decimal_from_payload(data, "delivery_charge", 0),
            minimum_monthly_charge=_decimal_from_payload(data, "minimum_monthly_charge", 0),
            target_margin_percent=_decimal_from_payload(data, "target_margin_percent", default_margin),
            effective_from=_date_from_payload(data, "effective_from"),
            effective_to=_date_from_payload(data, "effective_to"),
            notes=data.get("notes", "") or "",
            active=data.get("active", True),
        )

        return JsonResponse({"success": True, "item": _serialize_item(item)})

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def pricing_update(request, item_id):
    _, error_response = _require_pricing_edit_access(request)
    if error_response:
        return error_response

    if request.method == "POST":
        try:
            data = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        item = get_object_or_404(PriceBookItem, id=item_id)
        item.price_per_lift = _decimal_from_payload(data, "price_per_lift", item.price_per_lift)
        item.rental_per_day = _decimal_from_payload(data, "rental_per_day", item.rental_per_day)
        item.supplier_price_per_lift = _decimal_from_payload(data, "supplier_price_per_lift", item.supplier_price_per_lift)
        item.supplier_rental_per_day = _decimal_from_payload(data, "supplier_rental_per_day", item.supplier_rental_per_day)
        item.delivery_charge = _decimal_from_payload(data, "delivery_charge", item.delivery_charge)
        item.minimum_monthly_charge = _decimal_from_payload(data, "minimum_monthly_charge", item.minimum_monthly_charge)
        item.target_margin_percent = _decimal_from_payload(data, "target_margin_percent", item.target_margin_percent)
        item.effective_from = _date_from_payload(data, "effective_from")
        item.effective_to = _date_from_payload(data, "effective_to")
        item.notes = data.get("notes", item.notes) or ""
        item.active = data.get("active", item.active)
        item.save()

        return JsonResponse({"success": True, "item": _serialize_item(item)})

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def pricing_delete(request, item_id):
    _, error_response = _require_pricing_edit_access(request)
    if error_response:
        return error_response

    if request.method == "POST":
        item = get_object_or_404(PriceBookItem, id=item_id)
        item.delete()
        return JsonResponse({"success": True})

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)
