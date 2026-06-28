import json

from django.conf import settings
from django.core.mail import send_mail
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts_api.views import require_permission
from crm_email.services import send_staff_mailbox_email
from jobs.models import Job
from .models import Haulier, HaulierCoverage, HaulierPortalUser, HaulierRate


def _parse_json_body(request):
    try:
        if not request.body:
            return {}
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _require_haulier_view_access(request):
    return require_permission(request, "hauliers.view", "You do not have permission to view hauliers.")


def _require_haulier_edit_access(request):
    return require_permission(request, "hauliers.edit", "You do not have permission to edit hauliers.")


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


def _decimal_value(value, default=0):
    try:
        return float(value or default)
    except (TypeError, ValueError):
        return float(default)


def _date_or_none(value):
    if not value:
        return None
    try:
        return timezone.datetime.strptime(str(value), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def _collection_days(value):
    allowed = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
    if isinstance(value, list):
        return [day for day in value if day in allowed]
    if isinstance(value, str):
        return [day.strip().lower() for day in value.split(",") if day.strip().lower() in allowed]
    return []


def _portal_set_password_link(token):
    base_url = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    return f"{base_url}/haulier-portal/set-password/{token}"


def _send_portal_email(subject, message, recipient_list, staff_user=None):
    if staff_user:
        send_staff_mailbox_email(
            user=staff_user,
            subject=subject,
            message=message,
            to_emails=recipient_list,
        )
        return

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=recipient_list,
        fail_silently=False,
    )


def _serialize_haulier(haulier):
    return {
        "id": haulier.id,
        "name": haulier.name,
        "contact_name": haulier.contact_name,
        "email": haulier.email,
        "phone": haulier.phone,
        "emergency_phone": haulier.emergency_phone,
        "website": haulier.website,
        "address": haulier.address,
        "account_reference": haulier.account_reference,
        "payment_terms_days": haulier.payment_terms_days,
        "waste_carrier_license": haulier.waste_carrier_license,
        "environmental_permit": haulier.environmental_permit,
        "insurance_expiry": haulier.insurance_expiry.isoformat() if haulier.insurance_expiry else "",
        "sla_notes": haulier.sla_notes,
        "notes": haulier.notes,
        "active": haulier.active,
        "created_at": haulier.created_at.isoformat() if haulier.created_at else "",
        "rate_count": haulier.rates.count(),
        "coverage_count": haulier.coverage_entries.count(),
        "portal_user_count": haulier.portal_users.count(),
    }


def _serialize_rate(rate):
    return {
        "id": rate.id,
        "haulier_id": rate.haulier.id,
        "haulier_name": rate.haulier.name,
        "waste_type": rate.waste_type,
        "waste_type_label": rate.get_waste_type_display(),
        "bin_size": rate.bin_size,
        "bin_size_label": rate.get_bin_size_display(),
        "price_per_lift": _money(rate.price_per_lift),
        "weight_limit_kg": _decimal_value(rate.weight_limit_kg),
        "excess_per_kg": _money(rate.excess_per_kg),
        "active": rate.active,
        "notes": rate.notes,
        "created_at": rate.created_at.isoformat() if rate.created_at else "",
        "updated_at": rate.updated_at.isoformat() if rate.updated_at else "",
    }


def _serialize_coverage(entry):
    return {
        "id": entry.id,
        "haulier_id": entry.haulier_id,
        "haulier_name": entry.haulier.name,
        "waste_type": entry.waste_type,
        "waste_type_label": entry.get_waste_type_display(),
        "postcode_area": entry.postcode_area,
        "collection_days": entry.collection_days or [],
        "service_type": entry.service_type,
        "service_type_label": entry.get_service_type_display(),
        "lead_time_days": entry.lead_time_days,
        "minimum_lift_charge": _money(entry.minimum_lift_charge),
        "fuel_surcharge_percent": _decimal_value(entry.fuel_surcharge_percent),
        "requires_po": entry.requires_po,
        "booking_cutoff": entry.booking_cutoff,
        "vehicle_notes": entry.vehicle_notes,
        "restrictions": entry.restrictions,
        "active": entry.active,
        "created_at": entry.created_at.isoformat() if entry.created_at else "",
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else "",
    }


