import json
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts_api.models import CompanyDetails
from accounts_api.views import get_request_user_from_request, user_has_permission
from customers.models import Customer, Site
from leads.models import Lead, LeadWasteRequirement
from pricing.models import PriceBookItem
from services.models import Service


def serialize_lead(lead):
    return {
        "id": lead.id,
        "company_name": lead.company_name,
        "who_spoke_to": lead.who_spoke_to,
        "contact_name": lead.contact_name,
        "phone": lead.phone,
        "secondary_phone": lead.secondary_phone,
        "email": lead.email,
        "status": lead.status,
        "lead_source": lead.lead_source,
        "lead_source_other": lead.lead_source_other,
        "address_line_1": lead.address_line_1,
        "address_line_2": lead.address_line_2,
        "town": lead.town,
        "county": lead.county,
        "postcode": lead.postcode,
        "formatted_address": lead.formatted_address,
        "follow_up_date": str(lead.follow_up_date) if lead.follow_up_date else "",
        "estimated_monthly_value": float(lead.calculated_monthly_value),
        "notes": lead.notes,
        "converted_customer_id": lead.converted_customer.id if lead.converted_customer else None,
        "converted_customer_name": lead.converted_customer.business_name if lead.converted_customer else "",
        "general_waste_required": lead.general_waste_required,
        "general_waste_bin_count": lead.general_waste_bin_count,
        "general_waste_bin_size": lead.general_waste_bin_size,
        "general_waste_collections_per_week": lead.general_waste_collections_per_week,
        "general_waste_lock_required": lead.general_waste_lock_required,
        "general_waste_metal_bin_required": lead.general_waste_metal_bin_required,
        "general_waste_current_provider": lead.general_waste_current_provider,
        "general_waste_current_cost": float(lead.general_waste_current_cost or 0),
        "recycling_required": lead.recycling_required,
        "recycling_bin_count": lead.recycling_bin_count,
        "recycling_bin_size": lead.recycling_bin_size,
        "recycling_collections_per_week": lead.recycling_collections_per_week,
        "recycling_lock_required": lead.recycling_lock_required,
        "recycling_metal_bin_required": lead.recycling_metal_bin_required,
        "recycling_current_provider": lead.recycling_current_provider,
        "recycling_current_cost": float(lead.recycling_current_cost or 0),
        "glass_required": lead.glass_required,
        "glass_bin_count": lead.glass_bin_count,
        "glass_bin_size": lead.glass_bin_size,
        "glass_collections_per_week": lead.glass_collections_per_week,
        "glass_lock_required": lead.glass_lock_required,
        "glass_metal_bin_required": lead.glass_metal_bin_required,
        "glass_current_provider": lead.glass_current_provider,
        "glass_current_cost": float(lead.glass_current_cost or 0),
        "food_required": lead.food_required,
        "food_bin_count": lead.food_bin_count,
        "food_bin_size": lead.food_bin_size,
        "food_collections_per_week": lead.food_collections_per_week,
        "food_lock_required": lead.food_lock_required,
        "food_metal_bin_required": lead.food_metal_bin_required,
        "food_current_provider": lead.food_current_provider,
        "food_current_cost": float(lead.food_current_cost or 0),
        "extra_waste_requirements": [
            serialize_extra_waste_requirement(requirement)
            for requirement in lead.extra_waste_requirements.all()
        ],
    }


def serialize_extra_waste_requirement(requirement):
    return {
        "id": requirement.id,
        "waste_type": requirement.waste_type,
        "waste_type_label": requirement.get_waste_type_display(),
        "bin_count": requirement.bin_count,
        "bin_size": requirement.bin_size,
        "collections_per_week": requirement.collections_per_week,
        "lock_required": requirement.lock_required,
        "metal_bin_required": requirement.metal_bin_required,
        "current_provider": requirement.current_provider,
        "current_cost": float(requirement.current_cost or 0),
    }


