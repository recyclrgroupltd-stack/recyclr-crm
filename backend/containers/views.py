import json
from urllib.parse import quote

from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from customers.models import Site
from services.models import Service
from accounts_api.models import CompanyDetails
from customers.models import CustomerActivity

from .models import (
    BIN_SIZE_CHOICES,
    WASTE_STREAM_CHOICES,
    Container,
    ContainerBatch,
    ContainerMaintenanceEvent,
)


def _parse_json_body(request):
    try:
        if not request.body:
            return {}
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _staff_username(request):
    return (request.headers.get("X-Staff-Username") or "").strip()


def _choice_label(choices, value):
    return dict(choices).get(value, str(value).replace("_", " ").title())


def _container_qr_url(container):
    return f"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={quote(container.qr_payload)}"


def _serialize_container_history(container):
    return [
        {
            "id": event.id,
            "title": event.title,
            "notes": event.notes,
            "status": event.status,
            "status_label": event.get_status_display(),
            "reported_by": event.reported_by,
            "created_at": event.created_at.isoformat() if event.created_at else "",
            "resolved_at": event.resolved_at.isoformat() if event.resolved_at else "",
        }
        for event in container.maintenance_events.all().order_by("-created_at", "-id")
    ]


def _serialize_container(container, include_history=False):
    site = container.site
    customer = site.customer if site and site.customer_id else None
    service = container.service
    location_label = site.site_name if site else ""
    location_detail = customer.business_name if customer else ""

    if container.status == Container.STATUS_EOL:
        location_label = "EOL"
        location_detail = "End of life"
    elif not location_label:
        location_label = "In stock"
        location_detail = "Not currently at a customer site"

    return {
        "id": container.id,
        "container_uid": container.container_uid,
        "bin_size": container.bin_size,
        "bin_size_label": _choice_label(BIN_SIZE_CHOICES, container.bin_size),
        "waste_stream": container.waste_stream,
        "waste_stream_label": _choice_label(WASTE_STREAM_CHOICES, container.waste_stream),
        "status": container.status,
        "status_label": "In Stock" if container.status == Container.STATUS_INACTIVE else _choice_label(Container.STATUS_CHOICES, container.status),
        "site_id": site.id if site else None,
        "site_name": site.site_name if site else "",
        "customer_id": customer.id if customer else None,
        "customer_name": customer.business_name if customer else "",
        "location_label": location_label,
        "location_detail": location_detail,
        "service_id": service.id if service else None,
        "qr_payload": container.qr_payload,
        "qr_url": _container_qr_url(container),
        "assigned_at": container.assigned_at.isoformat() if container.assigned_at else "",
        "delivered_at": container.delivered_at.isoformat() if container.delivered_at else "",
        "eol_at": container.eol_at.isoformat() if container.status == Container.STATUS_EOL and container.eol_at else "",
        "notes": container.notes or "",
        "created_at": container.created_at.isoformat() if container.created_at else "",
        "updated_at": container.updated_at.isoformat() if container.updated_at else "",
        "history": _serialize_container_history(container) if include_history else [],
    }


def options(request):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    sites = Site.objects.select_related("customer").order_by("customer__business_name", "site_name")
    services = Service.objects.select_related("customer", "site").order_by("-id")

    return JsonResponse(
        {
            "success": True,
            "bin_sizes": [{"value": value, "label": label} for value, label in BIN_SIZE_CHOICES],
            "waste_streams": [{"value": value, "label": label} for value, label in WASTE_STREAM_CHOICES],
            "statuses": [
                {"value": value, "label": "In Stock" if value == Container.STATUS_INACTIVE else label}
                for value, label in Container.STATUS_CHOICES
            ],
            "label_settings": {
                "width_mm": float(CompanyDetails.get_solo().container_qr_label_width_mm or 50),
                "height_mm": float(CompanyDetails.get_solo().container_qr_label_height_mm or 50),
            },
            "maintenance_statuses": [
                {"value": value, "label": label}
                for value, label in ContainerMaintenanceEvent.STATUS_CHOICES
            ],
            "sites": [
                {
                    "id": site.id,
                    "site_name": site.site_name,
                    "customer_id": site.customer_id,
                    "customer_name": site.customer.business_name if site.customer_id else "",
                }
                for site in sites
            ],
            "services": [
                {
                    "id": service.id,
                    "site_id": service.site_id,
                    "customer_id": service.customer_id,
                    "customer_name": service.customer.business_name if service.customer_id else "",
                    "site_name": service.site.site_name if service.site_id else "",
                    "waste_stream": service.waste_type,
                    "bin_size": service.bin_size,
                    "bin_count": service.bin_count,
                    "label": str(service),
                }
                for service in services
            ],
        }
    )


