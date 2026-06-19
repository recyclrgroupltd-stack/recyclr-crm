import json
from datetime import date

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from hauliers.models import Haulier
from jobs.models import Job
from .models import Service


def _parse_json_body(request):
    try:
        if not request.body:
            return {}
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _get_collection_day_choices():
    if hasattr(Service, "COLLECTION_DAY_CHOICES"):
        return list(Service.COLLECTION_DAY_CHOICES)
    if hasattr(Service, "DAY_OF_WEEK_CHOICES"):
        return list(Service.DAY_OF_WEEK_CHOICES)
    return [
        ("monday", "Monday"),
        ("tuesday", "Tuesday"),
        ("wednesday", "Wednesday"),
        ("thursday", "Thursday"),
        ("friday", "Friday"),
        ("saturday", "Saturday"),
        ("sunday", "Sunday"),
    ]


def _get_schedule_type_choices():
    if hasattr(Service, "SCHEDULE_TYPE_CHOICES"):
        return list(Service.SCHEDULE_TYPE_CHOICES)
    return [
        ("weekly", "Weekly"),
        ("fortnightly", "Fortnightly"),
        ("on_request", "On Request"),
    ]


def _normalise_collection_days(value):
    valid_days = {choice[0] for choice in _get_collection_day_choices()}

    if value is None:
        return []

    raw_days = []

    if isinstance(value, list):
        raw_days = value
    elif isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []
        raw_days = stripped.split(",")
    else:
        return []

    result = []
    for item in raw_days:
        day = str(item).strip().lower()
        if day and day in valid_days and day not in result:
            result.append(day)
    return result


def _collection_days_label(days):
    day_map = dict(_get_collection_day_choices())
    return ", ".join(day_map.get(day, str(day).title()) for day in days if day)


def _get_start_date_value(service):
    value = getattr(service, "schedule_start_date", None)
    if value is None:
        value = getattr(service, "start_date", None)
    return value


def _get_notes_value(service):
    return getattr(service, "notes", "") or ""


def _get_updated_at_value(service):
    return getattr(service, "updated_at", None)


def _get_service_readiness(service, collection_days, start_date, upcoming_jobs):
    from containers.models import Container
    from documents.models import SigningPack

    containers = service.containers.exclude(status=Container.STATUS_EOL)
    assigned_container_count = containers.filter(status=Container.STATUS_ASSIGNED).count()
    active_container_count = containers.filter(status=Container.STATUS_ACTIVE).count()
    container_count = assigned_container_count + active_container_count
    required_container_count = max(int(getattr(service, "bin_count", 0) or 0), 0)

    signed_documents = SigningPack.objects.filter(
        customer=service.customer,
        site=service.site,
        status="signed",
    ).exists()

    scheduled_service = getattr(service, "schedule_type", "") != "on_request"
    checks = [
        {
            "key": "signed_documents",
            "label": "Documents signed",
            "ok": signed_documents,
            "missing": "Signed onboarding documents",
        },
        {
            "key": "haulier",
            "label": "Haulier assigned",
            "ok": bool(getattr(service, "haulier_id", None)),
            "missing": "Assigned haulier",
        },
        {
            "key": "start_date",
            "label": "Start date set",
            "ok": bool(start_date) or not scheduled_service,
            "missing": "Schedule start date",
        },
        {
            "key": "collection_days",
            "label": "Collection days set",
            "ok": bool(collection_days) or not scheduled_service,
            "missing": "Collection day(s)",
        },
        {
            "key": "containers",
            "label": "Containers assigned",
            "ok": container_count >= required_container_count,
            "missing": "Assigned container(s)",
        },
    ]

    warnings = []
    if service.status == Service.STATUS_ACTIVE and scheduled_service and upcoming_jobs == 0:
        warnings.append("Active service has no upcoming scheduled jobs.")
    if active_container_count < required_container_count and assigned_container_count:
        warnings.append("Containers are assigned but not marked active/delivered yet.")

    passed = len([check for check in checks if check["ok"]])
    missing = [check["missing"] for check in checks if not check["ok"]]

    return {
        "is_ready": not missing,
        "score": passed,
        "total": len(checks),
        "missing": missing,
        "warnings": warnings,
        "checks": [{"key": check["key"], "label": check["label"], "ok": check["ok"]} for check in checks],
        "container_count": container_count,
        "active_container_count": active_container_count,
        "assigned_container_count": assigned_container_count,
        "required_container_count": required_container_count,
        "signed_documents": signed_documents,
    }