def serialize_customer(customer):
    return {
        "id": customer.id,
        "business_name": customer.business_name,
        "trading_name": customer.trading_name,
        "company_number": customer.company_number,
        "vat_number": customer.vat_number,
        "status": customer.status,
        "primary_contact_name": customer.primary_contact_name,
        "phone": customer.phone,
        "secondary_contact_name": customer.secondary_contact_name,
        "secondary_phone": customer.secondary_phone,
        "email": customer.email,
        "billing_address": customer.billing_address,
        "billing_address_line_1": customer.billing_address_line_1,
        "billing_address_line_2": customer.billing_address_line_2,
        "billing_town": customer.billing_town,
        "billing_county": customer.billing_county,
        "billing_postcode": customer.billing_postcode,
        "formatted_billing_address": customer.formatted_billing_address,
        "notes": customer.notes,
        "site_count": customer.sites.count(),
        "service_count": customer.services.count(),
        "created_at": customer.created_at.isoformat(),
    }


def serialize_site(site):
    return {
        "id": site.id,
        "customer_id": site.customer.id,
        "customer_name": site.customer.business_name,
        "site_name": site.site_name,
        "primary_contact_name": site.primary_contact_name,
        "phone": site.phone,
        "secondary_contact_name": site.secondary_contact_name,
        "secondary_phone": site.secondary_phone,
        "email": site.email,
        "address": site.address,
        "address_line_1": site.address_line_1,
        "address_line_2": site.address_line_2,
        "town": site.town,
        "county": site.county,
        "postcode": site.postcode,
        "formatted_address": site.formatted_address,
        "notes": site.notes,
        "service_count": site.services.count(),
        "created_at": site.created_at.isoformat(),
    }


def serialize_service(service):
    return {
        "id": service.id,
        "customer_id": service.customer.id,
        "customer_name": service.customer.business_name,
        "site_id": service.site.id,
        "site_name": service.site.site_name,
        "waste_type": service.waste_type,
        "waste_type_label": service.get_waste_type_display(),
        "bin_size": service.bin_size,
        "bin_size_label": service.get_bin_size_display(),
        "bin_count": service.bin_count,
        "collections_per_week": service.collections_per_week,
        "lock_required": service.lock_required,
        "metal_bin_required": service.metal_bin_required,
        "price_per_lift": float(service.price_per_lift),
        "monthly_value": float(service.monthly_value),
        "status": service.status,
        "created_at": service.created_at.isoformat(),
    }


def _clean_int(value, default=None):
    if value in ("", None):
        return default

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _clean_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ["true", "1", "yes", "on"]
    return bool(value)


def _clean_decimal_or_none(value):
    if value in ("", None):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8")), None
    except json.JSONDecodeError:
        return None, JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)


def _require_leads_view_access(request):
    user = get_request_user_from_request(request)

    if not user:
        return None, JsonResponse(
            {"success": False, "message": "Please sign in again."},
            status=401,
        )

    if not user_has_permission(user, "leads.view"):
        return None, JsonResponse(
            {"success": False, "message": "You do not have permission to view leads."},
            status=403,
        )

    return user, None


def _require_leads_edit_access(request):
    user = get_request_user_from_request(request)

    if not user:
        return None, JsonResponse(
            {"success": False, "message": "Please sign in again."},
            status=401,
        )

    if not user_has_permission(user, "leads.edit"):
        return None, JsonResponse(
            {"success": False, "message": "You do not have permission to edit leads."},
            status=403,
        )

    return user, None