def _serialize_portal_user(user):
    allowed_sites = []
    try:
        allowed_sites = [
            {
                "id": entry.site.id,
                "site_name": entry.site.site_name,
                "customer_name": entry.site.customer.business_name,
            }
            for entry in user.site_access_entries.select_related("site", "site__customer").all()
        ]
    except Exception:
        allowed_sites = []

    return {
        "id": user.id,
        "haulier_id": user.haulier_id,
        "haulier_name": user.haulier.name,
        "full_name": user.full_name,
        "email": user.email,
        "is_active": user.is_active,
        "must_set_password": user.must_set_password,
        "can_view_all_sites": user.can_view_all_sites,
        "notes": user.notes,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else "",
        "created_at": user.created_at.isoformat() if user.created_at else "",
        "allowed_sites": allowed_sites,
    }


def _serialize_portal_job(job, request=None):
    evidence_image_url = ""
    if getattr(job, "evidence_image", None):
        try:
            evidence_image_url = job.evidence_image.url
            if request is not None:
                evidence_image_url = request.build_absolute_uri(evidence_image_url)
        except Exception:
            evidence_image_url = ""

    return {
        "id": job.id,
        "service_id": job.service_id,
        "customer_id": job.customer_id,
        "customer": job.customer.business_name if job.customer_id else "",
        "site_id": job.site_id,
        "site": job.site.site_name if job.site_id else "",
        "date": job.collection_date.isoformat() if job.collection_date else "",
        "waste_type": job.waste_type or "",
        "bin_size": job.bin_size or "",
        "bin_quantity": job.bin_quantity or 0,
        "bin": f"{job.bin_quantity} x {job.bin_size}L" if job.bin_quantity and job.bin_size else "",
        "status": job.status or "",
        "haulier": job.haulier or "",
        "failure_reason": job.failure_reason or "",
        "failure_notes": job.failure_notes or "",
        "notes": job.notes or "",
        "rescheduled_to": job.rescheduled_to.isoformat() if job.rescheduled_to else "",
        "status_updated_by": job.status_updated_by or "",
        "status_updated_by_email": getattr(job, "status_updated_by_email", "") or "",
        "status_updated_source": getattr(job, "status_updated_source", "") or "",
        "status_updated_at": job.status_updated_at.isoformat() if job.status_updated_at else "",
        "completed_at": job.completed_at.isoformat() if job.completed_at else "",
        "evidence_image_url": evidence_image_url,
    }


def _get_portal_user_from_request(request, data=None):
    email = (request.GET.get("email") or "").strip()

    if not email and data and isinstance(data, dict):
        email = (data.get("email") or "").strip()

    if not email:
        return None

    return (
        HaulierPortalUser.objects.select_related("haulier")
        .filter(email__iexact=email, is_active=True, haulier__active=True)
        .first()
    )


