from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.http import JsonResponse
from django.utils import timezone

from accounts_api.views import require_permission

from customers.models import Customer, Site
from hauliers.models import Haulier, HaulierRate
from leads.models import Lead
from operations.models import CollectionEvent
from quotes.models import Quote
from services.models import Service


def _safe_str(value):
    if value is None:
        return ""
    return str(value)


def _money(value):
    try:
        return f"{float(value):.2f}"
    except Exception:
        return "0.00"


def _date(value):
    if not value:
        return ""
    try:
        return value.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(value)


def _date_only(value):
    if not value:
        return ""
    try:
        return value.strftime("%Y-%m-%d")
    except Exception:
        return str(value)


def _get_common_filters(request):
    return {
        "dataset": (request.GET.get("dataset") or "").strip(),
        "quick_report": (request.GET.get("quick_report") or "").strip(),
        "search": (request.GET.get("search") or "").strip(),
        "customer_id": (request.GET.get("customer_id") or "").strip(),
        "site_id": (request.GET.get("site_id") or "").strip(),
        "status": (request.GET.get("status") or "").strip(),
        "waste_type": (request.GET.get("waste_type") or "").strip(),
        "haulier_id": (request.GET.get("haulier_id") or "").strip(),
    }


def report_builder_options(request):
    _, error_response = require_permission(request, "reporting.view", "You do not have permission to view reporting.")
    if error_response:
        return error_response

    customers = Customer.objects.all().order_by("business_name")
    sites = Site.objects.select_related("customer").all().order_by("site_name")
    hauliers = Haulier.objects.all().order_by("name")

    return JsonResponse(
        {
            "datasets": [
                {"value": "customers", "label": "Customers"},
                {"value": "sites", "label": "Sites"},
                {"value": "services", "label": "Services"},
                {"value": "quotes", "label": "Quotes"},
                {"value": "haulier_rates", "label": "Haulier Rates"},
                {"value": "leads", "label": "Leads"},
                {"value": "collections", "label": "Collections"},
            ],
            "customers": [
                {"id": customer.id, "label": customer.business_name}
                for customer in customers
            ],
            "sites": [
                {
                    "id": site.id,
                    "label": f"{site.site_name} ({site.customer.business_name})"
                    if site.customer
                    else site.site_name,
                }
                for site in sites
            ],
            "hauliers": [
                {"id": haulier.id, "label": haulier.name}
                for haulier in hauliers
            ],
            "statuses": [
                {"value": "active", "label": "Active"},
                {"value": "paused", "label": "Paused"},
                {"value": "ended", "label": "Ended"},
                {"value": "draft", "label": "Draft"},
                {"value": "sent", "label": "Sent"},
                {"value": "accepted", "label": "Accepted"},
                {"value": "declined", "label": "Declined"},
                {"value": "expired", "label": "Expired"},
                {"value": "new", "label": "New"},
                {"value": "contacted", "label": "Contacted"},
                {"value": "quote_sent", "label": "Quote Sent"},
                {"value": "won", "label": "Won"},
                {"value": "lost", "label": "Lost"},
                {"value": "collected", "label": "Collected"},
                {"value": "failed", "label": "Failed"},
            ],
            "waste_types": [
                {"value": "general", "label": "General Waste"},
                {"value": "mixed_recycling", "label": "Mixed Recycling"},
                {"value": "glass", "label": "Glass"},
                {"value": "food", "label": "Food"},
            ],
            "quick_reports": [
                {"value": "monthly_revenue_by_customer", "label": "Monthly Revenue by Customer"},
                {"value": "top_customers_by_monthly_value", "label": "Top Customers by Monthly Value"},
                {"value": "quotes_won_vs_lost", "label": "Quotes Won vs Lost"},
                {"value": "accepted_quotes_awaiting_setup", "label": "Accepted Quotes Awaiting Service Setup"},
                {"value": "low_value_customers", "label": "Low-Value Customers"},
                {"value": "active_services_by_waste_type", "label": "Active Services by Waste Type"},
                {"value": "active_services_by_site", "label": "Active Services by Site"},
                {"value": "collections_failures", "label": "Collections Failures"},
                {"value": "sites_with_no_active_services", "label": "Sites With No Active Services"},
                {"value": "customers_with_no_sites", "label": "Customers With No Sites"},
                {"value": "customers_with_no_active_services", "label": "Customers With No Active Services"},
                {"value": "haulier_coverage", "label": "Haulier Coverage"},
                {"value": "missing_haulier_rates", "label": "Missing Haulier Rates"},
                {"value": "leads_needing_follow_up", "label": "Leads Needing Follow-Up"},
                {"value": "quotes_sent_not_accepted", "label": "Quotes Sent But Not Accepted"},
                {"value": "new_customers_this_month", "label": "New Customers This Month"},
            ],
        }
    )


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