def _apply_lead_payload(lead, payload, *, is_new=False):
    lead.company_name = (payload.get("company_name", "") or "").strip()
    lead.who_spoke_to = payload.get("who_spoke_to", "") or ""
    lead.contact_name = payload.get("contact_name", "") or ""
    lead.phone = payload.get("phone", "") or ""
    lead.secondary_phone = payload.get("secondary_phone", "") or ""
    lead.email = payload.get("email", "") or ""
    if is_new:
        lead.status = "new"
    lead.lead_source = payload.get("lead_source", "other") or "other"
    lead.lead_source_other = payload.get("lead_source_other", "") or ""
    lead.address_line_1 = payload.get("address_line_1", "") or ""
    lead.address_line_2 = payload.get("address_line_2", "") or ""
    lead.town = payload.get("town", "") or ""
    lead.county = payload.get("county", "") or ""
    lead.postcode = payload.get("postcode", "") or ""
    lead.follow_up_date = payload.get("follow_up_date") or None
    lead.notes = payload.get("notes", "") or ""

    lead.general_waste_required = _clean_bool(payload.get("general_waste_required"))
    lead.general_waste_bin_count = _clean_int(payload.get("general_waste_bin_count"))
    lead.general_waste_bin_size = payload.get("general_waste_bin_size", "") or ""
    lead.general_waste_collections_per_week = _clean_int(payload.get("general_waste_collections_per_week"))
    lead.general_waste_lock_required = _clean_bool(payload.get("general_waste_lock_required"))
    lead.general_waste_metal_bin_required = _clean_bool(payload.get("general_waste_metal_bin_required"))
    lead.general_waste_current_provider = payload.get("general_waste_current_provider", "") or ""
    lead.general_waste_current_cost = _clean_decimal_or_none(payload.get("general_waste_current_cost"))

    lead.recycling_required = _clean_bool(payload.get("recycling_required"))
    lead.recycling_bin_count = _clean_int(payload.get("recycling_bin_count"))
    lead.recycling_bin_size = payload.get("recycling_bin_size", "") or ""
    lead.recycling_collections_per_week = _clean_int(payload.get("recycling_collections_per_week"))
    lead.recycling_lock_required = _clean_bool(payload.get("recycling_lock_required"))
    lead.recycling_metal_bin_required = _clean_bool(payload.get("recycling_metal_bin_required"))
    lead.recycling_current_provider = payload.get("recycling_current_provider", "") or ""
    lead.recycling_current_cost = _clean_decimal_or_none(payload.get("recycling_current_cost"))

    lead.glass_required = _clean_bool(payload.get("glass_required"))
    lead.glass_bin_count = _clean_int(payload.get("glass_bin_count"))
    lead.glass_bin_size = payload.get("glass_bin_size", "240") or "240"
    lead.glass_collections_per_week = _clean_int(payload.get("glass_collections_per_week"))
    lead.glass_lock_required = _clean_bool(payload.get("glass_lock_required"))
    lead.glass_metal_bin_required = _clean_bool(payload.get("glass_metal_bin_required"))
    lead.glass_current_provider = payload.get("glass_current_provider", "") or ""
    lead.glass_current_cost = _clean_decimal_or_none(payload.get("glass_current_cost"))

    lead.food_required = _clean_bool(payload.get("food_required"))
    lead.food_bin_count = _clean_int(payload.get("food_bin_count"))
    lead.food_bin_size = payload.get("food_bin_size", "240") or "240"
    lead.food_collections_per_week = _clean_int(payload.get("food_collections_per_week"))
    lead.food_lock_required = _clean_bool(payload.get("food_lock_required"))
    lead.food_metal_bin_required = _clean_bool(payload.get("food_metal_bin_required"))
    lead.food_current_provider = payload.get("food_current_provider", "") or ""
    lead.food_current_cost = _clean_decimal_or_none(payload.get("food_current_cost"))

    lead.address = lead.formatted_address


def _sync_extra_waste_requirements(lead, payload):
    if "extra_waste_requirements" not in payload:
        return

    LeadWasteRequirement.objects.filter(lead=lead).delete()
    rows = payload.get("extra_waste_requirements")
    if not isinstance(rows, list):
        return

    valid_waste_types = {choice[0] for choice in LeadWasteRequirement.WASTE_TYPE_CHOICES}
    valid_bin_sizes = {choice[0] for choice in LeadWasteRequirement.BIN_SIZE_CHOICES}
    for row in rows:
        if not isinstance(row, dict):
            continue
        waste_type = (row.get("waste_type") or "").strip()
        bin_size = str(row.get("bin_size") or "").strip()
        if waste_type not in valid_waste_types:
            continue
        if waste_type in ("glass", "food"):
            bin_size = "240"
        if bin_size not in valid_bin_sizes:
            continue
        LeadWasteRequirement.objects.create(
            lead=lead,
            waste_type=waste_type,
            bin_count=max(1, _clean_int(row.get("bin_count"), default=1) or 1),
            bin_size=bin_size,
            collections_per_week=max(1, _clean_int(row.get("collections_per_week"), default=1) or 1),
            lock_required=_clean_bool(row.get("lock_required")),
            metal_bin_required=_clean_bool(row.get("metal_bin_required")),
            current_provider=row.get("current_provider", "") or "",
            current_cost=_clean_decimal_or_none(row.get("current_cost")),
        )