def containers_list(request):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    search = (request.GET.get("search") or "").strip().lower()
    status = (request.GET.get("status") or "").strip()
    site_id = (request.GET.get("site_id") or "").strip()
    service_id = (request.GET.get("service_id") or "").strip()
    waste_stream = (request.GET.get("waste_stream") or "").strip()
    bin_size = (request.GET.get("bin_size") or "").strip()

    containers = Container.objects.select_related("site__customer", "service").all()

    if status and status != "all":
        containers = containers.filter(status=status)
    elif status != "all":
        containers = containers.exclude(status=Container.STATUS_EOL)

    if site_id:
        containers = containers.filter(site_id=site_id)

    if service_id:
        containers = containers.filter(service_id=service_id)

    if waste_stream and waste_stream != "all":
        containers = containers.filter(waste_stream=waste_stream)

    if bin_size and bin_size != "all":
        containers = containers.filter(bin_size=bin_size)

    rows = [_serialize_container(container) for container in containers]

    if search:
        rows = [
            row
            for row in rows
            if search
            in " ".join(
                [
                    row["container_uid"],
                    row["bin_size_label"],
                    row["waste_stream_label"],
                    row["status_label"],
                    row["site_name"],
                    row["customer_name"],
                    row["notes"],
                ]
            ).lower()
        ]

    def count(value):
        return Container.objects.filter(status=value).count()

    return JsonResponse(
        {
            "success": True,
            "summary": {
                "total": Container.objects.count(),
                "inactive": count(Container.STATUS_INACTIVE),
                "assigned": count(Container.STATUS_ASSIGNED),
                "active": count(Container.STATUS_ACTIVE),
                "maintenance": count(Container.STATUS_MAINTENANCE),
                "eol": count(Container.STATUS_EOL),
                "filtered": len(rows),
            },
            "rows": rows,
        }
    )