def _serialize_service(service):
    collection_days = _normalise_collection_days(getattr(service, "collection_days", []))
    start_date = _get_start_date_value(service)
    updated_at = _get_updated_at_value(service)
    site_address_parts = []
    if getattr(service, "site_id", None):
        site_address_parts = [
            service.site.address_line_1,
            service.site.address_line_2,
            service.site.town,
            service.site.county,
            service.site.postcode,
        ]
    site_address = ", ".join([part for part in site_address_parts if part])

    account_manager = getattr(service.customer, "account_manager", None) if getattr(service, "customer_id", None) else None
    account_manager_name = ""
    if account_manager:
        account_manager_name = (
            getattr(account_manager, "get_full_name", lambda: "")()
            or getattr(account_manager, "username", "")
        )

    upcoming_jobs = 0
    next_job_date = ""
    if getattr(service, "id", None):
        upcoming_qs = Job.objects.filter(
            service=service,
            collection_date__gte=date.today(),
            status="scheduled",
        ).order_by("collection_date", "id")
        upcoming_jobs = upcoming_qs.count()
        next_job = upcoming_qs.first()
        next_job_date = next_job.collection_date.isoformat() if next_job else ""

    readiness = _get_service_readiness(service, collection_days, start_date, upcoming_jobs)

    return {
        "id": service.id,
        "customer_id": service.customer.id if getattr(service, "customer_id", None) else None,
        "customer_uid": service.customer.customer_uid if getattr(service, "customer_id", None) else "",
        "customer_name": service.customer.business_name if getattr(service, "customer_id", None) else "",
        "account_manager": account_manager_name,
        "site_id": service.site.id if getattr(service, "site_id", None) else None,
        "site_name": service.site.site_name if getattr(service, "site_id", None) else "",
        "site_address": site_address,
        "site_postcode": service.site.postcode if getattr(service, "site_id", None) else "",
        "waste_type": service.waste_type,
        "waste_type_label": service.get_waste_type_display() if hasattr(service, "get_waste_type_display") else service.waste_type,
        "bin_size": service.bin_size,
        "bin_size_label": service.get_bin_size_display() if hasattr(service, "get_bin_size_display") else f"{service.bin_size}L",
        "bin_count": getattr(service, "bin_count", 1),
        "collections_per_week": getattr(service, "collections_per_week", 1),
        "lock_required": getattr(service, "lock_required", False),
        "metal_bin_required": getattr(service, "metal_bin_required", False),
        "status": service.status,
        "status_label": service.get_status_display() if hasattr(service, "get_status_display") else service.status,
        "haulier_id": service.haulier.id if getattr(service, "haulier_id", None) else None,
        "haulier_name": service.haulier.name if getattr(service, "haulier_id", None) else "",
        "schedule_type": getattr(service, "schedule_type", "") or "",
        "schedule_type_label": dict(_get_schedule_type_choices()).get(getattr(service, "schedule_type", ""), ""),
        "collection_days": collection_days,
        "collection_days_label": _collection_days_label(collection_days),
        "start_date": str(start_date) if start_date else "",
        "price_per_lift": float(getattr(service, "price_per_lift", 0) or 0),
        "monthly_value": float(getattr(service, "monthly_value", 0) or 0),
        "upcoming_jobs": upcoming_jobs,
        "next_job_date": next_job_date,
        "readiness": readiness,
        "container_count": readiness["container_count"],
        "active_container_count": readiness["active_container_count"],
        "assigned_container_count": readiness["assigned_container_count"],
        "required_container_count": readiness["required_container_count"],
        "signed_documents": readiness["signed_documents"],
        "notes": _get_notes_value(service),
        "created_at": service.created_at.isoformat() if getattr(service, "created_at", None) else "",
        "updated_at": updated_at.isoformat() if updated_at else "",
    }


def _service_filters_payload():
    status_choices = list(getattr(Service, "STATUS_CHOICES", []))
    if not status_choices:
        status_choices = [
            ("pending_schedule", "Pending Schedule"),
            ("active", "Active"),
            ("paused", "Paused"),
            ("ended", "Ended"),
        ]

    return {
        "statuses": [{"value": value, "label": label} for value, label in status_choices],
        "schedule_types": [{"value": value, "label": label} for value, label in _get_schedule_type_choices()],
        "days": [{"value": value, "label": label} for value, label in _get_collection_day_choices()],
    }


@csrf_exempt
def services_list(request):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    search = (request.GET.get("search") or "").strip().lower()
    status = (request.GET.get("status") or "").strip()
    haulier_id = (request.GET.get("haulier_id") or "").strip()

    services = Service.objects.select_related("customer", "customer__account_manager", "site", "haulier").all().order_by("-id")

    if status and status != "all":
        services = services.filter(status=status)

    if haulier_id and haulier_id != "all":
        services = services.filter(haulier_id=haulier_id)

    rows = [_serialize_service(service) for service in services]

    if search:
        rows = [
            row
            for row in rows
            if search in " ".join(
                [
                    row["customer_name"],
                    row["customer_uid"],
                    row["account_manager"],
                    row["site_name"],
                    row["site_address"],
                    row["site_postcode"],
                    row["waste_type_label"],
                    row["bin_size_label"],
                    row["status_label"],
                    row["haulier_name"],
                    row["collection_days_label"],
                    row["notes"],
                ]
            ).lower()
        ]

    def count_status(value):
        return len([row for row in rows if row["status"] == value])

    return JsonResponse(
        {
            "success": True,
            "summary": {
                "total": len(rows),
                "pending_schedule": count_status("pending_schedule"),
                "active": count_status("active"),
                "paused": count_status("paused"),
                "ended": count_status("ended"),
            },
            "filters": _service_filters_payload(),
            "rows": rows,
        }
    )