def _validate_lead(lead):
    if not lead.company_name:
        return "Company name is required."

    if lead.lead_source == "other" and not lead.lead_source_other:
        return "Please enter the other lead source."

    if lead.glass_bin_size and lead.glass_bin_size != "240":
        return "Glass leads can only use 240L bins."

    if lead.food_bin_size and lead.food_bin_size != "240":
        return "Food leads can only use 240L bins."

    return None


def _decimal(value, fallback="0"):
    try:
        return Decimal(str(value if value not in (None, "") else fallback))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(fallback)


def _money(value):
    return float(_decimal(value).quantize(Decimal("0.01")))


def _percent(value):
    return float(_decimal(value).quantize(Decimal("0.01")))


def _lead_streams(lead):
    streams = [
        {
            "key": "general_waste",
            "pricebook_key": "general",
            "label": "General Waste",
            "required": lead.general_waste_required,
            "bin_count": lead.general_waste_bin_count,
            "bin_size": lead.general_waste_bin_size,
            "collections_per_week": lead.general_waste_collections_per_week,
            "lock_required": lead.general_waste_lock_required,
            "metal_bin_required": lead.general_waste_metal_bin_required,
            "current_provider": lead.general_waste_current_provider,
            "current_cost": lead.general_waste_current_cost,
        },
        {
            "key": "recycling",
            "pricebook_key": "recycling",
            "label": "Dry Mixed Recycling",
            "required": lead.recycling_required,
            "bin_count": lead.recycling_bin_count,
            "bin_size": lead.recycling_bin_size,
            "collections_per_week": lead.recycling_collections_per_week,
            "lock_required": lead.recycling_lock_required,
            "metal_bin_required": lead.recycling_metal_bin_required,
            "current_provider": lead.recycling_current_provider,
            "current_cost": lead.recycling_current_cost,
        },
        {
            "key": "glass",
            "pricebook_key": "glass",
            "label": "Glass",
            "required": lead.glass_required,
            "bin_count": lead.glass_bin_count,
            "bin_size": "240",
            "collections_per_week": lead.glass_collections_per_week,
            "lock_required": lead.glass_lock_required,
            "metal_bin_required": lead.glass_metal_bin_required,
            "current_provider": lead.glass_current_provider,
            "current_cost": lead.glass_current_cost,
        },
        {
            "key": "food",
            "pricebook_key": "food",
            "label": "Food",
            "required": lead.food_required,
            "bin_count": lead.food_bin_count,
            "bin_size": "240",
            "collections_per_week": lead.food_collections_per_week,
            "lock_required": lead.food_lock_required,
            "metal_bin_required": lead.food_metal_bin_required,
            "current_provider": lead.food_current_provider,
            "current_cost": lead.food_current_cost,
        },
    ]
    for requirement in lead.extra_waste_requirements.all():
        streams.append(
            {
                "key": requirement.waste_type,
                "pricebook_key": requirement.waste_type,
                "label": requirement.get_waste_type_display(),
                "required": True,
                "bin_count": requirement.bin_count,
                "bin_size": "240" if requirement.waste_type in ("glass", "food") else requirement.bin_size,
                "collections_per_week": requirement.collections_per_week,
                "lock_required": requirement.lock_required,
                "metal_bin_required": requirement.metal_bin_required,
                "current_provider": requirement.current_provider,
                "current_cost": requirement.current_cost,
            }
        )
    return streams


def _active_price_item(waste_type, bin_size):
    today = timezone.localdate()
    return (
        PriceBookItem.objects.filter(waste_type=waste_type, bin_size=str(bin_size), active=True)
        .filter(effective_from__isnull=True) | PriceBookItem.objects.filter(waste_type=waste_type, bin_size=str(bin_size), active=True, effective_from__lte=today)
    ).filter(effective_to__isnull=True) | PriceBookItem.objects.filter(waste_type=waste_type, bin_size=str(bin_size), active=True, effective_to__gte=today)