def _run_monthly_revenue_by_customer():
    rows = []
    customers = (
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
        .order_by("-monthly_revenue", "business_name")
    )

    for customer in customers:
        rows.append(
            [
                _safe_str(customer.business_name),
                _safe_str(customer.active_service_count or 0),
                _money(customer.monthly_revenue or 0),
            ]
        )

    return {
        "title": "Monthly Revenue by Customer",
        "columns": ["Customer", "Active Services", "Monthly Revenue"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_top_customers_by_monthly_value():
    rows = []
    customers = (
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
        .order_by("-monthly_revenue", "business_name")[:10]
    )

    for customer in customers:
        rows.append(
            [
                _safe_str(customer.business_name),
                _safe_str(customer.active_service_count or 0),
                _money(customer.monthly_revenue or 0),
            ]
        )

    return {
        "title": "Top Customers by Monthly Value",
        "columns": ["Customer", "Active Services", "Monthly Revenue"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_quotes_won_vs_lost():
    quote_counts = {
        item["status"]: item["count"]
        for item in Quote.objects.values("status").annotate(count=Count("id"))
    }

    rows = [
        ["Accepted", _safe_str(quote_counts.get("accepted", 0))],
        ["Declined", _safe_str(quote_counts.get("declined", 0))],
        ["Expired", _safe_str(quote_counts.get("expired", 0))],
        ["Sent", _safe_str(quote_counts.get("sent", 0))],
        ["Draft", _safe_str(quote_counts.get("draft", 0))],
    ]

    return {
        "title": "Quotes Won vs Lost",
        "columns": ["Quote Status", "Count"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_accepted_quotes_awaiting_setup():
    rows = []
    quotes = (
        Quote.objects.select_related("customer", "site")
        .prefetch_related("lines")
        .filter(status="accepted")
        .order_by("-created_at")
    )

    for quote in quotes:
        if not _quote_has_matching_active_services(quote):
            rows.append(
                [
                    _safe_str(quote.quote_number),
                    _safe_str(quote.customer.business_name if quote.customer else ""),
                    _safe_str(quote.site.site_name if quote.site else ""),
                    _money(quote.total_per_month),
                    _date(quote.created_at),
                ]
            )

    return {
        "title": "Accepted Quotes Awaiting Service Setup",
        "columns": ["Quote Number", "Customer", "Site", "Monthly Total", "Accepted/Created"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_low_value_customers():
    rows = []
    customers = (
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
        .filter(active_service_count__gt=0)
        .order_by("monthly_revenue", "business_name")
    )

    for customer in customers:
        revenue = float(customer.monthly_revenue or 0)
        if revenue <= 100:
            rows.append(
                [
                    _safe_str(customer.business_name),
                    _safe_str(customer.active_service_count or 0),
                    _money(revenue),
                ]
            )

    return {
        "title": "Low-Value Customers",
        "columns": ["Customer", "Active Services", "Monthly Revenue"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_active_services_by_waste_type():
    rows = []
    items = (
        Service.objects.filter(status="active")
        .values("waste_type")
        .annotate(
            service_count=Count("id"),
            total_monthly_value=Sum("monthly_value"),
        )
        .order_by("-service_count", "waste_type")
    )

    label_map = dict(Service.WASTE_TYPE_CHOICES)

    for item in items:
        rows.append(
            [
                _safe_str(label_map.get(item["waste_type"], item["waste_type"])),
                _safe_str(item["service_count"]),
                _money(item["total_monthly_value"] or 0),
            ]
        )

    return {
        "title": "Active Services by Waste Type",
        "columns": ["Waste Type", "Active Services", "Monthly Value"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_active_services_by_site():
    rows = []
    items = (
        Site.objects.select_related("customer")
        .annotate(
            active_service_count=Count(
                "services",
                filter=Q(services__status="active"),
                distinct=True,
            ),
            total_monthly_value=Sum(
                "services__monthly_value",
                filter=Q(services__status="active"),
            ),
        )
        .filter(active_service_count__gt=0)
        .order_by("-active_service_count", "-total_monthly_value", "site_name")
    )

    for site in items:
        rows.append(
            [
                _safe_str(site.site_name),
                _safe_str(site.customer.business_name if site.customer else ""),
                _safe_str(site.active_service_count or 0),
                _money(site.total_monthly_value or 0),
            ]
        )

    return {
        "title": "Active Services by Site",
        "columns": ["Site", "Customer", "Active Services", "Monthly Value"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_collections_failures():
    rows = []
    events = (
        CollectionEvent.objects.select_related("customer", "site", "service")
        .filter(status="failed")
        .order_by("-date_time", "-id")
    )

    for event in events:
        rows.append(
            [
                _safe_str(event.date_time.strftime("%Y-%m-%d %H:%M") if event.date_time else ""),
                _safe_str(event.customer.business_name if event.customer else ""),
                _safe_str(event.site.site_name if event.site else ""),
                _safe_str(event.waste_type),
                _safe_str(event.reason),
                _safe_str(event.notes),
            ]
        )

    return {
        "title": "Collections Failures",
        "columns": ["Date / Time", "Customer", "Site", "Waste Type", "Reason", "Notes"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_sites_with_no_active_services():
    rows = []
    sites = (
        Site.objects.select_related("customer")
        .annotate(
            active_service_count=Count(
                "services",
                filter=Q(services__status="active"),
                distinct=True,
            )
        )
        .filter(active_service_count=0)
        .order_by("customer__business_name", "site_name")
    )

    for site in sites:
        rows.append(
            [
                _safe_str(site.site_name),
                _safe_str(site.customer.business_name if site.customer else ""),
                _safe_str(getattr(site, "town", "")),
                _safe_str(getattr(site, "postcode", "")),
            ]
        )

    return {
        "title": "Sites With No Active Services",
        "columns": ["Site", "Customer", "Town", "Postcode"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_customers_with_no_sites():
    rows = []
    customers = (
        Customer.objects.annotate(site_count=Count("sites", distinct=True))
        .filter(site_count=0)
        .order_by("business_name")
    )

    for customer in customers:
        rows.append(
            [
                _safe_str(customer.business_name),
                _safe_str(customer.contact_name),
                _safe_str(customer.email),
                _safe_str(customer.phone),
            ]
        )

    return {
        "title": "Customers With No Sites",
        "columns": ["Customer", "Contact", "Email", "Phone"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_customers_with_no_active_services():
    rows = []
    customers = (
        Customer.objects.annotate(
            active_service_count=Count(
                "services",
                filter=Q(services__status="active"),
                distinct=True,
            ),
            site_count=Count("sites", distinct=True),
        )
        .filter(active_service_count=0)
        .order_by("business_name")
    )

    for customer in customers:
        rows.append(
            [
                _safe_str(customer.business_name),
                _safe_str(customer.site_count or 0),
                _safe_str(customer.contact_name),
                _safe_str(customer.phone),
            ]
        )

    return {
        "title": "Customers With No Active Services",
        "columns": ["Customer", "Sites", "Contact", "Phone"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_haulier_coverage():
    rows = []
    items = (
        HaulierRate.objects.select_related("haulier")
        .values("haulier__name", "waste_type")
        .annotate(rate_count=Count("id"))
        .order_by("haulier__name", "waste_type")
    )

    label_map = dict(HaulierRate.WASTE_TYPE_CHOICES)

    for item in items:
        rows.append(
            [
                _safe_str(item["haulier__name"]),
                _safe_str(label_map.get(item["waste_type"], item["waste_type"])),
                _safe_str(item["rate_count"]),
            ]
        )

    return {
        "title": "Haulier Coverage",
        "columns": ["Haulier", "Waste Type", "Rate Count"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_missing_haulier_rates():
    rows = []
    waste_type_labels = dict(HaulierRate.WASTE_TYPE_CHOICES)
    bin_size_labels = dict(HaulierRate.BIN_SIZE_CHOICES)

    all_pairs = [
        (waste, size)
        for waste, _ in HaulierRate.WASTE_TYPE_CHOICES
        for size, _ in HaulierRate.BIN_SIZE_CHOICES
    ]

    for haulier in Haulier.objects.all().order_by("name"):
        existing = set(
            HaulierRate.objects.filter(haulier=haulier).values_list("waste_type", "bin_size")
        )

        for waste_type, bin_size in all_pairs:
            if (waste_type, bin_size) not in existing:
                rows.append(
                    [
                        _safe_str(haulier.name),
                        _safe_str(waste_type_labels.get(waste_type, waste_type)),
                        _safe_str(bin_size_labels.get(bin_size, bin_size)),
                    ]
                )

    return {
        "title": "Missing Haulier Rates",
        "columns": ["Haulier", "Missing Waste Type", "Missing Bin Size"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_leads_needing_follow_up():
    rows = []
    today = timezone.localdate()

    leads = (
        Lead.objects.filter(
            status__in=["new", "contacted", "quote_sent"]
        )
        .filter(Q(follow_up_date__lte=today) | Q(follow_up_date__isnull=True))
        .order_by("follow_up_date", "-created_at")
    )

    for lead in leads:
        rows.append(
            [
                _safe_str(lead.company_name),
                _safe_str(lead.contact_name or lead.who_spoke_to),
                _safe_str(lead.phone),
                _safe_str(lead.email),
                _safe_str(lead.status),
                _date_only(lead.follow_up_date),
            ]
        )

    return {
        "title": "Leads Needing Follow-Up",
        "columns": ["Lead", "Contact", "Phone", "Email", "Status", "Follow-Up Date"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_quotes_sent_not_accepted():
    rows = []
    quotes = (
        Quote.objects.select_related("customer", "site")
        .filter(status="sent")
        .order_by("-created_at")
    )

    for quote in quotes:
        rows.append(
            [
                _safe_str(quote.quote_number),
                _safe_str(quote.customer.business_name if quote.customer else ""),
                _safe_str(quote.site.site_name if quote.site else ""),
                _safe_str(quote.contact_name),
                _safe_str(quote.email),
                _money(quote.total_per_month),
                _date(quote.created_at),
            ]
        )

    return {
        "title": "Quotes Sent But Not Accepted",
        "columns": ["Quote Number", "Customer", "Site", "Contact", "Email", "Monthly Total", "Created"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_new_customers_this_month():
    rows = []
    now = timezone.localtime()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    customers = (
        Customer.objects.filter(created_at__gte=start_of_month)
        .order_by("-created_at", "business_name")
    )

    for customer in customers:
        rows.append(
            [
                _safe_str(customer.business_name),
                _safe_str(customer.contact_name),
                _safe_str(customer.phone),
                _safe_str(customer.email),
                _date(customer.created_at),
            ]
        )

    return {
        "title": "New Customers This Month",
        "columns": ["Customer", "Contact", "Phone", "Email", "Created"],
        "rows": rows,
        "row_count": len(rows),
    }


def _run_customers_report(filters):
    queryset = Customer.objects.all().order_by("business_name")

    if filters["search"]:
        queryset = queryset.filter(
            Q(business_name__icontains=filters["search"])
            | Q(contact_name__icontains=filters["search"])
            | Q(email__icontains=filters["search"])
            | Q(phone__icontains=filters["search"])
            | Q(town__icontains=filters["search"])
            | Q(postcode__icontains=filters["search"])
        )

    if filters["status"]:
        queryset = queryset.filter(status=filters["status"])

    columns = [
        "Business Name",
        "Contact Name",
        "Email",
        "Phone",
        "Status",
        "Town",
        "Postcode",
        "Created",
    ]

    rows = [
        [
            _safe_str(customer.business_name),
            _safe_str(customer.contact_name),
            _safe_str(customer.email),
            _safe_str(customer.phone),
            _safe_str(customer.status),
            _safe_str(getattr(customer, "town", "")),
            _safe_str(getattr(customer, "postcode", "")),
            _date(customer.created_at),
        ]
        for customer in queryset
    ]

    return {
        "title": "Customers Report",
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


def _run_sites_report(filters):
    queryset = Site.objects.select_related("customer").all().order_by("site_name")

    if filters["search"]:
        queryset = queryset.filter(
            Q(site_name__icontains=filters["search"])
            | Q(address_line_1__icontains=filters["search"])
            | Q(town__icontains=filters["search"])
            | Q(postcode__icontains=filters["search"])
            | Q(customer__business_name__icontains=filters["search"])
        )

    if filters["customer_id"]:
        queryset = queryset.filter(customer_id=filters["customer_id"])

    if filters["site_id"]:
        queryset = queryset.filter(id=filters["site_id"])

    columns = [
        "Site Name",
        "Customer",
        "Address",
        "Town",
        "County",
        "Postcode",
    ]

    rows = [
        [
            _safe_str(site.site_name),
            _safe_str(site.customer.business_name if site.customer else ""),
            ", ".join(
                [
                    part
                    for part in [
                        _safe_str(getattr(site, "address_line_1", "")),
                        _safe_str(getattr(site, "address_line_2", "")),
                    ]
                    if part
                ]
            ),
            _safe_str(getattr(site, "town", "")),
            _safe_str(getattr(site, "county", "")),
            _safe_str(getattr(site, "postcode", "")),
        ]
        for site in queryset
    ]

    return {
        "title": "Sites Report",
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


def _run_services_report(filters):
    queryset = Service.objects.select_related("customer", "site").all().order_by("-id")

    if filters["search"]:
        queryset = queryset.filter(
            Q(customer__business_name__icontains=filters["search"])
            | Q(site__site_name__icontains=filters["search"])
            | Q(waste_type__icontains=filters["search"])
            | Q(bin_size__icontains=filters["search"])
        )

    if filters["customer_id"]:
        queryset = queryset.filter(customer_id=filters["customer_id"])

    if filters["site_id"]:
        queryset = queryset.filter(site_id=filters["site_id"])

    if filters["status"]:
        queryset = queryset.filter(status=filters["status"])

    if filters["waste_type"]:
        queryset = queryset.filter(waste_type=filters["waste_type"])

    columns = [
        "Customer",
        "Site",
        "Waste Type",
        "Bin Size",
        "Bin Count",
        "Collections / Week",
        "Price per Lift",
        "Monthly Value",
        "Status",
    ]

    rows = [
        [
            _safe_str(service.customer.business_name if service.customer else ""),
            _safe_str(service.site.site_name if service.site else ""),
            _safe_str(service.get_waste_type_display()),
            _safe_str(service.get_bin_size_display()),
            _safe_str(service.bin_count),
            _safe_str(service.collections_per_week),
            _money(service.price_per_lift),
            _money(service.monthly_value),
            _safe_str(service.status),
        ]
        for service in queryset
    ]

    return {
        "title": "Services Report",
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


def _run_quotes_report(filters):
    queryset = Quote.objects.select_related("customer", "site", "lead").all().order_by("-id")

    if filters["search"]:
        queryset = queryset.filter(
            Q(quote_number__icontains=filters["search"])
            | Q(title__icontains=filters["search"])
            | Q(customer__business_name__icontains=filters["search"])
            | Q(site__site_name__icontains=filters["search"])
            | Q(contact_name__icontains=filters["search"])
            | Q(email__icontains=filters["search"])
        )

    if filters["customer_id"]:
        queryset = queryset.filter(customer_id=filters["customer_id"])

    if filters["site_id"]:
        queryset = queryset.filter(site_id=filters["site_id"])

    if filters["status"]:
        queryset = queryset.filter(status=filters["status"])

    columns = [
        "Quote Number",
        "Title",
        "Customer",
        "Site",
        "Contact",
        "Email",
        "Status",
        "Monthly Total",
        "Created",
    ]

    rows = [
        [
            _safe_str(quote.quote_number),
            _safe_str(quote.title),
            _safe_str(quote.customer.business_name if quote.customer else ""),
            _safe_str(quote.site.site_name if quote.site else ""),
            _safe_str(quote.contact_name),
            _safe_str(quote.email),
            _safe_str(quote.status),
            _money(quote.total_per_month),
            _date(quote.created_at),
        ]
        for quote in queryset
    ]

    return {
        "title": "Quotes Report",
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


def _run_haulier_rates_report(filters):
    queryset = HaulierRate.objects.select_related("haulier").all().order_by("haulier__name", "waste_type", "bin_size")

    if filters["search"]:
        queryset = queryset.filter(
            Q(haulier__name__icontains=filters["search"])
            | Q(waste_type__icontains=filters["search"])
            | Q(bin_size__icontains=filters["search"])
            | Q(notes__icontains=filters["search"])
        )

    if filters["haulier_id"]:
        queryset = queryset.filter(haulier_id=filters["haulier_id"])

    if filters["waste_type"]:
        queryset = queryset.filter(waste_type=filters["waste_type"])

    columns = [
        "Haulier",
        "Waste Type",
        "Bin Size",
        "Lift Rate",
        "Weight Limit (kg)",
        "Excess per kg",
        "Notes",
    ]

    rows = [
        [
            _safe_str(rate.haulier.name if rate.haulier else ""),
            _safe_str(rate.get_waste_type_display()),
            _safe_str(rate.get_bin_size_display()),
            _money(rate.price_per_lift),
            _safe_str(rate.weight_limit_kg),
            _money(rate.excess_per_kg),
            _safe_str(rate.notes),
        ]
        for rate in queryset
    ]

    return {
        "title": "Haulier Rates Report",
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


def _run_leads_report(filters):
    queryset = Lead.objects.all().order_by("-created_at")

    if filters["search"]:
        queryset = queryset.filter(
            Q(company_name__icontains=filters["search"])
            | Q(contact_name__icontains=filters["search"])
            | Q(phone__icontains=filters["search"])
            | Q(email__icontains=filters["search"])
            | Q(town__icontains=filters["search"])
            | Q(postcode__icontains=filters["search"])
        )

    if filters["status"]:
        queryset = queryset.filter(status=filters["status"])

    columns = [
        "Company",
        "Contact",
        "Phone",
        "Email",
        "Status",
        "Follow-Up",
        "Created",
    ]

    rows = [
        [
            _safe_str(lead.company_name),
            _safe_str(lead.contact_name or lead.who_spoke_to),
            _safe_str(lead.phone),
            _safe_str(lead.email),
            _safe_str(lead.status),
            _date_only(lead.follow_up_date),
            _date(lead.created_at),
        ]
        for lead in queryset
    ]

    return {
        "title": "Leads Report",
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


def _run_collections_report(filters):
    queryset = CollectionEvent.objects.select_related("customer", "site", "service").all().order_by("-date_time")

    if filters["search"]:
        queryset = queryset.filter(
            Q(customer__business_name__icontains=filters["search"])
            | Q(site__site_name__icontains=filters["search"])
            | Q(waste_type__icontains=filters["search"])
            | Q(reason__icontains=filters["search"])
            | Q(notes__icontains=filters["search"])
        )

    if filters["customer_id"]:
        queryset = queryset.filter(customer_id=filters["customer_id"])

    if filters["site_id"]:
        queryset = queryset.filter(site_id=filters["site_id"])

    if filters["status"]:
        queryset = queryset.filter(status=filters["status"])

    if filters["waste_type"]:
        queryset = queryset.filter(waste_type=filters["waste_type"])

    columns = [
        "Date / Time",
        "Customer",
        "Site",
        "Waste Type",
        "Status",
        "Reason",
        "Notes",
    ]

    rows = [
        [
            _date(event.date_time),
            _safe_str(event.customer.business_name if event.customer else ""),
            _safe_str(event.site.site_name if event.site else ""),
            _safe_str(event.waste_type),
            _safe_str(event.status),
            _safe_str(event.reason),
            _safe_str(event.notes),
        ]
        for event in queryset
    ]

    return {
        "title": "Collections Report",
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


def run_report(request):
    _, error_response = require_permission(request, "reporting.view", "You do not have permission to view reporting.")
    if error_response:
        return error_response

    filters = _get_common_filters(request)

    quick_report = filters["quick_report"]
    dataset = filters["dataset"]

    if quick_report == "monthly_revenue_by_customer":
        result = _run_monthly_revenue_by_customer()
    elif quick_report == "top_customers_by_monthly_value":
        result = _run_top_customers_by_monthly_value()
    elif quick_report == "quotes_won_vs_lost":
        result = _run_quotes_won_vs_lost()
    elif quick_report == "accepted_quotes_awaiting_setup":
        result = _run_accepted_quotes_awaiting_setup()
    elif quick_report == "low_value_customers":
        result = _run_low_value_customers()
    elif quick_report == "active_services_by_waste_type":
        result = _run_active_services_by_waste_type()
    elif quick_report == "active_services_by_site":
        result = _run_active_services_by_site()
    elif quick_report == "collections_failures":
        result = _run_collections_failures()
    elif quick_report == "sites_with_no_active_services":
        result = _run_sites_with_no_active_services()
    elif quick_report == "customers_with_no_sites":
        result = _run_customers_with_no_sites()
    elif quick_report == "customers_with_no_active_services":
        result = _run_customers_with_no_active_services()
    elif quick_report == "haulier_coverage":
        result = _run_haulier_coverage()
    elif quick_report == "missing_haulier_rates":
        result = _run_missing_haulier_rates()
    elif quick_report == "leads_needing_follow_up":
        result = _run_leads_needing_follow_up()
    elif quick_report == "quotes_sent_not_accepted":
        result = _run_quotes_sent_not_accepted()
    elif quick_report == "new_customers_this_month":
        result = _run_new_customers_this_month()
    elif dataset == "customers":
        result = _run_customers_report(filters)
    elif dataset == "sites":
        result = _run_sites_report(filters)
    elif dataset == "services":
        result = _run_services_report(filters)
    elif dataset == "quotes":
        result = _run_quotes_report(filters)
    elif dataset == "haulier_rates":
        result = _run_haulier_rates_report(filters)
    elif dataset == "leads":
        result = _run_leads_report(filters)
    elif dataset == "collections":
        result = _run_collections_report(filters)
    else:
        return JsonResponse(
            {"success": False, "message": "Invalid report selected."},
            status=400,
        )

    return JsonResponse(
        {
            "success": True,
            **result,
        }
    )