from django.db.models import Count, Q, Sum
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.decorators import api_view

from accounts_api.views import require_permission

from containers.models import Container, ContainerMaintenanceEvent
from customers.models import Customer
from documents.models import SigningPack
from jobs.models import Job
from leads.models import Lead
from operations.models import CollectionEvent
from purchase_orders.models import PurchaseOrder, StaffNotification
from quotes.models import Quote
from services.models import Service
from staff_calendar.models import StaffCalendarRequest


def _money(value):
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _safe_str(value):
    if value is None:
        return ""
    return str(value)


def _quote_has_matching_active_services(quote):
    if not quote.customer or not quote.site:
        return False

    lines = list(quote.lines.all())
    if not lines:
        return False

    for line in lines:
        exists = Service.objects.filter(
            customer=quote.customer,
            site=quote.site,
            waste_type=line.waste_type,
            bin_size=line.bin_size,
            bin_count=line.bin_count,
            collections_per_week=line.collections_per_week,
            status="active",
        ).exists()

        if not exists:
            return False

    return True


@api_view(["GET"])
def dashboard_stats(request):
    _, error_response = require_permission(request, "dashboard.view", "You do not have permission to view the dashboard.")
    if error_response:
        return error_response

    monthly_revenue = (
        Service.objects.filter(status="active").aggregate(total=Sum("monthly_value"))["total"] or 0
    )

    active_customers = (
        Customer.objects.filter(services__status="active").distinct().count()
    )

    active_services = Service.objects.filter(status="active").count()

    quotes_pending = Quote.objects.filter(status__in=["draft", "sent"]).count()

    return JsonResponse(
        {
            "leads": Lead.objects.count(),
            "customers": Customer.objects.count(),
            "services": Service.objects.count(),
            "revenue": _money(monthly_revenue),
            "active_customers": active_customers,
            "active_services": active_services,
            "quotes_pending": quotes_pending,
        }
    )