def _lookup_price_item(waste_type, bin_size):
    today = timezone.localdate()
    return (
        PriceBookItem.objects.filter(waste_type=waste_type, bin_size=str(bin_size), active=True)
        .filter(effective_from__isnull=True)
        .filter(effective_to__isnull=True)
        .first()
        or PriceBookItem.objects.filter(waste_type=waste_type, bin_size=str(bin_size), active=True)
        .filter(effective_from__isnull=True)
        .filter(effective_to__gte=today)
        .first()
        or PriceBookItem.objects.filter(waste_type=waste_type, bin_size=str(bin_size), active=True)
        .filter(effective_from__lte=today)
        .filter(effective_to__isnull=True)
        .first()
        or PriceBookItem.objects.filter(waste_type=waste_type, bin_size=str(bin_size), active=True)
        .filter(effective_from__lte=today, effective_to__gte=today)
        .first()
    )


def _calculate_preview_line(stream, target_margin=None):
    bin_count = max(1, int(stream["bin_count"] or 1))
    collections_per_week = max(1, int(stream["collections_per_week"] or 1))
    lifts_per_month = Decimal(bin_count) * Decimal(collections_per_week) * Decimal("4.33")
    rental_days = Decimal(bin_count) * Decimal("30")
    price_item = _lookup_price_item(stream["pricebook_key"], stream["bin_size"])
    warnings = []

    if price_item:
        price_per_lift = price_item.price_per_lift
        rental_per_day = price_item.rental_per_day
        supplier_price_per_lift = price_item.supplier_price_per_lift
        supplier_rental_per_day = price_item.supplier_rental_per_day
        delivery_charge = price_item.delivery_charge
        minimum_monthly_charge = price_item.minimum_monthly_charge
    else:
        price_per_lift = rental_per_day = supplier_price_per_lift = supplier_rental_per_day = delivery_charge = minimum_monthly_charge = Decimal("0")
        warnings.append(f"No active pricebook item for {stream['label']} {stream['bin_size']}L.")

    supplier_cost = (lifts_per_month * supplier_price_per_lift) + (rental_days * supplier_rental_per_day)
    rental_total = rental_days * rental_per_day

    if target_margin is not None and supplier_cost > 0 and target_margin < Decimal("99.00"):
        target_total = supplier_cost / (Decimal("1") - (target_margin / Decimal("100")))
        collection_total = max(Decimal("0"), target_total - rental_total)
        price_per_lift = collection_total / lifts_per_month if lifts_per_month else Decimal("0")
    else:
        collection_total = lifts_per_month * price_per_lift

    monthly_total = collection_total + rental_total
    if minimum_monthly_charge and monthly_total < minimum_monthly_charge:
        monthly_total = minimum_monthly_charge
        collection_total = max(Decimal("0"), monthly_total - rental_total)
        price_per_lift = collection_total / lifts_per_month if lifts_per_month else Decimal("0")

    margin = monthly_total - supplier_cost
    margin_percent = (margin / monthly_total * Decimal("100")) if monthly_total > 0 else Decimal("0")
    delivery_total = Decimal(bin_count) * delivery_charge

    return {
        "waste_type": stream["key"],
        "label": stream["label"],
        "bin_size": stream["bin_size"],
        "bin_count": bin_count,
        "collections_per_week": collections_per_week,
        "lock_required": stream["lock_required"],
        "metal_bin_required": stream["metal_bin_required"],
        "price_per_lift": _money(price_per_lift),
        "rental_per_day": _money(rental_per_day),
        "delivery_charge_per_bin": _money(delivery_charge),
        "delivery_total": _money(delivery_total),
        "collection_per_month": _money(collection_total),
        "rental_per_month": _money(rental_total),
        "line_total_per_month": _money(monthly_total),
        "supplier_cost_per_month": _money(supplier_cost),
        "margin_per_month": _money(margin),
        "margin_percent": _percent(margin_percent),
        "current_provider": stream.get("current_provider") or "",
        "current_cost": _money(stream.get("current_cost") or 0),
        "price_found": bool(price_item),
        "warnings": warnings,
    }


