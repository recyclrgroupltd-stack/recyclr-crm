from datetime import date, timedelta

from services.models import Service

from .models import Job

WEEKDAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def _normalise_days(days):
    if not isinstance(days, list):
        return []

    result = []
    for day in days:
        value = str(day).strip().lower()
        if value in WEEKDAY_MAP and value not in result:
            result.append(value)
    return result


def _date_matches_service(service, target_date):
    if service.schedule_type == "on_request":
        return False

    service_days = _normalise_days(service.collection_days)
    if not service_days:
        return False

    if target_date.weekday() not in [WEEKDAY_MAP[day] for day in service_days]:
        return False

    schedule_start = service.schedule_start_date or target_date

    if target_date < schedule_start:
        return False

    if service.schedule_type == "fortnightly":
        delta_days = (target_date - schedule_start).days
        delta_weeks = delta_days // 7
        if delta_weeks % 2 != 0:
            return False

    return True


def _build_job_payload(service, target_date):
    return {
        "service": service,
        "customer": service.customer,
        "site": service.site,
        "collection_date": target_date,
        "waste_type": service.waste_type,
        "bin_size": service.bin_size,
        "bin_quantity": service.bin_count,
        "haulier": service.haulier.name if service.haulier else "Unassigned",
    }


def ensure_job_for_service_date(service, target_date):
    if not _date_matches_service(service, target_date):
        return False

    exists = Job.objects.filter(
        service=service,
        collection_date=target_date,
    ).exists()

    if exists:
        return False

    Job.objects.create(**_build_job_payload(service, target_date))
    return True


DEFAULT_JOB_WINDOW_DAYS = 7


def _job_window_end(start_date, window_days=DEFAULT_JOB_WINDOW_DAYS):
    days = max(int(window_days or DEFAULT_JOB_WINDOW_DAYS), 1)
    return start_date + timedelta(days=days - 1)


def generate_jobs_for_service(service, window_days=DEFAULT_JOB_WINDOW_DAYS, include_today=True):
    if service.status != "active":
        return 0

    if service.schedule_type == "on_request":
        return 0

    days = _normalise_days(service.collection_days)
    if not days:
        return 0

    today = date.today()
    start_date = today if include_today else today + timedelta(days=1)
    end_date = _job_window_end(start_date, window_days=window_days)

    created_count = 0
    current = start_date

    while current <= end_date:
        if ensure_job_for_service_date(service, current):
            created_count += 1
        current += timedelta(days=1)

    return created_count


def prune_future_scheduled_jobs(window_days=DEFAULT_JOB_WINDOW_DAYS, include_today=True):
    today = date.today()
    start_date = today if include_today else today + timedelta(days=1)
    end_date = _job_window_end(start_date, window_days=window_days)

    return Job.objects.filter(
        collection_date__gt=end_date,
        status="scheduled",
    ).delete()[0]


def generate_jobs_for_all_services(window_days=DEFAULT_JOB_WINDOW_DAYS, include_today=True):
    services = (
        Service.objects.select_related("customer", "site", "haulier")
        .filter(status="active")
        .order_by("id")
    )

    pruned_total = prune_future_scheduled_jobs(
        window_days=window_days,
        include_today=include_today,
    )
    created_total = 0
    service_results = []

    for service in services:
        created = generate_jobs_for_service(
            service,
            window_days=window_days,
            include_today=include_today,
        )
        created_total += created

        service_results.append(
            {
                "service_id": service.id,
                "customer": service.customer.business_name,
                "site": service.site.site_name,
                "created_jobs": created,
            }
        )

    return {
        "created_total": created_total,
        "pruned_total": pruned_total,
        "window_days": window_days,
        "services_checked": services.count(),
        "service_results": service_results,
    }
