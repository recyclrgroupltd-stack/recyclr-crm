import json
from datetime import datetime

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .models import Job
from .utils import DEFAULT_JOB_WINDOW_DAYS, generate_jobs_for_all_services


def _serialize_job(job, request=None):
    evidence_url = ""
    if job.evidence_image:
        try:
            evidence_url = job.evidence_image.url
            if request is not None:
                evidence_url = request.build_absolute_uri(evidence_url)
        except Exception:
            evidence_url = ""

    site_address_parts = [
        job.site.address_line_1,
        job.site.address_line_2,
        job.site.town,
        job.site.county,
        job.site.postcode,
    ]
    site_address = ", ".join([part for part in site_address_parts if part])

    account_manager = getattr(job.customer, "account_manager", None)
    account_manager_name = ""
    if account_manager:
        account_manager_name = (
            getattr(account_manager, "get_full_name", lambda: "")()
            or getattr(account_manager, "username", "")
        )

    collection_days = []
    if job.service_id:
        try:
            collection_days = job.service.get_collection_days_display_list()
        except Exception:
            collection_days = job.service.collection_days or []

    return {
        "id": job.id,
        "service_id": job.service_id,
        "customer_id": job.customer_id,
        "customer_uid": job.customer.customer_uid or "",
        "customer": job.customer.business_name,
        "site_id": job.site_id,
        "site": job.site.site_name,
        "site_address": site_address,
        "site_postcode": job.site.postcode or "",
        "date": job.collection_date.isoformat(),
        "date_time": job.collection_date.isoformat(),
        "waste_type": job.waste_type,
        "bin": f"{job.bin_quantity} x {job.bin_size}L",
        "bin_quantity": job.bin_quantity,
        "bin_size": job.bin_size,
        "status": job.status,
        "customer_status": job.customer.status or "",
        "service_status": job.service.status if job.service_id else "",
        "schedule_type": job.service.schedule_type if job.service_id else "",
        "collection_days": collection_days,
        "schedule_start_date": (
            job.service.schedule_start_date.isoformat()
            if job.service_id and job.service.schedule_start_date
            else ""
        ),
        "account_manager": account_manager_name,
        "failure_reason": job.failure_reason or "",
        "reason": job.failure_reason or "",
        "failure_notes": job.failure_notes or "",
        "haulier": job.haulier or "Unassigned",
        "notes": job.notes or "",
        "rescheduled_to": job.rescheduled_to.isoformat() if job.rescheduled_to else "",
        "status_updated_by": job.status_updated_by or "",
        "status_updated_by_email": job.status_updated_by_email or "",
        "status_updated_source": job.status_updated_source or "",
        "status_updated_at": job.status_updated_at.isoformat() if job.status_updated_at else "",
        "created_at": job.created_at.isoformat() if job.created_at else "",
        "completed_at": job.completed_at.isoformat() if job.completed_at else "",
        "evidence_image_url": evidence_url,
    }


def _parse_request_payload(request):
    content_type = request.content_type or ""

    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        data = request.POST
        files = request.FILES
        return data, files

    try:
        body = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        body = {}

    return body, None


def _parse_date(value):
    if not value:
        return None

    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError:
        return None


@csrf_exempt
def jobs_list(request):
    if request.method != "GET":
        return JsonResponse(
            {"success": False, "message": "Method not allowed."},
            status=405,
        )

    generate_jobs_for_all_services(
        window_days=DEFAULT_JOB_WINDOW_DAYS,
        include_today=True,
    )

    jobs = (
        Job.objects.select_related("customer", "customer__account_manager", "site", "service", "status_updated_by_portal_user")
        .all()
        .order_by("collection_date", "id")
    )

    data = [_serialize_job(job, request=request) for job in jobs]
    return JsonResponse(data, safe=False)


@csrf_exempt
def customer_jobs(request, customer_id):
    if request.method != "GET":
        return JsonResponse(
            {"success": False, "message": "Method not allowed."},
            status=405,
        )

    jobs = (
        Job.objects.select_related("customer", "customer__account_manager", "site", "service", "status_updated_by_portal_user")
        .filter(customer_id=customer_id)
        .order_by("collection_date", "id")
    )

    rows = [_serialize_job(job, request=request) for job in jobs]

    summary = {
        "total_events": len(rows),
        "collected": len([row for row in rows if row["status"] == "collected"]),
        "failed": len([row for row in rows if row["status"] == "failed"]),
        "scheduled": len([row for row in rows if row["status"] == "scheduled"]),
        "cancelled": len([row for row in rows if row["status"] == "cancelled"]),
    }

    site_options = sorted(
        {row["site"] for row in rows if row["site"]},
        key=lambda value: value.lower(),
    )

    stream_options = sorted(
        {row["waste_type"] for row in rows if row["waste_type"]},
        key=lambda value: value.lower(),
    )

    return JsonResponse(
        {
            "success": True,
            "summary": summary,
            "rows": rows,
            "filters": {
                "sites": site_options,
                "streams": stream_options,
                "statuses": ["scheduled", "collected", "failed", "cancelled"],
            },
        }
    )