def _preview_for_offer(lead, offer_index, target_margin):
    lines = [
        _calculate_preview_line(stream, target_margin)
        for stream in _lead_streams(lead)
        if stream["required"]
    ]
    totals = {
        "collection_per_month": sum(_decimal(line["collection_per_month"]) for line in lines),
        "rental_per_month": sum(_decimal(line["rental_per_month"]) for line in lines),
        "monthly_total": sum(_decimal(line["line_total_per_month"]) for line in lines),
        "supplier_cost_per_month": sum(_decimal(line["supplier_cost_per_month"]) for line in lines),
        "delivery_total": sum(_decimal(line["delivery_total"]) for line in lines),
    }
    totals["margin_per_month"] = totals["monthly_total"] - totals["supplier_cost_per_month"]
    totals["margin_percent"] = (
        totals["margin_per_month"] / totals["monthly_total"] * Decimal("100")
        if totals["monthly_total"] > 0
        else Decimal("0")
    )

    label = "Standard price" if offer_index == 0 else ("Final offer" if offer_index == 3 else f"Offer {offer_index}")
    return {
        "index": offer_index,
        "label": label,
        "target_margin_percent": None if target_margin is None else _percent(target_margin),
        "totals": {
            key: (_percent(value) if key == "margin_percent" else _money(value))
            for key, value in totals.items()
        },
        "lines": lines,
        "warnings": [warning for line in lines for warning in line["warnings"]],
    }


def lead_quote_preview(request, lead_id):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    _, error_response = _require_leads_view_access(request)
    if error_response:
        return error_response

    lead = get_object_or_404(Lead, pk=lead_id)
    selected_streams = [stream for stream in _lead_streams(lead) if stream["required"]]
    if not selected_streams:
        return JsonResponse(
            {"success": False, "message": "Add at least one waste stream before generating a quote."},
            status=400,
        )

    details = CompanyDetails.get_solo()
    target_margins = [
        None,
        _decimal(details.sales_offer_margin_1_percent, "35"),
        _decimal(details.sales_offer_margin_2_percent, "30"),
        _decimal(details.sales_offer_margin_3_percent, "25"),
    ]
    try:
        selected_offer = int(request.GET.get("offer", "0"))
    except (TypeError, ValueError):
        selected_offer = 0
    selected_offer = min(3, max(0, selected_offer))

    offers = [
        _preview_for_offer(lead, index, target_margins[index])
        for index in range(4)
    ]
    selected = offers[selected_offer]

    return JsonResponse(
        {
            "success": True,
            "lead": {
                "id": lead.id,
                "company_name": lead.company_name,
                "contact_name": lead.contact_name,
                "email": lead.email,
            },
            "selected_offer_index": selected_offer,
            "label": selected["label"],
            "target_margin_percent": selected["target_margin_percent"],
            "totals": selected["totals"],
            "lines": selected["lines"],
            "offer_options": [
                {
                    "index": offer["index"],
                    "label": offer["label"],
                    "target_margin_percent": offer["target_margin_percent"],
                    "monthly_total": offer["totals"]["monthly_total"],
                    "margin_percent": offer["totals"]["margin_percent"],
                }
                for offer in offers
            ],
            "warnings": selected["warnings"],
        }
    )