@api_view(["GET"])
def dashboard_overview(request):
    user, error_response = require_permission(request, "dashboard.view", "You do not have permission to view the dashboard.")
    if error_response:
        return error_response

    today = timezone.localdate()
    week_end = today + timezone.timedelta(days=7)

    total_monthly_revenue = (
        Service.objects.filter(status="active").aggregate(total=Sum("monthly_value"))["total"] or 0
    )
    active_customers = Customer.objects.filter(services__status="active").distinct().count()
    active_services = Service.objects.filter(status="active").count()
    quotes_pending = Quote.objects.filter(status__in=["draft", "sent"]).count()
    ready_for_setup_customers = Customer.objects.filter(status="ready_for_setup").count()
    pending_schedule_services = Service.objects.filter(status=Service.STATUS_PENDING_SCHEDULE).count()
    todays_jobs = Job.objects.filter(collection_date=today, status="scheduled").count()
    overdue_jobs = Job.objects.filter(collection_date__lt=today, status="scheduled").count()
    failed_jobs = Job.objects.filter(status="failed").count()
    assigned_containers = Container.objects.filter(status=Container.STATUS_ASSIGNED).count()
    containers_in_stock = Container.objects.filter(status=Container.STATUS_INACTIVE).count()
    containers_in_maintenance = Container.objects.filter(status=Container.STATUS_MAINTENANCE).count()
    open_container_maintenance = ContainerMaintenanceEvent.objects.filter(
        status__in=[ContainerMaintenanceEvent.STATUS_OPEN, ContainerMaintenanceEvent.STATUS_IN_PROGRESS]
    ).count()
    pending_calendar_requests = StaffCalendarRequest.objects.filter(
        target_user=user,
        status=StaffCalendarRequest.STATUS_PENDING,
    ).count()
    unread_notifications = StaffNotification.objects.filter(recipient=user, is_read=False).count()
    pending_purchase_orders = PurchaseOrder.objects.filter(status=PurchaseOrder.STATUS_PENDING).count()
    signing_packs_waiting = SigningPack.objects.filter(status__in=["ready", "sent", "viewed", "part_signed"]).count()
    my_customers_count = Customer.objects.filter(account_manager=user).count()

    accepted_quotes = (
        Quote.objects.select_related("customer", "site")
        .prefetch_related("lines")
        .filter(status="accepted")
        .order_by("-created_at")
    )

    accepted_quotes_awaiting_setup_rows = []
    for quote in accepted_quotes:
        if not _quote_has_matching_active_services(quote):
            accepted_quotes_awaiting_setup_rows.append(
                {
                    "quote_number": _safe_str(quote.quote_number),
                    "customer_name": _safe_str(quote.customer.business_name if quote.customer else ""),
                    "site_name": _safe_str(quote.site.site_name if quote.site else ""),
                    "monthly_total": _money(quote.total_per_month),
                    "created_at": quote.created_at.isoformat() if quote.created_at else "",
                }
            )

    leads_needing_follow_up_rows = []
    leads_needing_follow_up = (
        Lead.objects.filter(status__in=["new", "contacted", "quote_sent"])
        .filter(Q(follow_up_date__lte=today) | Q(follow_up_date__isnull=True))
        .order_by("follow_up_date", "-created_at")[:10]
    )

    for lead in leads_needing_follow_up:
        leads_needing_follow_up_rows.append(
            {
                "id": lead.id,
                "company_name": _safe_str(lead.company_name),
                "contact_name": _safe_str(lead.contact_name or lead.who_spoke_to),
                "phone": _safe_str(lead.phone),
                "status": _safe_str(lead.status),
                "follow_up_date": lead.follow_up_date.isoformat() if lead.follow_up_date else "",
            }
        )

    failed_collections_rows = []
    failed_collections = (
        CollectionEvent.objects.select_related("customer", "site")
        .filter(status="failed")
        .order_by("-date_time", "-id")[:200]
    )

    for event in failed_collections:
        failed_collections_rows.append(
            {
                "id": event.id,
                "customer_name": _safe_str(event.customer.business_name if event.customer else ""),
                "site_name": _safe_str(event.site.site_name if event.site else ""),
                "waste_type": _safe_str(event.waste_type),
                "reason": _safe_str(event.reason),
                "date_time": event.date_time.isoformat() if event.date_time else "",
            }
        )

    ready_for_setup_rows = []
    for customer in (
        Customer.objects.select_related("account_manager")
        .filter(status="ready_for_setup")
        .order_by("-updated_at", "-created_at")[:8]
    ):
        ready_for_setup_rows.append(
            {
                "id": customer.id,
                "business_name": _safe_str(customer.business_name),
                "account_manager": _safe_str(customer.account_manager.username if customer.account_manager else ""),
                "created_at": customer.created_at.isoformat() if customer.created_at else "",
            }
        )

    pending_schedule_rows = []
    for service in (
        Service.objects.select_related("customer", "site")
        .filter(status=Service.STATUS_PENDING_SCHEDULE)
        .order_by("-created_at")[:8]
    ):
        pending_schedule_rows.append(
            {
                "id": service.id,
                "customer_name": _safe_str(service.customer.business_name if service.customer else ""),
                "site_name": _safe_str(service.site.site_name if service.site else ""),
                "waste_type": _safe_str(service.waste_type),
                "bin_size": _safe_str(service.bin_size),
                "created_at": service.created_at.isoformat() if service.created_at else "",
            }
        )

    job_rows = []
    for job in (
        Job.objects.select_related("customer", "site")
        .filter(collection_date__lte=week_end)
        .exclude(status__in=["collected", "cancelled"])
        .order_by("collection_date", "id")[:10]
    ):
        job_rows.append(
            {
                "id": job.id,
                "customer_name": _safe_str(job.customer.business_name if job.customer else ""),
                "site_name": _safe_str(job.site.site_name if job.site else ""),
                "waste_type": _safe_str(job.waste_type),
                "bin_size": _safe_str(job.bin_size),
                "status": _safe_str(job.status),
                "collection_date": job.collection_date.isoformat() if job.collection_date else "",
            }
        )

    container_rows = []
    for container in (
        Container.objects.select_related("site", "site__customer")
        .filter(status__in=[Container.STATUS_ASSIGNED, Container.STATUS_MAINTENANCE])
        .order_by("status", "-updated_at")[:8]
    ):
        container_rows.append(
            {
                "id": container.id,
                "container_uid": _safe_str(container.container_uid),
                "status": _safe_str(container.status),
                "bin_size": _safe_str(container.bin_size),
                "waste_stream": _safe_str(container.waste_stream),
                "site_name": _safe_str(container.site.site_name if container.site else ""),
                "customer_name": _safe_str(container.site.customer.business_name if container.site and container.site.customer else ""),
            }
        )

    top_customers_rows = []
    top_customers = (
        Customer.objects.annotate(
            active_service_count=Count(
                "services",
                filter=Q(services__status="active"),
                distinct=True,
            ),
            monthly_revenue=Sum(
                "services__monthly_value",
                filter=Q(services__status="active"),
            ),
        )
        .filter(monthly_revenue__isnull=False)
        .order_by("-monthly_revenue", "business_name")[:5]
    )

    for customer in top_customers:
        top_customers_rows.append(
            {
                "id": customer.id,
                "business_name": _safe_str(customer.business_name),
                "active_service_count": int(customer.active_service_count or 0),
                "monthly_revenue": _money(customer.monthly_revenue),
            }
        )

    services_by_waste_type_rows = []
    waste_summary = (
        Service.objects.filter(status="active")
        .values("waste_type")
        .annotate(
            service_count=Count("id"),
            total_monthly_value=Sum("monthly_value"),
        )
        .order_by("-service_count", "waste_type")
    )

    waste_labels = dict(Service.WASTE_TYPE_CHOICES)

    for item in waste_summary:
        services_by_waste_type_rows.append(
            {
                "waste_type": _safe_str(item["waste_type"]),
                "label": _safe_str(waste_labels.get(item["waste_type"], item["waste_type"])),
                "service_count": int(item["service_count"] or 0),
                "monthly_value": _money(item["total_monthly_value"]),
            }
        )

    return JsonResponse(
        {
            "summary": {
                "total_monthly_revenue": _money(total_monthly_revenue),
                "active_customers": active_customers,
                "active_services": active_services,
                "quotes_pending": quotes_pending,
                "ready_for_setup_customers": ready_for_setup_customers,
                "pending_schedule_services": pending_schedule_services,
                "todays_jobs": todays_jobs,
                "overdue_jobs": overdue_jobs,
                "failed_jobs": failed_jobs,
                "assigned_containers": assigned_containers,
                "containers_in_stock": containers_in_stock,
                "containers_in_maintenance": containers_in_maintenance,
                "open_container_maintenance": open_container_maintenance,
                "pending_calendar_requests": pending_calendar_requests,
                "unread_notifications": unread_notifications,
                "pending_purchase_orders": pending_purchase_orders,
                "signing_packs_waiting": signing_packs_waiting,
                "my_customers_count": my_customers_count,
            },
            "attention": {
                "accepted_quotes_awaiting_setup_count": len(accepted_quotes_awaiting_setup_rows),
                "leads_needing_follow_up_count": len(leads_needing_follow_up_rows),
                "failed_collections_count": len(failed_collections_rows),
                "accepted_quotes_awaiting_setup": accepted_quotes_awaiting_setup_rows,
                "leads_needing_follow_up": leads_needing_follow_up_rows,
                "failed_collections": failed_collections_rows,
                "ready_for_setup_customers": ready_for_setup_rows,
                "pending_schedule_services": pending_schedule_rows,
                "upcoming_jobs": job_rows,
                "container_actions": container_rows,
            },
            "top_customers": top_customers_rows,
            "services_by_waste_type": services_by_waste_type_rows,
        }
    )