@csrf_exempt
def hauliers_list(request):
    if request.method == "GET":
        _, error_response = _require_haulier_view_access(request)
        if error_response:
            return error_response

        hauliers = Haulier.objects.all().order_by("name")
        return JsonResponse([_serialize_haulier(haulier) for haulier in hauliers], safe=False)

    if request.method == "POST":
        staff_user, error_response = _require_haulier_edit_access(request)
        if error_response:
            return error_response

        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        name = (data.get("name") or "").strip()
        if not name:
            return JsonResponse({"success": False, "message": "Haulier name is required."}, status=400)

        if Haulier.objects.filter(name__iexact=name).exists():
            return JsonResponse({"success": False, "message": "A haulier with that name already exists."}, status=400)

        haulier = Haulier.objects.create(
            name=name,
            contact_name=(data.get("contact_name") or "").strip(),
            email=(data.get("email") or "").strip(),
            phone=(data.get("phone") or "").strip(),
            emergency_phone=(data.get("emergency_phone") or "").strip(),
            website=(data.get("website") or "").strip(),
            address=(data.get("address") or "").strip(),
            account_reference=(data.get("account_reference") or "").strip(),
            payment_terms_days=int(data.get("payment_terms_days") or 30),
            waste_carrier_license=(data.get("waste_carrier_license") or "").strip(),
            environmental_permit=(data.get("environmental_permit") or "").strip(),
            insurance_expiry=_date_or_none(data.get("insurance_expiry")),
            sla_notes=(data.get("sla_notes") or "").strip(),
            notes=(data.get("notes") or "").strip(),
            active=_bool_value(data.get("active", True)),
        )

        return JsonResponse(
            {
                "success": True,
                "message": "Haulier created successfully.",
                "haulier": _serialize_haulier(haulier),
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def haulier_detail(request, haulier_id):
    haulier = Haulier.objects.filter(id=haulier_id).first()

    if not haulier:
        return JsonResponse({"success": False, "message": "Haulier not found."}, status=404)

    if request.method == "GET":
        _, error_response = _require_haulier_view_access(request)
        if error_response:
            return error_response
        return JsonResponse(_serialize_haulier(haulier))

    if request.method == "POST":
        staff_user, error_response = _require_haulier_edit_access(request)
        if error_response:
            return error_response

        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        name = (data.get("name") or "").strip()
        if not name:
            return JsonResponse({"success": False, "message": "Haulier name is required."}, status=400)

        if Haulier.objects.exclude(id=haulier.id).filter(name__iexact=name).exists():
            return JsonResponse({"success": False, "message": "A haulier with that name already exists."}, status=400)

        haulier.name = name
        haulier.contact_name = (data.get("contact_name") or "").strip()
        haulier.email = (data.get("email") or "").strip()
        haulier.phone = (data.get("phone") or "").strip()
        haulier.emergency_phone = (data.get("emergency_phone") or "").strip()
        haulier.website = (data.get("website") or "").strip()
        haulier.address = (data.get("address") or "").strip()
        haulier.account_reference = (data.get("account_reference") or "").strip()
        haulier.payment_terms_days = int(data.get("payment_terms_days") or 30)
        haulier.waste_carrier_license = (data.get("waste_carrier_license") or "").strip()
        haulier.environmental_permit = (data.get("environmental_permit") or "").strip()
        haulier.insurance_expiry = _date_or_none(data.get("insurance_expiry"))
        haulier.sla_notes = (data.get("sla_notes") or "").strip()
        haulier.notes = (data.get("notes") or "").strip()
        haulier.active = _bool_value(data.get("active", True))
        haulier.save()

        return JsonResponse(
            {
                "success": True,
                "message": "Haulier updated successfully.",
                "haulier": _serialize_haulier(haulier),
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def haulier_coverage_list(request):
    if request.method == "GET":
        _, error_response = _require_haulier_view_access(request)
        if error_response:
            return error_response

        haulier_id = request.GET.get("haulier_id")
        entries = HaulierCoverage.objects.select_related("haulier").all()

        if haulier_id and haulier_id != "all":
            entries = entries.filter(haulier_id=haulier_id)

        return JsonResponse([_serialize_coverage(entry) for entry in entries], safe=False)

    if request.method == "POST":
        staff_user, error_response = _require_haulier_edit_access(request)
        if error_response:
            return error_response

        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        haulier_id = data.get("haulier_id")
        waste_type = (data.get("waste_type") or "").strip()
        postcode_area = (data.get("postcode_area") or "").strip().upper()

        if not haulier_id:
            return JsonResponse({"success": False, "message": "Haulier is required."}, status=400)
        if not waste_type:
            return JsonResponse({"success": False, "message": "Waste stream is required."}, status=400)
        if not postcode_area:
            return JsonResponse({"success": False, "message": "Postcode area is required."}, status=400)

        haulier = Haulier.objects.filter(id=haulier_id).first()
        if not haulier:
            return JsonResponse({"success": False, "message": "Haulier not found."}, status=404)

        entry = HaulierCoverage.objects.create(
            haulier=haulier,
            waste_type=waste_type,
            postcode_area=postcode_area,
            collection_days=_collection_days(data.get("collection_days")),
            service_type=(data.get("service_type") or "scheduled").strip(),
            lead_time_days=int(data.get("lead_time_days") or 2),
            minimum_lift_charge=data.get("minimum_lift_charge") or 0,
            fuel_surcharge_percent=data.get("fuel_surcharge_percent") or 0,
            requires_po=_bool_value(data.get("requires_po", False)),
            booking_cutoff=(data.get("booking_cutoff") or "").strip(),
            vehicle_notes=(data.get("vehicle_notes") or "").strip(),
            restrictions=(data.get("restrictions") or "").strip(),
            active=_bool_value(data.get("active", True)),
        )

        return JsonResponse(
            {
                "success": True,
                "message": "Haulier coverage added.",
                "coverage": _serialize_coverage(entry),
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def haulier_coverage_detail(request, coverage_id):
    entry = HaulierCoverage.objects.select_related("haulier").filter(id=coverage_id).first()

    if not entry:
        return JsonResponse({"success": False, "message": "Coverage entry not found."}, status=404)

    if request.method == "GET":
        _, error_response = _require_haulier_view_access(request)
        if error_response:
            return error_response
        return JsonResponse(_serialize_coverage(entry))

    if request.method == "POST":
        _, error_response = _require_haulier_edit_access(request)
        if error_response:
            return error_response

        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        haulier_id = data.get("haulier_id")
        haulier = Haulier.objects.filter(id=haulier_id).first()
        if not haulier:
            return JsonResponse({"success": False, "message": "Haulier not found."}, status=404)

        postcode_area = (data.get("postcode_area") or "").strip().upper()
        waste_type = (data.get("waste_type") or "").strip()
        if not postcode_area or not waste_type:
            return JsonResponse({"success": False, "message": "Postcode area and waste stream are required."}, status=400)

        entry.haulier = haulier
        entry.waste_type = waste_type
        entry.postcode_area = postcode_area
        entry.collection_days = _collection_days(data.get("collection_days"))
        entry.service_type = (data.get("service_type") or "scheduled").strip()
        entry.lead_time_days = int(data.get("lead_time_days") or 2)
        entry.minimum_lift_charge = data.get("minimum_lift_charge") or 0
        entry.fuel_surcharge_percent = data.get("fuel_surcharge_percent") or 0
        entry.requires_po = _bool_value(data.get("requires_po", False))
        entry.booking_cutoff = (data.get("booking_cutoff") or "").strip()
        entry.vehicle_notes = (data.get("vehicle_notes") or "").strip()
        entry.restrictions = (data.get("restrictions") or "").strip()
        entry.active = _bool_value(data.get("active", True))
        entry.save()

        return JsonResponse(
            {
                "success": True,
                "message": "Haulier coverage updated.",
                "coverage": _serialize_coverage(entry),
            }
        )

    if request.method == "DELETE":
        _, error_response = _require_haulier_edit_access(request)
        if error_response:
            return error_response
        entry.delete()
        return JsonResponse({"success": True, "message": "Haulier coverage removed."})

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def haulier_rates_list(request):
    if request.method == "GET":
        _, error_response = _require_haulier_view_access(request)
        if error_response:
            return error_response

        haulier_id = request.GET.get("haulier_id")
        rates = HaulierRate.objects.select_related("haulier").all().order_by("haulier__name", "waste_type", "bin_size")

        if haulier_id:
            rates = rates.filter(haulier_id=haulier_id)

        return JsonResponse([_serialize_rate(rate) for rate in rates], safe=False)

    if request.method == "POST":
        _, error_response = _require_haulier_edit_access(request)
        if error_response:
            return error_response

        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        haulier_id = data.get("haulier_id")
        waste_type = (data.get("waste_type") or "").strip()
        bin_size = str(data.get("bin_size") or "").strip()

        if not haulier_id:
            return JsonResponse({"success": False, "message": "Haulier is required."}, status=400)

        if not waste_type:
            return JsonResponse({"success": False, "message": "Waste type is required."}, status=400)

        if not bin_size:
            return JsonResponse({"success": False, "message": "Bin size is required."}, status=400)

        haulier = Haulier.objects.filter(id=haulier_id).first()
        if not haulier:
            return JsonResponse({"success": False, "message": "Haulier not found."}, status=404)

        if HaulierRate.objects.filter(haulier=haulier, waste_type=waste_type, bin_size=bin_size).exists():
            return JsonResponse(
                {"success": False, "message": "That haulier already has a rate for this waste type and bin size."},
                status=400,
            )

        rate = HaulierRate.objects.create(
            haulier=haulier,
            waste_type=waste_type,
            bin_size=bin_size,
            price_per_lift=data.get("price_per_lift") or 0,
            weight_limit_kg=data.get("weight_limit_kg") or 0,
            excess_per_kg=data.get("excess_per_kg") or 0,
            active=_bool_value(data.get("active", True)),
            notes=(data.get("notes") or "").strip(),
        )

        return JsonResponse(
            {
                "success": True,
                "message": "Haulier rate created successfully.",
                "rate": _serialize_rate(rate),
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def haulier_rate_detail(request, rate_id):
    rate = HaulierRate.objects.select_related("haulier").filter(id=rate_id).first()

    if not rate:
        return JsonResponse({"success": False, "message": "Rate not found."}, status=404)

    if request.method == "GET":
        _, error_response = _require_haulier_view_access(request)
        if error_response:
            return error_response
        return JsonResponse(_serialize_rate(rate))

    if request.method == "POST":
        _, error_response = _require_haulier_edit_access(request)
        if error_response:
            return error_response

        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        haulier_id = data.get("haulier_id")
        waste_type = (data.get("waste_type") or "").strip()
        bin_size = str(data.get("bin_size") or "").strip()

        if not haulier_id:
            return JsonResponse({"success": False, "message": "Haulier is required."}, status=400)

        if not waste_type:
            return JsonResponse({"success": False, "message": "Waste type is required."}, status=400)

        if not bin_size:
            return JsonResponse({"success": False, "message": "Bin size is required."}, status=400)

        haulier = Haulier.objects.filter(id=haulier_id).first()
        if not haulier:
            return JsonResponse({"success": False, "message": "Haulier not found."}, status=404)

        duplicate = HaulierRate.objects.exclude(id=rate.id).filter(
            haulier=haulier,
            waste_type=waste_type,
            bin_size=bin_size,
        )
        if duplicate.exists():
            return JsonResponse(
                {"success": False, "message": "That haulier already has a rate for this waste type and bin size."},
                status=400,
            )

        rate.haulier = haulier
        rate.waste_type = waste_type
        rate.bin_size = bin_size
        rate.price_per_lift = data.get("price_per_lift") or 0
        rate.weight_limit_kg = data.get("weight_limit_kg") or 0
        rate.excess_per_kg = data.get("excess_per_kg") or 0
        rate.active = _bool_value(data.get("active", True))
        rate.notes = (data.get("notes") or "").strip()
        rate.save()

        return JsonResponse(
            {
                "success": True,
                "message": "Haulier rate updated successfully.",
                "rate": _serialize_rate(rate),
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def portal_users_list(request):
    if request.method == "GET":
        _, error_response = _require_haulier_view_access(request)
        if error_response:
            return error_response

        haulier_id = request.GET.get("haulier_id")
        users = HaulierPortalUser.objects.select_related("haulier").all().order_by("haulier__name", "full_name", "email")

        if haulier_id and haulier_id != "all":
            users = users.filter(haulier_id=haulier_id)

        return JsonResponse([_serialize_portal_user(user) for user in users], safe=False)

    if request.method == "POST":
        staff_user, error_response = _require_haulier_edit_access(request)
        if error_response:
            return error_response

        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        full_name = (data.get("full_name") or "").strip()
        email = (data.get("email") or "").strip()
        haulier_id = data.get("haulier_id")
        can_view_all_sites = _bool_value(data.get("can_view_all_sites", True))
        notes = (data.get("notes") or "").strip()

        if not full_name:
            return JsonResponse({"success": False, "message": "Full name is required."}, status=400)

        if not email:
            return JsonResponse({"success": False, "message": "Email is required."}, status=400)

        if not haulier_id:
            return JsonResponse({"success": False, "message": "Haulier is required."}, status=400)

        haulier = Haulier.objects.filter(id=haulier_id, active=True).first()
        if not haulier:
            return JsonResponse({"success": False, "message": "Haulier not found."}, status=404)

        if HaulierPortalUser.objects.filter(email__iexact=email).exists():
            return JsonResponse({"success": False, "message": "A portal user with that email already exists."}, status=400)

        user = HaulierPortalUser.objects.create(
            haulier=haulier,
            full_name=full_name,
            email=email,
            is_active=True,
            must_set_password=True,
            can_view_all_sites=can_view_all_sites,
            notes=notes,
        )

        user.create_password_token(hours=24)

        link = _portal_set_password_link(user.password_reset_token)

        _send_portal_email(
            subject="Create your Recyclr Haulier Portal password",
            message=(
                f"Hello {user.full_name},\n\n"
                "Your Recyclr Haulier Portal account has been created.\n\n"
                f"Create your password here:\n{link}\n\n"
                "This link expires in 24 hours."
            ),
            recipient_list=[user.email],
            staff_user=staff_user,
        )

        return JsonResponse(
            {
                "success": True,
                "message": "Portal user created and setup email sent.",
                "user": _serialize_portal_user(user),
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def portal_user_detail(request, user_id):
    user = HaulierPortalUser.objects.select_related("haulier").filter(id=user_id).first()

    if not user:
        return JsonResponse({"success": False, "message": "Portal user not found."}, status=404)

    if request.method == "POST":
        _, error_response = _require_haulier_edit_access(request)
        if error_response:
            return error_response

        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        full_name = (data.get("full_name") or "").strip()
        email = (data.get("email") or "").strip()
        can_view_all_sites = _bool_value(data.get("can_view_all_sites", True))
        is_active = _bool_value(data.get("is_active", True))
        notes = (data.get("notes") or "").strip()

        if not full_name:
            return JsonResponse({"success": False, "message": "Full name is required."}, status=400)

        if not email:
            return JsonResponse({"success": False, "message": "Email is required."}, status=400)

        if HaulierPortalUser.objects.exclude(id=user.id).filter(email__iexact=email).exists():
            return JsonResponse({"success": False, "message": "A portal user with that email already exists."}, status=400)

        user.full_name = full_name
        user.email = email
        user.can_view_all_sites = can_view_all_sites
        user.is_active = is_active
        user.notes = notes
        user.save()

        return JsonResponse(
            {
                "success": True,
                "message": "Portal user updated successfully.",
                "user": _serialize_portal_user(user),
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def portal_user_resend_setup(request, user_id):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    staff_user, error_response = _require_haulier_edit_access(request)
    if error_response:
        return error_response

    user = HaulierPortalUser.objects.select_related("haulier").filter(id=user_id, is_active=True).first()
    if not user:
        return JsonResponse({"success": False, "message": "Portal user not found."}, status=404)

    user.create_password_token(hours=24)

    link = _portal_set_password_link(user.password_reset_token)

    _send_portal_email(
        subject="Create your Recyclr Haulier Portal password",
        message=(
            f"Hello {user.full_name},\n\n"
            "Here is your new Recyclr Haulier Portal password setup link.\n\n"
            f"Create your password here:\n{link}\n\n"
            "This link expires in 24 hours."
        ),
        recipient_list=[user.email],
        staff_user=staff_user,
    )

    return JsonResponse({"success": True, "message": "Setup email re-sent."})


@csrf_exempt
def portal_login(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    data = _parse_json_body(request)
    if data is None:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not email or not password:
        return JsonResponse({"success": False, "message": "Email and password are required."}, status=400)

    try:
        user = HaulierPortalUser.objects.select_related("haulier").get(
            email__iexact=email,
            is_active=True,
            haulier__active=True,
        )
    except HaulierPortalUser.DoesNotExist:
        return JsonResponse({"success": False, "message": "Invalid email or password."}, status=401)

    if not user.check_password(password):
        return JsonResponse({"success": False, "message": "Invalid email or password."}, status=401)

    user.last_login_at = timezone.now()
    user.save(update_fields=["last_login_at"])

    return JsonResponse(
        {
            "success": True,
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "haulier_name": user.haulier.name,
                "must_set_password": user.must_set_password,
                "can_view_all_sites": user.can_view_all_sites,
                "allowed_sites": [],
                "last_login_at": user.last_login_at.isoformat() if user.last_login_at else "",
            },
        }
    )


@csrf_exempt
def portal_jobs(request):
    if request.method == "OPTIONS":
        return JsonResponse({"success": True})

    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    portal_user = _get_portal_user_from_request(request)
    if not portal_user:
        return JsonResponse({"success": False, "message": "Portal user not found."}, status=404)

    jobs = (
        Job.objects.select_related("customer", "site")
        .filter(haulier__iexact=portal_user.haulier.name)
        .order_by("collection_date", "id")
    )

    if portal_user.can_view_all_sites is False:
        allowed_site_ids = list(portal_user.site_access_entries.values_list("site_id", flat=True))
        jobs = jobs.filter(site_id__in=allowed_site_ids)

    rows = [_serialize_portal_job(job, request=request) for job in jobs]

    today = timezone.localdate().isoformat()

    summary = {
        "total": len(rows),
        "scheduled": len([row for row in rows if row["status"] == "scheduled"]),
        "collected": len([row for row in rows if row["status"] == "collected"]),
        "failed": len([row for row in rows if row["status"] == "failed"]),
        "today": len([row for row in rows if row["date"] == today]),
        "upcoming": len([row for row in rows if row["status"] == "scheduled" and row["date"] >= today]),
    }

    return JsonResponse(
        {
            "success": True,
            "user": _serialize_portal_user(portal_user),
            "summary": summary,
            "rows": rows,
        }
    )


@csrf_exempt
def portal_update_job(request, job_id):
    if request.method == "OPTIONS":
        return JsonResponse({"success": True})

    data = None
    portal_user = None

    if request.content_type and "multipart/form-data" in request.content_type:
        email = (request.POST.get("email") or "").strip()
        if email:
            portal_user = (
                HaulierPortalUser.objects.select_related("haulier")
                .filter(email__iexact=email, is_active=True, haulier__active=True)
                .first()
            )
        reason = (request.POST.get("reason") or "").strip()
        failure_notes = (request.POST.get("failure_notes") or "").strip()
        status = (request.POST.get("status") or "").strip()
        evidence_image = request.FILES.get("evidence_image")
    else:
        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)
        portal_user = _get_portal_user_from_request(request, data=data)
        reason = (data.get("reason") or "").strip()
        failure_notes = (data.get("failure_notes") or "").strip()
        status = (data.get("status") or "").strip()
        evidence_image = None

    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    if not portal_user:
        return JsonResponse({"success": False, "message": "Portal user not found."}, status=404)

    job = (
        Job.objects.select_related("customer", "site")
        .filter(id=job_id, haulier__iexact=portal_user.haulier.name)
        .first()
    )

    if not job:
        return JsonResponse({"success": False, "message": "Job not found."}, status=404)

    if status not in ["collected", "failed"]:
        return JsonResponse({"success": False, "message": "Invalid status."}, status=400)

    job.status = status
    job.status_updated_by = portal_user.full_name
    if hasattr(job, "status_updated_by_email"):
        job.status_updated_by_email = portal_user.email
    if hasattr(job, "status_updated_source"):
        job.status_updated_source = "haulier_portal"
    if hasattr(job, "status_updated_by_portal_user"):
        job.status_updated_by_portal_user = portal_user

    job.status_updated_at = timezone.now()

    if status == "collected":
        job.failure_reason = ""
        job.failure_notes = ""
        job.completed_at = timezone.now()
    else:
        job.failure_reason = reason or "other"
        job.failure_notes = failure_notes or ""
        if evidence_image:
            job.evidence_image = evidence_image

    job.save()

    return JsonResponse(
        {
            "success": True,
            "message": "Job updated successfully.",
            "job": _serialize_portal_job(job, request=request),
        }
    )


@csrf_exempt
def set_password(request, token):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    data = _parse_json_body(request)
    if data is None:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not password:
        return JsonResponse({"success": False, "message": "Password is required."}, status=400)

    if len(password) < 8:
        return JsonResponse({"success": False, "message": "Password must be at least 8 characters."}, status=400)

    if password != confirm_password:
        return JsonResponse({"success": False, "message": "Passwords do not match."}, status=400)

    try:
        user = HaulierPortalUser.objects.get(password_reset_token=token)
    except HaulierPortalUser.DoesNotExist:
        return JsonResponse({"success": False, "message": "Invalid link."}, status=400)

    if not user.token_valid(token):
        return JsonResponse({"success": False, "message": "This link has expired."}, status=400)

    user.set_password(password)
    user.password_reset_token = None
    user.password_reset_expires = None
    user.must_set_password = False
    user.save()

    return JsonResponse({"success": True, "message": "Password set successfully."})


@csrf_exempt
def forgot_password(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    data = _parse_json_body(request)
    if data is None:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    email = (data.get("email") or "").strip()
    if not email:
        return JsonResponse({"success": False, "message": "Email is required."}, status=400)

    try:
        user = HaulierPortalUser.objects.get(email__iexact=email, is_active=True)
        user.create_password_token(hours=2)

        link = _portal_set_password_link(user.password_reset_token)

        _send_portal_email(
            subject="Reset your Recyclr Haulier Portal password",
            message=(
                f"Hello {user.full_name},\n\n"
                "You requested a password reset for your Recyclr Haulier Portal account.\n\n"
                f"Reset your password here:\n{link}\n\n"
                "This link expires in 2 hours."
            ),
            recipient_list=[user.email],
        )
    except HaulierPortalUser.DoesNotExist:
        pass

    return JsonResponse(
        {
            "success": True,
            "message": "If that email exists, a reset link has been sent.",
        }
    )