@csrf_exempt
def service_detail(request, service_id):
    service = (
        Service.objects.select_related("customer", "customer__account_manager", "site", "haulier")
        .filter(id=service_id)
        .first()
    )

    if not service:
        return JsonResponse({"success": False, "message": "Service not found."}, status=404)

    if request.method == "GET":
        return JsonResponse(
            {
                "success": True,
                "service": _serialize_service(service),
                "filters": _service_filters_payload(),
            }
        )

    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    payload = _parse_json_body(request)
    if payload is None:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    customer_id = payload.get("customer_id", getattr(service, "customer_id", None))
    site_id = payload.get("site_id", getattr(service, "site_id", None))
    haulier_id = payload.get("haulier_id", getattr(service, "haulier_id", None))
    waste_type = (payload.get("waste_type") or getattr(service, "waste_type", "") or "").strip()
    bin_size = (str(payload.get("bin_size") or getattr(service, "bin_size", "") or "")).strip()
    bin_count = payload.get("bin_count", getattr(service, "bin_count", 1))
    lock_required = bool(payload.get("lock_required", getattr(service, "lock_required", False)))
    metal_bin_required = bool(payload.get("metal_bin_required", getattr(service, "metal_bin_required", False)))
    schedule_type = (payload.get("schedule_type") or getattr(service, "schedule_type", "") or "").strip()
    collection_days = _normalise_collection_days(payload.get("collection_days", getattr(service, "collection_days", [])))
    collections_per_week = payload.get("collections_per_week", getattr(service, "collections_per_week", 1))
    start_date = payload.get("start_date")
    status = (payload.get("status") or getattr(service, "status", "") or "").strip()
    notes = str(payload.get("notes", _get_notes_value(service))).strip()

    valid_statuses = {choice[0] for choice in getattr(Service, "STATUS_CHOICES", [])}
    if valid_statuses and status not in valid_statuses:
        return JsonResponse({"success": False, "message": "Invalid service status."}, status=400)

    valid_schedule_types = {choice[0] for choice in _get_schedule_type_choices()}
    if schedule_type and schedule_type not in valid_schedule_types:
        return JsonResponse({"success": False, "message": "Invalid schedule type."}, status=400)

    try:
        collections_per_week = max(int(collections_per_week), 1)
        bin_count = max(int(bin_count), 1)
    except (TypeError, ValueError):
        return JsonResponse({"success": False, "message": "Bin count and collections per week must be whole numbers."}, status=400)

    if len(collection_days) > collections_per_week:
        return JsonResponse(
            {
                "success": False,
                "message": f"You can only select up to {collections_per_week} collection day(s) for this service.",
            },
            status=400,
        )

    if customer_id and customer_id != service.customer_id:
        from customers.models import Customer

        customer = Customer.objects.filter(id=customer_id).first()
        if not customer:
            return JsonResponse({"success": False, "message": "Customer not found."}, status=404)
        service.customer = customer

    if site_id and site_id != service.site_id:
        from customers.models import Site

        site = Site.objects.filter(id=site_id, customer=service.customer).first()
        if not site:
            return JsonResponse({"success": False, "message": "Site not found for this customer."}, status=404)
        service.site = site

    if haulier_id in ["", None]:
        service.haulier = None
    else:
        haulier = Haulier.objects.filter(id=haulier_id, active=True).first()
        if not haulier:
            return JsonResponse({"success": False, "message": "Haulier not found."}, status=404)
        service.haulier = haulier

    service.waste_type = waste_type or service.waste_type
    service.bin_size = bin_size or service.bin_size
    service.bin_count = bin_count
    service.lock_required = lock_required
    service.metal_bin_required = metal_bin_required
    service.schedule_type = schedule_type or getattr(service, "schedule_type", "weekly")
    service.collections_per_week = collections_per_week
    service.collection_days = collection_days

    if hasattr(service, "schedule_start_date"):
        service.schedule_start_date = start_date or None
    elif hasattr(service, "start_date"):
        service.start_date = start_date or None

    if hasattr(service, "notes"):
        service.notes = notes

    service.status = status

    # Delete only future scheduled jobs for this service before re-saving.
    # Historical collected/failed/cancelled jobs are kept intact.
    today = date.today()
    Job.objects.filter(
        service=service,
        collection_date__gte=today,
        status="scheduled",
    ).delete()

    try:
        service.save()
    except ValidationError as exc:
        messages = exc.messages if hasattr(exc, "messages") else [str(exc)]
        return JsonResponse({"success": False, "message": " ".join(messages)}, status=400)
    except Exception as exc:
        return JsonResponse({"success": False, "message": str(exc)}, status=400)

    return JsonResponse(
        {
            "success": True,
            "message": "Service updated successfully.",
            "service": _serialize_service(service),
        }
    )


@csrf_exempt
def services_setup_options(request):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    hauliers = Haulier.objects.filter(active=True).order_by("name")

    return JsonResponse(
        {
            "success": True,
            "hauliers": [{"id": haulier.id, "name": haulier.name} for haulier in hauliers],
            "filters": _service_filters_payload(),
        }
    )
