import json
import re
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.core import signing
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.html import escape
from django.views.decorators.csrf import csrf_exempt

from accounts_api.company_branding import get_company_details, get_company_logo_url, get_company_name
from accounts_api.models import StaffProfile
from accounts_api.views import get_request_user_from_request, get_staff_role
from crm_email.services import send_staff_mailbox_email
from documents.models import GeneratedDocument, SignedPackDocument, SigningPack
from jobs.models import Job
from purchase_orders.models import StaffNotification
from quotes.models import Quote, QuoteDocument
from services.models import Service

from .models import (
    Customer,
    CustomerActivity,
    CustomerInvoice,
    CustomerInvoiceLine,
    CustomerNote,
    Site,
    create_customer_activity,
)

User = get_user_model()
CUSTOMER_PORTAL_SALT = "recyclr.customer.portal.v1"


def _safe_email_status(email_status):
    status = str(email_status or "not sent").strip()
    status = re.sub(r"<[^>]+>", "", status)
    if status.lower().startswith("failed:"):
        return "failed"
    return status or "not sent"


def _money(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _decimal_money(value):
    try:
        return Decimal(str(value or "0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception:
        return Decimal("0.00")


def _billing_payload(customer):
    return {
        "invoice_requires_po": bool(getattr(customer, "invoice_requires_po", False)),
        "invoice_payment_terms_days": int(getattr(customer, "invoice_payment_terms_days", 30) or 30),
        "invoice_email": getattr(customer, "invoice_email", "") or "",
        "invoice_po_number": getattr(customer, "invoice_po_number", "") or "",
        "auto_invoice_enabled": bool(getattr(customer, "auto_invoice_enabled", True)),
        "next_invoice_date": customer.next_invoice_date.isoformat() if getattr(customer, "next_invoice_date", None) else "",
        "last_invoiced_at": customer.last_invoiced_at.isoformat() if getattr(customer, "last_invoiced_at", None) else "",
    }


def _invoice_payload(invoice):
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "customer_id": invoice.customer_id,
        "customer_name": invoice.customer.business_name if invoice.customer else "",
        "issue_date": invoice.issue_date.isoformat() if invoice.issue_date else "",
        "due_date": invoice.due_date.isoformat() if invoice.due_date else "",
        "period_start": invoice.period_start.isoformat() if invoice.period_start else "",
        "period_end": invoice.period_end.isoformat() if invoice.period_end else "",
        "po_required": invoice.po_required,
        "po_number": invoice.po_number,
        "payment_terms_days": invoice.payment_terms_days,
        "subtotal": float(invoice.subtotal or 0),
        "vat_amount": float(invoice.vat_amount or 0),
        "total": float(invoice.total or 0),
        "status": invoice.status,
        "created_at": invoice.created_at.isoformat() if invoice.created_at else "",
        "sent_at": invoice.sent_at.isoformat() if invoice.sent_at else "",
        "lines": [
            {
                "id": line.id,
                "service_id": line.service_id,
                "description": line.description,
                "quantity": float(line.quantity or 0),
                "unit_price": float(line.unit_price or 0),
                "line_total": float(line.line_total or 0),
            }
            for line in invoice.lines.all()
        ],
    }


def _service_monthly_value(service):
    return _decimal_money(
        getattr(service, "monthly_value", 0)
        or getattr(service, "monthly_charge", 0)
        or getattr(service, "monthly_total", 0)
        or getattr(service, "price_per_month", 0)
        or 0
    )


def _build_invoice_for_customer(customer, *, issue_date=None, period_start=None, period_end=None):
    issue_date = issue_date or timezone.localdate()
    period_start = period_start or issue_date.replace(day=1)
    period_end = period_end or issue_date
    terms_days = int(customer.invoice_payment_terms_days or 30)
    due_date = issue_date + timedelta(days=terms_days)
    company = get_company_details()
    vat_rate = _decimal_money(getattr(company, "vat_rate", 20))
    services = (
        Service.objects.filter(customer=customer, status="active")
        .select_related("site")
        .order_by("site__site_name", "waste_type", "id")
    )

    if not services.exists():
        return None, "No active services to invoice."

    subtotal = Decimal("0.00")
    invoice = CustomerInvoice.objects.create(
        customer=customer,
        issue_date=issue_date,
        due_date=due_date,
        period_start=period_start,
        period_end=period_end,
        po_required=customer.invoice_requires_po,
        po_number=customer.invoice_po_number or "",
        payment_terms_days=terms_days,
        status=(
            CustomerInvoice.STATUS_PENDING_PO
            if customer.invoice_requires_po and not customer.invoice_po_number
            else CustomerInvoice.STATUS_READY
        ),
    )

    for service in services:
        line_total = _service_monthly_value(service)
        if line_total <= 0:
            continue
        description = (
            f"{_pretty_waste_type(service.waste_type)} - "
            f"{_pretty_bin_size(service.bin_size)} x {service.bin_count} "
            f"at {service.site.site_name if service.site else customer.business_name}"
        )
        CustomerInvoiceLine.objects.create(
            invoice=invoice,
            service=service,
            description=description,
            quantity=1,
            unit_price=line_total,
            line_total=line_total,
        )
        subtotal += line_total

    if subtotal <= 0:
        invoice.delete()
        return None, "Active services have no monthly value to invoice."

    vat_amount = (subtotal * vat_rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total = (subtotal + vat_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    invoice.subtotal = subtotal
    invoice.vat_amount = vat_amount
    invoice.total = total
    invoice.save(update_fields=["subtotal", "vat_amount", "total", "updated_at"])

    customer.last_invoiced_at = timezone.now()
    customer.next_invoice_date = issue_date + timedelta(days=30)
    customer.save(update_fields=["last_invoiced_at", "next_invoice_date", "updated_at"])

    create_customer_activity(
        customer=customer,
        activity_type="system",
        title="Invoice generated",
        description=f"{invoice.invoice_number} generated for GBP {invoice.total}.",
        created_by="CRM invoicing",
    )
    return invoice, ""


def _customer_status(customer):
    return getattr(customer, "status", "active") or "active"


def _serialize_account_manager(user):
    if not user:
        return None
    profile = getattr(user, "staff_profile", None)
    display_name = user.get_full_name() or user.username
    return {
        "id": user.id,
        "username": user.username,
        "name": display_name,
        "company_email": getattr(profile, "company_email", "") or "",
        "company_phone": getattr(profile, "company_phone", "") or "",
        "job_title": getattr(profile, "job_title", "") or "",
    }


def _can_change_account_manager(user):
    return bool(user and get_staff_role(user) in {"admin", "manager"})


def _default_mailbox_user():
    profile = (
        StaffProfile.objects.select_related("user")
        .filter(mailbox_enabled=True, user__is_active=True)
        .exclude(mailbox_password="")
        .order_by("user__id")
        .first()
    )
    return profile.user if profile else None


def _staff_display_name(user):
    return user.get_full_name() or user.username if user else "your account manager"


def _staff_email(user):
    profile = getattr(user, "staff_profile", None)
    return getattr(profile, "company_email", "") or getattr(user, "email", "") or ""


def _staff_phone(user):
    profile = getattr(user, "staff_profile", None)
    return getattr(profile, "company_phone", "") or ""


def _mailbox_ready(user):
    profile = getattr(user, "staff_profile", None)
    return bool(profile and profile.mailbox_enabled and profile.mailbox_password)


def _portal_company_payload():
    company = get_company_details()
    return {
        "name": get_company_name(company),
        "logo_data": "",
        "logo_url": get_company_logo_url(company),
        "email": getattr(company, "main_email", "") or "",
        "phone": getattr(company, "phone_number", "") or "",
        "website": getattr(company, "website", "") or "",
    }


def _make_customer_portal_token(customer):
    return signing.dumps(
        {
            "customer_id": customer.id,
            "email": (customer.email or "").strip().lower(),
        },
        salt=CUSTOMER_PORTAL_SALT,
    )


def _customer_from_portal_request(request):
    token = (
        request.headers.get("X-Customer-Portal-Token")
        or request.GET.get("token")
        or request.POST.get("token")
        or ""
    )
    if not token:
        return None

    try:
        data = signing.loads(token, salt=CUSTOMER_PORTAL_SALT, max_age=60 * 60 * 24 * 30)
    except signing.BadSignature:
        return None

    customer = (
        Customer.objects.select_related("account_manager", "account_manager__staff_profile")
        .filter(
            id=data.get("customer_id"),
            email__iexact=(data.get("email") or "").strip(),
        )
        .first()
    )
    return customer


def _portal_document_download_url(document_id):
    return f"/api/customers/portal/documents/{document_id}/download/"


def _portal_signed_document_download_url(document_id):
    return f"/api/customers/portal/signed-documents/{document_id}/download/"


def _serialize_portal_service(service):
    monthly_value = (
        getattr(service, "monthly_value", 0)
        or getattr(service, "monthly_charge", 0)
        or getattr(service, "monthly_total", 0)
        or getattr(service, "price_per_month", 0)
        or 0
    )
    days = []
    if hasattr(service, "get_collection_days_display_list"):
        days = service.get_collection_days_display_list()

    return {
        "id": service.id,
        "site_id": service.site_id,
        "site_name": service.site.site_name if service.site else "-",
        "waste_type": _pretty_waste_type(getattr(service, "waste_type", "")),
        "bin_size": _pretty_bin_size(getattr(service, "bin_size", "")),
        "bin_count": getattr(service, "bin_count", 0) or 0,
        "collections_per_week": getattr(service, "collections_per_week", 0) or 0,
        "collection_days": days,
        "schedule_start_date": (
            service.schedule_start_date.isoformat()
            if getattr(service, "schedule_start_date", None)
            else ""
        ),
        "status": getattr(service, "status", "") or "",
        "monthly_value": float(monthly_value or 0),
    }


def _serialize_portal_job(job):
    return {
        "id": job.id,
        "collection_date": job.collection_date.isoformat() if job.collection_date else "",
        "customer_name": job.customer.business_name if job.customer else "",
        "site_name": job.site.site_name if job.site else "",
        "site_address": _site_address(job.site) if job.site else "",
        "waste_type": _pretty_waste_type(getattr(job, "waste_type", "")),
        "bin_size": _pretty_bin_size(getattr(job, "bin_size", "")),
        "bin_quantity": getattr(job, "bin_quantity", 0) or 0,
        "status": getattr(job, "status", "") or "",
        "completed_at": job.completed_at.isoformat() if job.completed_at else "",
        "failure_reason": getattr(job, "failure_reason", "") or "",
    }


def _serialize_portal_generated_document(document):
    return {
        "id": document.id,
        "title": document.title,
        "type": document.document_type,
        "type_label": document.get_document_type_display(),
        "status": document.status,
        "site_name": document.site.site_name if document.site else "",
        "created_at": document.created_at.isoformat() if document.created_at else "",
        "filename": document.filename(),
        "download_url": _portal_document_download_url(document.id) if document.file else "",
    }


def _serialize_portal_signed_document(document):
    return {
        "id": document.id,
        "title": document.title,
        "created_at": document.created_at.isoformat() if document.created_at else "",
        "filename": document.filename(),
        "download_url": _portal_signed_document_download_url(document.id) if document.file else "",
    }


def _serialize_portal_signing_pack(pack):
    return {
        "id": pack.id,
        "quote_number": pack.quote.quote_number if pack.quote else "",
        "status": pack.status,
        "sent_at": pack.sent_at.isoformat() if pack.sent_at else "",
        "viewed_at": pack.viewed_at.isoformat() if pack.viewed_at else "",
        "signed_at": pack.signed_at.isoformat() if pack.signed_at else "",
        "expires_at": pack.expires_at.isoformat() if pack.expires_at else "",
        "sign_url": f"/sign/{pack.token}",
        "document_count": pack.documents.count(),
    }


def _customer_portal_payload(customer):
    today = timezone.localdate()
    services = (
        Service.objects.filter(customer=customer)
        .select_related("site")
        .order_by("site__site_name", "waste_type", "id")
    )
    sites = Site.objects.filter(customer=customer).order_by("site_name", "id")
    upcoming_jobs = (
        Job.objects.filter(customer=customer, collection_date__gte=today)
        .select_related("customer", "site", "service")
        .order_by("collection_date", "id")[:20]
    )
    recent_jobs = (
        Job.objects.filter(customer=customer, collection_date__lt=today)
        .select_related("customer", "site", "service")
        .order_by("-collection_date", "-id")[:20]
    )
    generated_documents = (
        GeneratedDocument.objects.filter(customer=customer)
        .select_related("site", "quote")
        .order_by("-created_at", "-id")[:30]
    )
    signed_documents = (
        SignedPackDocument.objects.filter(pack__customer=customer)
        .select_related("pack", "source_document")
        .order_by("-created_at", "-id")[:30]
    )
    signing_packs = (
        SigningPack.objects.filter(customer=customer)
        .select_related("quote", "site")
        .prefetch_related("documents")
        .exclude(status="cancelled")
        .order_by("-created_at", "-id")[:10]
    )

    service_rows = [_serialize_portal_service(service) for service in services]
    active_services = [row for row in service_rows if row["status"] == "active"]
    monthly_value = sum(row["monthly_value"] for row in service_rows)

    return {
        "success": True,
        "company": _portal_company_payload(),
        "customer": {
            "id": customer.id,
            "customer_uid": customer.customer_uid or "",
            "business_name": customer.business_name,
            "contact_name": customer.contact_name,
            "email": customer.email,
            "phone": customer.phone,
            "status": _customer_status(customer),
            "address": {
                "line_1": customer.address_line_1 or "",
                "line_2": customer.address_line_2 or "",
                "town": customer.town or "",
                "county": customer.county or "",
                "postcode": customer.postcode or "",
            },
            "account_manager": _serialize_account_manager(customer.account_manager),
        },
        "summary": {
            "site_count": sites.count(),
            "service_count": len(service_rows),
            "active_service_count": len(active_services),
            "upcoming_collection_count": len(upcoming_jobs),
            "document_count": len(generated_documents) + len(signed_documents),
            "open_signing_pack_count": sum(1 for pack in signing_packs if pack.status != "signed"),
            "monthly_value": float(monthly_value),
        },
        "sites": [
            {
                "id": site.id,
                "site_name": site.site_name,
                "address": _site_address(site),
                "postcode": site.postcode or "",
            }
            for site in sites
        ],
        "services": service_rows,
        "upcoming_jobs": [_serialize_portal_job(job) for job in upcoming_jobs],
        "recent_jobs": [_serialize_portal_job(job) for job in recent_jobs],
        "documents": [_serialize_portal_generated_document(document) for document in generated_documents],
        "signed_documents": [_serialize_portal_signed_document(document) for document in signed_documents],
        "signing_packs": [_serialize_portal_signing_pack(pack) for pack in signing_packs],
    }


def _send_account_manager_changed_email(customer, new_manager, changed_by):
    if not customer.email or not new_manager:
        return "not sent"

    sender = new_manager if _mailbox_ready(new_manager) else _default_mailbox_user()
    if not sender:
        return "no enabled staff mailbox"

    manager_name = _staff_display_name(new_manager)
    manager_email = _staff_email(new_manager)
    manager_phone = _staff_phone(new_manager)
    company_name = get_company_name()
    subject = f"Your {company_name} account manager has changed"
    body = (
        f"Hi {customer.contact_name or 'there'},\n\n"
        f"Your {company_name} account manager is now {manager_name}.\n\n"
        f"{'Email: ' + manager_email if manager_email else ''}\n"
        f"{'Phone: ' + manager_phone if manager_phone else ''}\n\n"
        f"They will be your main point of contact for your {company_name} account.\n\n"
        f"Thanks,\n{company_name}"
    )
    html = f"""
        <p>Hi {escape(customer.contact_name or 'there')},</p>
        <p>Your {escape(company_name)} account manager is now <strong>{escape(manager_name)}</strong>.</p>
        {f"<p>Email: {escape(manager_email)}</p>" if manager_email else ""}
        {f"<p>Phone: {escape(manager_phone)}</p>" if manager_phone else ""}
        <p>They will be your main point of contact for your {escape(company_name)} account.</p>
        <p>Thanks,<br />{escape(company_name)}</p>
    """
    send_staff_mailbox_email(
        user=sender,
        subject=subject,
        message=body,
        html_message=html,
        to_emails=[customer.email],
    )
    return "sent"


def _pretty_waste_type(value):
    mapping = {
        "general": "General Waste",
        "mixed_recycling": "Mixed Recycling",
        "recycling": "Recycling",
        "glass": "Glass",
        "food": "Food",
    }
    return mapping.get(value, str(value).replace("_", " ").title())


def _pretty_bin_size(value):
    if not value:
        return ""
    value = str(value)
    return f"{value}L" if value.isdigit() else value


def _site_address(site):
    parts = [
        site.address_line_1 or "",
        site.address_line_2 or "",
        site.town or "",
        site.county or "",
        site.postcode or "",
    ]
    return ", ".join([part for part in parts if part])


def _serialize_activity(activity):
    return {
        "id": activity.id,
        "activity_type": activity.activity_type,
        "title": activity.title,
        "description": activity.description or "",
        "created_by": activity.created_by or "",
        "created_at": activity.created_at.isoformat() if activity.created_at else "",
        "site_name": activity.site.site_name if activity.site else "",
        "related_quote_number": activity.related_quote_number or "",
        "related_service_id": activity.related_service_id,
        "related_document_id": activity.related_document_id,
    }


def customers_list(request):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    customers = Customer.objects.select_related("account_manager", "account_manager__staff_profile").all().order_by("id")

    data = []
    for customer in customers:
        data.append(
            {
                "id": customer.id,
                "customer_uid": customer.customer_uid or "",
                "business_name": customer.business_name,
                "contact_name": customer.contact_name,
                "email": customer.email,
                "phone": customer.phone,
                "status": customer.status,
                "account_manager": _serialize_account_manager(customer.account_manager),
                "created_at": customer.created_at.isoformat() if customer.created_at else "",
                "town": customer.town or "",
                "county": customer.county or "",
                "postcode": customer.postcode or "",
                "sites": [
                    {
                        "id": site.id,
                        "site_name": site.site_name or "",
                        "address_line_1": site.address_line_1 or "",
                        "address_line_2": site.address_line_2 or "",
                        "town": site.town or "",
                        "county": site.county or "",
                        "postcode": site.postcode or "",
                    }
                    for site in customer.sites.all().order_by("site_name", "id")
                ],
            }
        )

    return JsonResponse(data, safe=False)


@csrf_exempt
def customer_detail(request, customer_id):
    customer = get_object_or_404(
        Customer.objects.select_related("account_manager", "account_manager__staff_profile"),
        pk=customer_id,
    )

    if request.method == "GET":
        return JsonResponse(
            {
                "id": customer.id,
                "customer_uid": customer.customer_uid or "",
                "business_name": customer.business_name,
                "contact_name": customer.contact_name,
                "email": customer.email,
                "phone": customer.phone,
                "status": customer.status,
                "account_manager": _serialize_account_manager(customer.account_manager),
                "notes": customer.notes or "",
                "address_line_1": customer.address_line_1 or "",
                "address_line_2": customer.address_line_2 or "",
                "town": customer.town or "",
                "county": customer.county or "",
                "postcode": customer.postcode or "",
                "billing": _billing_payload(customer),
                "portal": {
                    "enabled": customer.portal_enabled,
                    "has_password": bool(customer.portal_password_hash),
                },
                "created_at": customer.created_at.isoformat() if customer.created_at else "",
                "updated_at": customer.updated_at.isoformat() if customer.updated_at else "",
            }
        )

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        customer.business_name = payload.get("business_name", "") or ""
        customer.contact_name = payload.get("contact_name", "") or ""
        customer.email = payload.get("email", "") or ""
        customer.phone = payload.get("phone", "") or ""
        customer.status = payload.get("status", "active") or "active"
        customer.notes = payload.get("notes", "") or ""
        customer.address_line_1 = payload.get("address_line_1", "") or ""
        customer.address_line_2 = payload.get("address_line_2", "") or ""
        customer.town = payload.get("town", "") or ""
        customer.county = payload.get("county", "") or ""
        customer.postcode = payload.get("postcode", "") or ""
        billing = payload.get("billing") or {}
        customer.invoice_requires_po = bool(billing.get("invoice_requires_po", payload.get("invoice_requires_po", False)))
        try:
            terms_days = int(billing.get("invoice_payment_terms_days", payload.get("invoice_payment_terms_days", 30)) or 30)
        except (TypeError, ValueError):
            terms_days = 30
        customer.invoice_payment_terms_days = terms_days if terms_days in {7, 14, 30} else 30
        customer.invoice_email = billing.get("invoice_email", payload.get("invoice_email", "")) or ""
        customer.invoice_po_number = billing.get("invoice_po_number", payload.get("invoice_po_number", "")) or ""
        customer.auto_invoice_enabled = bool(billing.get("auto_invoice_enabled", payload.get("auto_invoice_enabled", True)))
        portal = payload.get("portal") or {}
        customer.portal_enabled = bool(portal.get("enabled", payload.get("portal_enabled", customer.portal_enabled)))
        portal_password = str(portal.get("password") or "").strip()
        if portal_password:
            if len(portal_password) < 8:
                return JsonResponse(
                    {"success": False, "message": "Customer portal password must be at least 8 characters."},
                    status=400,
                )
            customer.portal_password_hash = make_password(portal_password)
        customer.save()

        return JsonResponse(
            {
                "success": True,
                "message": "Customer updated successfully.",
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def customer_account_manager_update(request, customer_id):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    acting_user = get_request_user_from_request(request)
    if not acting_user:
        return JsonResponse({"success": False, "message": "Please sign in again."}, status=401)
    if not _can_change_account_manager(acting_user):
        return JsonResponse(
            {"success": False, "message": "Only Admin or Manager can change account managers."},
            status=403,
        )

    customer = get_object_or_404(
        Customer.objects.select_related("account_manager", "account_manager__staff_profile"),
        pk=customer_id,
    )

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    manager_id = payload.get("account_manager_id")
    if not manager_id:
        return JsonResponse({"success": False, "message": "Choose an account manager."}, status=400)

    new_manager = get_object_or_404(
        User.objects.select_related("staff_profile").filter(is_staff=True, is_active=True),
        pk=manager_id,
    )
    old_manager = customer.account_manager

    if old_manager and old_manager.id == new_manager.id:
        return JsonResponse(
            {
                "success": True,
                "message": "Account manager is already set to this staff member.",
                "account_manager": _serialize_account_manager(new_manager),
            }
        )

    customer.account_manager = new_manager
    customer.save(update_fields=["account_manager", "updated_at"])

    email_status = "not sent"
    try:
        email_status = _send_account_manager_changed_email(customer, new_manager, acting_user)
    except Exception as exc:
        email_status = f"failed: {exc}"
    safe_email_status = _safe_email_status(email_status)

    create_customer_activity(
        customer=customer,
        activity_type="system",
        title="Account manager changed",
        description=(
            f"Account manager changed from {_staff_display_name(old_manager)} "
            f"to {_staff_display_name(new_manager)} by {_staff_display_name(acting_user)}. "
            f"Customer email status: {safe_email_status}."
        ),
        created_by=_staff_display_name(acting_user),
    )

    StaffNotification.objects.create(
        recipient=new_manager,
        notification_type=StaffNotification.TYPE_GENERAL,
        title=f"You are now account manager for {customer.business_name}",
        message="Please review the customer account and make sure any open setup actions are moving.",
        target_url=f"/customers/{customer.id}",
        source_type="customer_account_manager",
        source_id=customer.id,
    )

    return JsonResponse(
        {
            "success": True,
            "message": "Account manager updated.",
            "email_status": safe_email_status,
            "account_manager": _serialize_account_manager(new_manager),
        }
    )


@csrf_exempt
def customer_notes_create(request, customer_id):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    customer = get_object_or_404(
        Customer.objects.select_related("account_manager", "account_manager__staff_profile"),
        pk=customer_id,
    )

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    note_text = (payload.get("note") or "").strip()
    created_by = (payload.get("created_by") or "").strip()

    if not note_text:
        return JsonResponse({"success": False, "message": "Note cannot be empty."}, status=400)

    note = CustomerNote.objects.create(
        customer=customer,
        note=note_text,
        created_by=created_by,
    )

    create_customer_activity(
        customer=customer,
        activity_type="note",
        title=f"Customer note added by {created_by or 'Unknown'}",
        description=note_text,
        created_by=created_by,
    )

    return JsonResponse(
        {
            "success": True,
            "message": "Customer note added.",
            "note": {
                "id": note.id,
                "note": note.note,
                "created_by": note.created_by,
                "created_at": note.created_at.isoformat() if note.created_at else "",
            },
        }
    )


def customer_invoices_list(request, customer_id):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    customer = get_object_or_404(Customer, pk=customer_id)
    invoices = (
        CustomerInvoice.objects.filter(customer=customer)
        .prefetch_related("lines")
        .order_by("-issue_date", "-id")
    )
    return JsonResponse({"success": True, "invoices": [_invoice_payload(invoice) for invoice in invoices]})


@csrf_exempt
def customer_invoice_generate(request, customer_id):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    customer = get_object_or_404(Customer, pk=customer_id)
    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    issue_date = timezone.localdate()
    period_start = None
    period_end = None
    for field_name in ("issue_date", "period_start", "period_end"):
        value = payload.get(field_name)
        if not value:
            continue
        try:
            parsed = timezone.datetime.fromisoformat(value).date()
        except ValueError:
            return JsonResponse({"success": False, "message": f"{field_name.replace('_', ' ').title()} is not valid."}, status=400)
        if field_name == "issue_date":
            issue_date = parsed
        elif field_name == "period_start":
            period_start = parsed
        elif field_name == "period_end":
            period_end = parsed

    invoice, reason = _build_invoice_for_customer(
        customer,
        issue_date=issue_date,
        period_start=period_start,
        period_end=period_end,
    )
    if not invoice:
        return JsonResponse({"success": False, "message": reason or "Could not generate invoice."}, status=400)

    invoice = CustomerInvoice.objects.prefetch_related("lines").get(pk=invoice.pk)
    return JsonResponse(
        {
            "success": True,
            "message": (
                "Invoice generated but waiting for a PO number."
                if invoice.status == CustomerInvoice.STATUS_PENDING_PO
                else "Invoice generated and ready to send."
            ),
            "invoice": _invoice_payload(invoice),
        }
    )


def customer_overview(request, customer_id):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    customer = get_object_or_404(Customer, pk=customer_id)

    sites = Site.objects.filter(customer=customer).order_by("id")
    services = Service.objects.filter(customer=customer).select_related("site").order_by("id")
    quotes = (
        Quote.objects.filter(customer=customer)
        .select_related("site")
        .prefetch_related("documents")
        .order_by("-id")
    )
    documents = (
        QuoteDocument.objects.filter(quote__customer=customer)
        .select_related("quote")
        .order_by("-created_at")
    )
    note_entries = CustomerNote.objects.filter(customer=customer).order_by("-created_at", "-id")
    activity_entries = (
        CustomerActivity.objects.filter(customer=customer)
        .select_related("site")
        .order_by("-created_at", "-id")
    )
    invoices = (
        CustomerInvoice.objects.filter(customer=customer)
        .prefetch_related("lines")
        .order_by("-issue_date", "-id")[:20]
    )

    total_monthly_value = 0.0
    active_services = 0

    service_rows = []
    for service in services:
        monthly_value = (
            getattr(service, "monthly_value", 0)
            or getattr(service, "monthly_charge", 0)
            or getattr(service, "monthly_total", 0)
            or getattr(service, "price_per_month", 0)
            or 0
        )
        total_monthly_value += float(monthly_value or 0)

        status = getattr(service, "status", "active") or "active"
        if str(status).lower() == "active":
            active_services += 1

        service_rows.append(
            {
                "id": service.id,
                "site_name": service.site.site_name if service.site else "-",
                "waste_type": _pretty_waste_type(getattr(service, "waste_type", "")),
                "bin_size": _pretty_bin_size(getattr(service, "bin_size", "")),
                "status": status,
                "collections_per_week": getattr(service, "collections_per_week", 0),
                "monthly_value": float(monthly_value or 0),
            }
        )

    site_rows = []
    for site in sites:
        site_rows.append(
            {
                "id": site.id,
                "site_name": site.site_name,
                "address": _site_address(site),
                "postcode": site.postcode or "",
            }
        )

    quote_rows = []
    latest_quote_status = ""
    for quote in quotes:
        if not latest_quote_status:
            latest_quote_status = quote.status

        quote_rows.append(
            {
                "id": quote.id,
                "quote_number": quote.quote_number,
                "title": quote.title,
                "status": quote.status,
                "site_name": quote.site.site_name if quote.site else "-",
                "total_per_month": _money(quote.total_per_month),
                "created_at": quote.created_at.isoformat() if quote.created_at else "",
                "document_count": quote.documents.count(),
            }
        )

    document_rows = []
    for document in documents:
        document_rows.append(
            {
                "id": document.id,
                "quote_id": document.quote.id,
                "quote_number": document.quote.quote_number,
                "filename": document.file.name.split("/")[-1] if document.file else "",
                "version_number": document.version_number,
                "created_at": document.created_at.isoformat() if document.created_at else "",
                "file_size_bytes": document.file_size_bytes,
                "download_url": f"/api/quotes/documents/{document.id}/download/",
            }
        )

    notes_rows = []
    for note in note_entries:
        notes_rows.append(
            {
                "id": note.id,
                "note": note.note,
                "created_by": note.created_by,
                "created_at": note.created_at.isoformat() if note.created_at else "",
            }
        )

    activity_rows = [_serialize_activity(activity) for activity in activity_entries]

    response = {
        "customer": {
            "id": customer.id,
            "customer_uid": customer.customer_uid or "",
            "business_name": customer.business_name,
            "contact_name": customer.contact_name,
            "email": customer.email,
            "phone": customer.phone,
            "status": _customer_status(customer),
            "account_manager": _serialize_account_manager(customer.account_manager),
            "billing": _billing_payload(customer),
            "notes": customer.notes or "",
            "created_at": customer.created_at.isoformat() if customer.created_at else "",
        },
        "summary": {
            "site_count": len(site_rows),
            "service_count": len(service_rows),
            "active_service_count": active_services,
            "quote_count": len(quote_rows),
            "document_count": len(document_rows),
            "monthly_value": float(total_monthly_value),
            "latest_quote_status": latest_quote_status or "-",
        },
        "sites": site_rows,
        "services": service_rows,
        "quotes": quote_rows,
        "documents": document_rows,
        "invoices": [_invoice_payload(invoice) for invoice in invoices],
        "note_entries": notes_rows,
        "activity_entries": activity_rows,
    }

    return JsonResponse(response)


def customer_portal_bootstrap(request):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)
    return JsonResponse({"success": True, "company": _portal_company_payload()})


@csrf_exempt
def customer_portal_login(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""
    if not email or not password:
        return JsonResponse(
            {"success": False, "message": "Please enter your email address and password."},
            status=400,
        )

    customer = (
        Customer.objects.select_related("account_manager", "account_manager__staff_profile")
        .filter(email__iexact=email, portal_enabled=True)
        .first()
    )
    if not customer or not customer.portal_password_hash or not check_password(password, customer.portal_password_hash):
        return JsonResponse(
            {"success": False, "message": "Invalid email or password."},
            status=400,
        )

    data = _customer_portal_payload(customer)
    data["token"] = _make_customer_portal_token(customer)
    return JsonResponse(data)


def customer_portal_dashboard(request):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    customer = _customer_from_portal_request(request)
    if not customer:
        return JsonResponse({"success": False, "message": "Your customer portal session has expired."}, status=401)
    return JsonResponse(_customer_portal_payload(customer))


@csrf_exempt
def customer_portal_request(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    customer = _customer_from_portal_request(request)
    if not customer:
        return JsonResponse({"success": False, "message": "Your customer portal session has expired."}, status=401)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

    request_type = (payload.get("request_type") or "general").strip()
    message = (payload.get("message") or "").strip()
    preferred_day = (payload.get("preferred_day") or "").strip()
    site_id = payload.get("site_id")
    site = Site.objects.filter(id=site_id, customer=customer).first() if site_id else None

    request_labels = {
        "general": "General customer portal request",
        "preferred_day": "Preferred collection day request",
        "missed_collection": "Missed collection report",
        "extra_lift": "Additional lift request",
        "document_query": "Document query",
    }
    title = request_labels.get(request_type, "Customer portal request")
    details = []
    if site:
        details.append(f"Site: {site.site_name}")
    if preferred_day:
        details.append(f"Preferred day: {preferred_day}")
    if message:
        details.append(message)
    note = "\n".join(details).strip()
    if not note:
        return JsonResponse({"success": False, "message": "Please add a message for the team."}, status=400)

    activity = create_customer_activity(
        customer=customer,
        site=site,
        activity_type="note",
        title=title,
        description=note,
        created_by=customer.contact_name or customer.email or customer.business_name,
    )

    if customer.account_manager:
        StaffNotification.objects.create(
            recipient=customer.account_manager,
            notification_type=StaffNotification.TYPE_GENERAL,
            title=title,
            message=f"{customer.business_name}: {note[:220]}",
            target_url=f"/customers/{customer.id}",
            source_type="customer_portal_request",
            source_id=activity.id,
        )

    return JsonResponse({"success": True, "message": "Your request has been sent to the team."})


def customer_portal_document_download(request, document_id):
    customer = _customer_from_portal_request(request)
    if not customer:
        return JsonResponse({"success": False, "message": "Your customer portal session has expired."}, status=401)

    document = get_object_or_404(GeneratedDocument, id=document_id, customer=customer)
    if not document.file:
        raise Http404("Document file not found.")
    return FileResponse(document.file.open("rb"), as_attachment=True, filename=document.filename())


def customer_portal_signed_document_download(request, document_id):
    customer = _customer_from_portal_request(request)
    if not customer:
        return JsonResponse({"success": False, "message": "Your customer portal session has expired."}, status=401)

    document = get_object_or_404(SignedPackDocument, id=document_id, pack__customer=customer)
    if not document.file:
        raise Http404("Signed document file not found.")
    return FileResponse(document.file.open("rb"), as_attachment=True, filename=document.filename())


def sites_list(request):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    sites = Site.objects.select_related("customer").order_by("id")

    data = []
    for site in sites:
        data.append(
            {
                "id": site.id,
                "site_name": site.site_name,
                "customer_id": site.customer.id if site.customer else None,
                "customer_name": site.customer.business_name if site.customer else "",
                "address_line_1": site.address_line_1 or "",
                "address_line_2": site.address_line_2 or "",
                "town": site.town or "",
                "county": site.county or "",
                "postcode": site.postcode or "",
                "address": _site_address(site),
                "created_at": site.created_at.isoformat() if site.created_at else "",
            }
        )

    return JsonResponse(data, safe=False)


@csrf_exempt
def site_detail(request, site_id):
    site = get_object_or_404(Site.objects.select_related("customer"), pk=site_id)

    if request.method == "GET":
        return JsonResponse(
            {
                "id": site.id,
                "site_name": site.site_name,
                "customer_id": site.customer.id if site.customer else None,
                "customer_name": site.customer.business_name if site.customer else "",
                "address_line_1": site.address_line_1 or "",
                "address_line_2": site.address_line_2 or "",
                "town": site.town or "",
                "county": site.county or "",
                "postcode": site.postcode or "",
                "created_at": site.created_at.isoformat() if site.created_at else "",
            }
        )

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        site.site_name = payload.get("site_name", "") or ""
        site.address_line_1 = payload.get("address_line_1", "") or ""
        site.address_line_2 = payload.get("address_line_2", "") or ""
        site.town = payload.get("town", "") or ""
        site.county = payload.get("county", "") or ""
        site.postcode = payload.get("postcode", "") or ""
        site.save()

        return JsonResponse(
            {
                "success": True,
                "message": "Site updated successfully.",
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)