@csrf_exempt
def create_container_batch(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    payload = _parse_json_body(request)
    if payload is None:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    bin_size = str(payload.get("bin_size") or "").strip()
    waste_stream = str(payload.get("waste_stream") or "").strip()
    supplier = str(payload.get("supplier") or "").strip()
    delivery_date = payload.get("delivery_date") or None
    notes = str(payload.get("notes") or "").strip()

    try:
        quantity = int(payload.get("quantity") or 0)
    except (TypeError, ValueError):
        return JsonResponse({"success": False, "message": "Quantity must be a number."}, status=400)

    if quantity < 1:
        return JsonResponse({"success": False, "message": "Quantity must be at least 1."}, status=400)

    if quantity > 500:
        return JsonResponse({"success": False, "message": "Please add no more than 500 containers at once."}, status=400)

    valid_sizes = {value for value, _ in BIN_SIZE_CHOICES}
    valid_streams = {value for value, _ in WASTE_STREAM_CHOICES}
    if bin_size not in valid_sizes:
        return JsonResponse({"success": False, "message": "Invalid bin size."}, status=400)
    if waste_stream not in valid_streams:
        return JsonResponse({"success": False, "message": "Invalid waste stream."}, status=400)

    try:
        with transaction.atomic():
            batch = ContainerBatch.objects.create(
                bin_size=bin_size,
                waste_stream=waste_stream,
                quantity=quantity,
                supplier=supplier,
                delivery_date=delivery_date,
                notes=notes,
                created_by=_staff_username(request),
            )
            containers = [
                Container.objects.create(
                    batch=batch,
                    bin_size=bin_size,
                    waste_stream=waste_stream,
                    status=Container.STATUS_INACTIVE,
                )
                for _ in range(quantity)
            ]
    except ValidationError as exc:
        messages = exc.messages if hasattr(exc, "messages") else [str(exc)]
        return JsonResponse({"success": False, "message": " ".join(messages)}, status=400)

    return JsonResponse(
        {
            "success": True,
            "message": f"{quantity} containers added to stock.",
            "batch_id": batch.id,
            "containers": [_serialize_container(container) for container in containers],
        },
        status=201,
    )


@csrf_exempt
def assign_containers(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    payload = _parse_json_body(request)
    if payload is None:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    site = get_object_or_404(Site, pk=payload.get("site_id"))
    service = None
    if payload.get("service_id"):
        service = get_object_or_404(Service, pk=payload.get("service_id"))

    status = payload.get("status") or Container.STATUS_ASSIGNED
    if status not in [Container.STATUS_ASSIGNED, Container.STATUS_ACTIVE]:
        return JsonResponse({"success": False, "message": "Containers can only be assigned as Assigned or Active."}, status=400)

    explicit_ids = payload.get("container_ids") or []
    waste_stream = str(payload.get("waste_stream") or getattr(service, "waste_type", "") or "").strip()
    bin_size = str(payload.get("bin_size") or getattr(service, "bin_size", "") or "").strip()

    try:
        quantity = int(payload.get("quantity") or len(explicit_ids) or getattr(service, "bin_count", 0) or 0)
    except (TypeError, ValueError):
        return JsonResponse({"success": False, "message": "Quantity must be a number."}, status=400)

    if quantity < 1:
        return JsonResponse({"success": False, "message": "Choose at least one container."}, status=400)

    available = Container.objects.filter(status=Container.STATUS_INACTIVE)

    if explicit_ids:
        containers = list(available.filter(id__in=explicit_ids).order_by("container_uid")[:quantity])
    else:
        if not waste_stream or not bin_size:
            return JsonResponse({"success": False, "message": "Waste stream and bin size are required for auto assignment."}, status=400)
        containers = list(
            available.filter(waste_stream=waste_stream, bin_size=bin_size).order_by("created_at", "id")[:quantity]
        )

    if len(containers) < quantity:
        return JsonResponse(
            {
                "success": False,
                "message": f"Only {len(containers)} matching inactive container(s) are available.",
            },
            status=400,
        )

    now = timezone.now()
    for container in containers:
        container.site = site
        container.service = service
        container.status = status
        container.assigned_at = container.assigned_at or now
        if status == Container.STATUS_ACTIVE:
            container.delivered_at = container.delivered_at or now
        container.save()

    return JsonResponse(
        {
            "success": True,
            "message": f"{len(containers)} container(s) assigned to {site.site_name}.",
            "containers": [_serialize_container(container) for container in containers],
        }
    )


def _assign_replacement_for_container(container):
    if not container.site_id:
        return None

    replacement = (
        Container.objects.filter(
            status=Container.STATUS_INACTIVE,
            waste_stream=container.waste_stream,
            bin_size=container.bin_size,
        )
        .exclude(pk=container.pk)
        .order_by("created_at", "id")
        .first()
    )

    if not replacement:
        return None

    replacement.site = container.site
    replacement.service = container.service
    replacement.status = Container.STATUS_ASSIGNED
    replacement.assigned_at = timezone.now()
    replacement.notes = (
        f"{replacement.notes}\nReplacement for {container.container_uid} marked EOL."
        if replacement.notes
        else f"Replacement for {container.container_uid} marked EOL."
    )
    replacement.save()
    return replacement


@csrf_exempt
def container_detail(request, container_id):
    container = get_object_or_404(Container.objects.select_related("site__customer", "service"), pk=container_id)

    if request.method == "GET":
        return JsonResponse({"success": True, "container": _serialize_container(container, include_history=True)})

    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    payload = _parse_json_body(request)
    if payload is None:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    status = payload.get("status", container.status)
    if status not in {value for value, _ in Container.STATUS_CHOICES}:
        return JsonResponse({"success": False, "message": "Invalid container status."}, status=400)

    eol_reactivation_reason = str(payload.get("eol_reactivation_reason") or "").strip()
    if container.status == Container.STATUS_EOL and status != Container.STATUS_EOL and not eol_reactivation_reason:
        return JsonResponse(
            {"success": False, "message": "Add a reason before changing an EOL container back to another status."},
            status=400,
        )

    if "notes" in payload:
        container.notes = str(payload.get("notes") or "")

    replacement = None
    previous_site_id = container.site_id
    previous_status = container.status

    if previous_status == Container.STATUS_EOL and status != Container.STATUS_EOL:
        container.eol_at = None

    if status == Container.STATUS_INACTIVE:
        container.status = status
    elif status == Container.STATUS_EOL:
        container.status = status
        container.eol_at = container.eol_at or timezone.now()
    elif status == Container.STATUS_MAINTENANCE:
        container.status = status
    elif status in [Container.STATUS_ASSIGNED, Container.STATUS_ACTIVE]:
        if payload.get("site_id"):
            container.site = get_object_or_404(Site, pk=payload.get("site_id"))
        if payload.get("service_id"):
            container.service = get_object_or_404(Service, pk=payload.get("service_id"))
        container.status = status
        container.assigned_at = container.assigned_at or timezone.now()
        if status == Container.STATUS_ACTIVE:
            container.delivered_at = container.delivered_at or timezone.now()

    try:
        with transaction.atomic():
            container.save()
            if previous_status == Container.STATUS_EOL and status != Container.STATUS_EOL:
                ContainerMaintenanceEvent.objects.create(
                    container=container,
                    status=ContainerMaintenanceEvent.STATUS_RESOLVED,
                    title=f"EOL status changed to {_choice_label(Container.STATUS_CHOICES, status)}",
                    notes=eol_reactivation_reason,
                    reported_by=_staff_username(request),
                    resolved_at=timezone.now(),
                )
            if (
                status == Container.STATUS_EOL
                and previous_site_id
                and previous_status in [Container.STATUS_ASSIGNED, Container.STATUS_ACTIVE, Container.STATUS_MAINTENANCE]
            ):
                replacement = _assign_replacement_for_container(container)
    except ValidationError as exc:
        messages = exc.messages if hasattr(exc, "messages") else [str(exc)]
        return JsonResponse({"success": False, "message": " ".join(messages)}, status=400)

    replacement_message = ""
    if status == Container.STATUS_EOL and previous_site_id:
        replacement_message = (
            f" Replacement container {replacement.container_uid} was assigned automatically."
            if replacement
            else " No matching in-stock replacement container was available."
        )

    return JsonResponse(
        {
            "success": True,
            "message": f"Container updated.{replacement_message}",
            "container": _serialize_container(container, include_history=True),
            "replacement": _serialize_container(replacement) if replacement else None,
        }
    )


@csrf_exempt
def maintenance_list(request):
    if request.method == "GET":
        status = (request.GET.get("status") or "").strip()
        events = ContainerMaintenanceEvent.objects.select_related("container__site__customer").all()
        if status and status != "all":
            events = events.filter(status=status)
        return JsonResponse(
            {
                "success": True,
                "events": [
                    {
                        "id": event.id,
                        "container_id": event.container_id,
                        "container_uid": event.container.container_uid,
                        "container_status": event.container.status,
                        "bin_size_label": event.container.get_bin_size_display(),
                        "waste_stream_label": event.container.get_waste_stream_display(),
                        "site_name": event.container.site.site_name if event.container.site_id else "",
                        "customer_name": event.container.site.customer.business_name if event.container.site_id else "",
                        "title": event.title,
                        "notes": event.notes,
                        "status": event.status,
                        "status_label": event.get_status_display(),
                        "reported_by": event.reported_by,
                        "created_at": event.created_at.isoformat() if event.created_at else "",
                        "resolved_at": event.resolved_at.isoformat() if event.resolved_at else "",
                    }
                    for event in events
                ],
            }
        )

    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    payload = _parse_json_body(request)
    if payload is None:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    container = get_object_or_404(Container, pk=payload.get("container_id"))
    title = str(payload.get("title") or "").strip()
    notes = str(payload.get("notes") or "").strip()

    if not title:
        return JsonResponse({"success": False, "message": "Maintenance title is required."}, status=400)

    event = ContainerMaintenanceEvent.objects.create(
        container=container,
        title=title,
        notes=notes,
        reported_by=_staff_username(request),
    )

    container.status = Container.STATUS_MAINTENANCE
    container.save()

    return JsonResponse(
        {
            "success": True,
            "message": "Maintenance event created.",
            "event_id": event.id,
        },
        status=201,
    )


def change_log(request):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    source = (request.GET.get("source") or "all").strip().lower()
    search = (request.GET.get("search") or "").strip().lower()
    try:
        limit = min(max(int(request.GET.get("limit") or 100), 1), 250)
    except (TypeError, ValueError):
        limit = 100

    rows = []

    if source in ["all", "container"]:
        events = ContainerMaintenanceEvent.objects.select_related(
            "container__site__customer"
        ).order_by("-created_at", "-id")[:300]
        for event in events:
            container = event.container
            site = container.site
            customer = site.customer if site and site.customer_id else None
            rows.append(
                {
                    "id": f"container-{event.id}",
                    "source": "container",
                    "source_label": "Container",
                    "title": event.title,
                    "description": event.notes,
                    "actor": event.reported_by,
                    "created_at": event.created_at.isoformat() if event.created_at else "",
                    "object_id": container.id,
                    "object_label": container.container_uid,
                    "object_detail": " - ".join(
                        item
                        for item in [
                            container.get_waste_stream_display(),
                            container.get_bin_size_display(),
                            site.site_name if site else "In stock",
                            customer.business_name if customer else "",
                        ]
                        if item
                    ),
                    "status_label": event.get_status_display(),
                    "href": "/containers",
                }
            )

    if source in ["all", "customer"]:
        activities = CustomerActivity.objects.select_related("customer", "site").order_by("-created_at", "-id")[:300]
        for activity in activities:
            rows.append(
                {
                    "id": f"customer-{activity.id}",
                    "source": "customer",
                    "source_label": "Customer",
                    "title": activity.title,
                    "description": activity.description,
                    "actor": activity.created_by,
                    "created_at": activity.created_at.isoformat() if activity.created_at else "",
                    "object_id": activity.customer_id,
                    "object_label": activity.customer.business_name if activity.customer_id else "Customer",
                    "object_detail": activity.site.site_name if activity.site_id else activity.get_activity_type_display(),
                    "status_label": activity.get_activity_type_display(),
                    "href": f"/customers/{activity.customer_id}" if activity.customer_id else "/customers",
                }
            )

    if search:
        rows = [
            row
            for row in rows
            if search
            in " ".join(
                [
                    row["source_label"],
                    row["title"],
                    row["description"],
                    row["actor"],
                    row["object_label"],
                    row["object_detail"],
                    row["status_label"],
                ]
            ).lower()
        ]

    rows.sort(key=lambda row: row["created_at"] or "", reverse=True)
    rows = rows[:limit]

    return JsonResponse(
        {
            "success": True,
            "rows": rows,
            "sources": [
                {"value": "all", "label": "All changes"},
                {"value": "container", "label": "Containers"},
                {"value": "customer", "label": "Customers"},
            ],
            "summary": {
                "total": len(rows),
                "containers": sum(1 for row in rows if row["source"] == "container"),
                "customers": sum(1 for row in rows if row["source"] == "customer"),
            },
        }
    )