@csrf_exempt
def leads_list(request):
    if request.method == "GET":
        _, error_response = _require_leads_view_access(request)
        if error_response:
            return error_response

        leads = Lead.objects.select_related("converted_customer").all().order_by("-id")
        return JsonResponse([serialize_lead(lead) for lead in leads], safe=False)

    if request.method == "POST":
        acting_user, error_response = _require_leads_edit_access(request)
        if error_response:
            return error_response

        payload, parse_error = _parse_json_body(request)
        if parse_error:
            return parse_error

        lead = Lead(created_by=acting_user)
        _apply_lead_payload(lead, payload, is_new=True)

        validation_message = _validate_lead(lead)
        if validation_message:
            return JsonResponse({"success": False, "message": validation_message}, status=400)

        lead.save()
        _sync_extra_waste_requirements(lead, payload)

        return JsonResponse(
            {
                "success": True,
                "message": "Lead created successfully.",
                "lead": serialize_lead(lead),
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def lead_detail(request, lead_id):
    lead = get_object_or_404(Lead.objects.select_related("converted_customer"), pk=lead_id)

    if request.method == "GET":
        _, error_response = _require_leads_view_access(request)
        if error_response:
            return error_response

        return JsonResponse(serialize_lead(lead))

    if request.method == "POST":
        _, error_response = _require_leads_edit_access(request)
        if error_response:
            return error_response

        payload, parse_error = _parse_json_body(request)
        if parse_error:
            return parse_error

        _apply_lead_payload(lead, payload)

        validation_message = _validate_lead(lead)
        if validation_message:
            return JsonResponse({"success": False, "message": validation_message}, status=400)

        lead.save()
        _sync_extra_waste_requirements(lead, payload)

        return JsonResponse(
            {"success": True, "message": "Lead updated successfully.", "lead": serialize_lead(lead)}
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


def customers_list(request):
    customers = Customer.objects.all().order_by("-id")
    return JsonResponse([serialize_customer(customer) for customer in customers], safe=False)


@csrf_exempt
def customer_detail(request, customer_id):
    customer = get_object_or_404(Customer, pk=customer_id)

    if request.method == "GET":
        data = serialize_customer(customer)
        data["sites"] = [serialize_site(site) for site in customer.sites.all().order_by("site_name")]
        data["services"] = [
            serialize_service(service)
            for service in customer.services.select_related("site").all().order_by("-id")
        ]
        return JsonResponse(data)

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        customer.business_name = payload.get("business_name", "") or ""
        customer.trading_name = payload.get("trading_name", "") or ""
        customer.company_number = payload.get("company_number", "") or ""
        customer.vat_number = payload.get("vat_number", "") or ""
        customer.status = payload.get("status", "active") or "active"

        customer.primary_contact_name = payload.get("primary_contact_name", "") or ""
        customer.phone = payload.get("phone", "") or ""
        customer.secondary_contact_name = payload.get("secondary_contact_name", "") or ""
        customer.secondary_phone = payload.get("secondary_phone", "") or ""
        customer.email = payload.get("email", "") or ""

        customer.billing_address_line_1 = payload.get("billing_address_line_1", "") or ""
        customer.billing_address_line_2 = payload.get("billing_address_line_2", "") or ""
        customer.billing_town = payload.get("billing_town", "") or ""
        customer.billing_county = payload.get("billing_county", "") or ""
        customer.billing_postcode = payload.get("billing_postcode", "") or ""
        customer.billing_address = customer.formatted_billing_address
        customer.notes = payload.get("notes", "") or ""

        customer.save()

        data = serialize_customer(customer)
        data["sites"] = [serialize_site(site) for site in customer.sites.all().order_by("site_name")]
        data["services"] = [
            serialize_service(service)
            for service in customer.services.select_related("site").all().order_by("-id")
        ]

        return JsonResponse(
            {"success": True, "message": "Customer updated successfully.", "customer": data}
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


def sites_list(request):
    sites = Site.objects.select_related("customer").all().order_by("-id")
    return JsonResponse([serialize_site(site) for site in sites], safe=False)


@csrf_exempt
def site_detail(request, site_id):
    site = get_object_or_404(Site.objects.select_related("customer"), pk=site_id)

    if request.method == "GET":
        data = serialize_site(site)
        data["services"] = [
            serialize_service(service)
            for service in site.services.select_related("customer").all().order_by("-id")
        ]
        return JsonResponse(data)

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        customer_id = payload.get("customer_id")
        if customer_id:
            site.customer = get_object_or_404(Customer, pk=customer_id)

        site.site_name = payload.get("site_name", "") or ""
        site.primary_contact_name = payload.get("primary_contact_name", "") or ""
        site.phone = payload.get("phone", "") or ""
        site.secondary_contact_name = payload.get("secondary_contact_name", "") or ""
        site.secondary_phone = payload.get("secondary_phone", "") or ""
        site.email = payload.get("email", "") or ""

        site.address_line_1 = payload.get("address_line_1", "") or ""
        site.address_line_2 = payload.get("address_line_2", "") or ""
        site.town = payload.get("town", "") or ""
        site.county = payload.get("county", "") or ""
        site.postcode = payload.get("postcode", "") or ""
        site.address = site.formatted_address
        site.notes = payload.get("notes", "") or ""

        site.save()

        return JsonResponse(
            {"success": True, "message": "Site updated successfully.", "site": serialize_site(site)}
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


def services_list(request):
    services = Service.objects.select_related("customer", "site").all().order_by("-id")
    return JsonResponse([serialize_service(service) for service in services], safe=False)


def service_create_options(request):
    customers = Customer.objects.all().order_by("business_name")
    sites = Site.objects.select_related("customer").all().order_by("customer__business_name", "site_name")

    return JsonResponse(
        {
            "customers": [
                {"id": customer.id, "business_name": customer.business_name}
                for customer in customers
            ],
            "sites": [
                {
                    "id": site.id,
                    "customer_id": site.customer_id,
                    "site_name": site.site_name,
                }
                for site in sites
            ],
        }
    )


@csrf_exempt
def service_create(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    customer_id = payload.get("customer_id")
    site_id = payload.get("site_id")

    if not customer_id or not site_id:
        return JsonResponse(
            {"success": False, "message": "Customer and site are required."},
            status=400,
        )

    customer = get_object_or_404(Customer, pk=customer_id)
    site = get_object_or_404(Site, pk=site_id, customer=customer)

    service = Service(
        customer=customer,
        site=site,
        waste_type=payload.get("waste_type", "") or "",
        bin_size=payload.get("bin_size", "") or "",
        bin_count=_clean_int(payload.get("bin_count"), default=1) or 1,
        collections_per_week=_clean_int(payload.get("collections_per_week"), default=1) or 1,
        lock_required=_clean_bool(payload.get("lock_required")),
        metal_bin_required=_clean_bool(payload.get("metal_bin_required")),
        status=payload.get("status", "active") or "active",
    )

    try:
        service.save()
    except Exception as exc:
        return JsonResponse(
            {"success": False, "message": str(exc)},
            status=400,
        )

    return JsonResponse(
        {
            "success": True,
            "message": "Service created successfully.",
            "service": serialize_service(service),
        }
    )


@csrf_exempt
def service_detail(request, service_id):
    service = get_object_or_404(Service.objects.select_related("customer", "site"), pk=service_id)

    if request.method == "GET":
        data = serialize_service(service)
        data["available_sites"] = [
            {
                "id": site.id,
                "site_name": site.site_name,
            }
            for site in Site.objects.filter(customer=service.customer).order_by("site_name")
        ]
        return JsonResponse(data)

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        customer_id = payload.get("customer_id")
        site_id = payload.get("site_id")

        if customer_id:
            service.customer = get_object_or_404(Customer, pk=customer_id)

        if site_id:
            service.site = get_object_or_404(Site, pk=site_id, customer=service.customer)

        service.waste_type = payload.get("waste_type", "") or ""
        service.bin_size = payload.get("bin_size", "") or ""
        service.bin_count = _clean_int(payload.get("bin_count"), default=1) or 1
        service.collections_per_week = _clean_int(payload.get("collections_per_week"), default=1) or 1
        service.lock_required = _clean_bool(payload.get("lock_required"))
        service.metal_bin_required = _clean_bool(payload.get("metal_bin_required"))
        service.status = payload.get("status", "active") or "active"

        try:
            service.save()
        except Exception as exc:
            return JsonResponse(
                {"success": False, "message": str(exc)},
                status=400,
            )

        data = serialize_service(service)
        data["available_sites"] = [
            {
                "id": site.id,
                "site_name": site.site_name,
            }
            for site in Site.objects.filter(customer=service.customer).order_by("site_name")
        ]

        return JsonResponse(
            {"success": True, "message": "Service updated successfully.", "service": data}
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)