@csrf_exempt
def update_job_status(request, job_id):
    if request.method != "POST":
        return JsonResponse(
            {"success": False, "message": "Method not allowed."},
            status=405,
        )

    payload, files = _parse_request_payload(request)

    try:
        status = str(payload.get("status", "")).strip()
        reason = str(payload.get("reason", "")).strip()
        failure_notes = str(payload.get("failure_notes", "")).strip()
        reschedule_date_raw = str(payload.get("reschedule_date", "")).strip()
        status_updated_by = str(payload.get("status_updated_by", "")).strip()
        evidence_image = files.get("evidence_image") if files else None

        if status not in ["scheduled", "collected", "failed", "cancelled"]:
            return JsonResponse(
                {"success": False, "message": "Invalid job status."},
                status=400,
            )

        job = Job.objects.select_related("customer", "site", "service").get(id=job_id)
        job.status = status
        job.status_updated_by = status_updated_by or ""
        job.status_updated_by_email = None
        job.status_updated_source = "staff"
        job.status_updated_by_portal_user = None
        job.status_updated_at = timezone.now()

        created_reschedule_job = None

        if status == "failed":
            if reason not in ["blocked_access", "not_presented", "contaminated", "overweight", "closed", "other"]:
                return JsonResponse(
                    {"success": False, "message": "Invalid failure reason."},
                    status=400,
                )

            if reason == "other" and not failure_notes:
                return JsonResponse(
                    {"success": False, "message": "Please enter notes when using 'Other'."},
                    status=400,
                )

            job.failure_reason = reason
            job.failure_notes = failure_notes
            job.completed_at = timezone.now()

            if evidence_image:
                job.evidence_image = evidence_image

            reschedule_date = _parse_date(reschedule_date_raw)
            if reschedule_date:
                if reschedule_date <= job.collection_date:
                    return JsonResponse(
                        {"success": False, "message": "Reschedule date must be after the original collection date."},
                        status=400,
                    )

                duplicate = Job.objects.filter(
                    service=job.service,
                    collection_date=reschedule_date,
                    status="scheduled",
                ).exists()

                if duplicate:
                    return JsonResponse(
                        {"success": False, "message": "A scheduled job already exists for that reschedule date."},
                        status=400,
                    )

                created_reschedule_job = Job.objects.create(
                    service=job.service,
                    customer=job.customer,
                    site=job.site,
                    collection_date=reschedule_date,
                    waste_type=job.waste_type,
                    bin_size=job.bin_size,
                    bin_quantity=job.bin_quantity,
                    haulier=job.haulier,
                    status="scheduled",
                    notes=f"Rescheduled from failed job #{job.id}",
                )
                job.rescheduled_to = reschedule_date
            else:
                job.rescheduled_to = None
        else:
            job.failure_reason = ""
            job.failure_notes = ""
            job.rescheduled_to = None
            if status == "collected":
                job.completed_at = timezone.now()

        job.save()

        return JsonResponse(
            {
                "success": True,
                "message": "Job updated successfully.",
                "job": _serialize_job(job, request=request),
                "rescheduled_job": _serialize_job(created_reschedule_job, request=request) if created_reschedule_job else None,
            }
        )
    except Job.DoesNotExist:
        return JsonResponse(
            {"success": False, "message": "Job not found."},
            status=404,
        )
    except Exception as exc:
        return JsonResponse(
            {"success": False, "message": str(exc)},
            status=400,
        )


@csrf_exempt
def generate_jobs_now(request):
    if request.method != "POST":
        return JsonResponse(
            {"success": False, "message": "Method not allowed."},
            status=405,
        )

    result = generate_jobs_for_all_services(
        window_days=DEFAULT_JOB_WINDOW_DAYS,
        include_today=True,
    )

    return JsonResponse(
        {
            "success": True,
            "message": f"Checked the next {result['window_days']} days and created {result['created_total']} jobs.",
            "created_total": result["created_total"],
            "pruned_total": result["pruned_total"],
            "window_days": result["window_days"],
            "services_checked": result["services_checked"],
            "service_results": result["service_results"],
        }
    )
