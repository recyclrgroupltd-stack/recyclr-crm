import json
from datetime import datetime, time
from decimal import Decimal, InvalidOperation

from django.contrib.auth.models import User
from django.conf import settings
from django.core import signing
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.utils.html import escape
from django.views.decorators.csrf import csrf_exempt

from accounts_api.company_branding import company_logo_or_name_html, get_company_name
from accounts_api.views import get_request_user_from_request, get_request_user_from_username
from accounts_api.models import CompanyDetails, StaffProfile
from crm_email.services import send_staff_mailbox_email
from customers.models import Customer, Site, create_customer_activity
from documents.models import GeneratedDocument, SigningPack
from documents.services import create_generated_documents_for_quote
from leads.models import Lead
from pricing.models import PriceBookItem
from services.models import Service

from .models import Quote, QuoteDocument, QuoteLine
from .pdf_utils import build_quote_pdf

PENDING_SCHEDULE_STATUS = "pending_schedule"
CUSTOMER_STATUS_ONBOARDING = "onboarding"
CUSTOMER_STATUS_ACTIVE = "active"
QUOTE_ACCEPT_TOKEN_SALT = "recyclr-quote-accept"


def _quote_valid_until_date(quote):
    return quote.valid_until


def _quote_is_expired(quote):
    valid_until = _quote_valid_until_date(quote)
    if not valid_until:
        return False
    return timezone.localdate() > valid_until


def _require_valid_until_value(valid_until_value):
    if not valid_until_value:
        raise ValueError("Please set a valid until date before saving this quote.")


def _require_quote_has_valid_until(quote):
    if not quote.valid_until:
        raise ValueError("Please set a valid until date before sending or downloading this quote.")


def _require_quote_not_expired(quote):
    if _quote_is_expired(quote):
        raise ValueError("This quote has already expired and can no longer be accepted.")



def _decimal_or_zero(value):
    if value in ("", None):
        return Decimal("0.00")

    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")


def _int_or_default(value, default=0):
    if value in ("", None):
        return default

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _date_or_none(value):
    if not value:
        return None
    if hasattr(value, "date") and callable(value.date):
        return value.date()
    if hasattr(value, "strftime"):
        return value
    if isinstance(value, str):
        parsed_date = parse_date(value.strip())
        if parsed_date:
            return parsed_date
    return None


def _datetime_or_none(value):
    if not value:
        return None
    if hasattr(value, "strftime") and hasattr(value, "tzinfo"):
        return value
    if hasattr(value, "strftime"):
        return timezone.make_aware(datetime.combine(value, time.min))
    if isinstance(value, str):
        cleaned = value.strip()
        parsed_datetime = parse_datetime(cleaned)
        if parsed_datetime:
            return parsed_datetime if timezone.is_aware(parsed_datetime) else timezone.make_aware(parsed_datetime)
        parsed_date = parse_date(cleaned)
        if parsed_date:
            return timezone.make_aware(datetime.combine(parsed_date, time.min))
    return None


def _serialize_quote_line(line):
    return {
        "id": line.id,
        "waste_type": line.waste_type,
        "waste_type_label": line.get_waste_type_display(),
        "bin_size": line.bin_size,
        "bin_size_label": line.get_bin_size_display(),
        "bin_count": line.bin_count,
        "collections_per_week": line.collections_per_week,
        "price_per_lift": float(line.price_per_lift),
        "rental_per_day": float(line.rental_per_day),
        "supplier_price_per_lift": float(line.supplier_price_per_lift),
        "supplier_rental_per_day": float(line.supplier_rental_per_day),
        "collection_charge_per_month": float(line.collection_charge_per_month),
        "bin_rental_per_month": float(line.bin_rental_per_month),
        "line_total_per_month": float(line.line_total_per_month),
        "supplier_cost_per_month": float(line.supplier_cost_per_month),
        "margin_per_month": float(line.margin_per_month),
        "margin_percent": float(line.margin_percent),
        "sort_order": line.sort_order,
    }


def _serialize_quote_document(document):
    return {
        "id": document.id,
        "version_number": document.version_number,
        "created_at": document.created_at.isoformat(),
        "file_size_bytes": document.file_size_bytes,
        "filename": document.file.name.split("/")[-1] if document.file else "",
        "download_url": f"/api/quotes/documents/{document.id}/download/",
        "notes": document.notes,
        "quote_id": document.quote.id,
        "quote_number": document.quote.quote_number,
        "quote_title": document.quote.title,
        "customer_name": document.quote.customer.business_name if document.quote.customer else "",
        "site_name": document.quote.site.site_name if document.quote.site else "",
        "contact_name": document.quote.contact_name,
        "email": document.quote.email,
        "status": document.quote.status,
    }


def _serialize_quote(quote, include_lines=False, include_documents=False):
    contract_start_date = _date_or_none(quote.contract_start_date)
    data = {
        "id": quote.id,
        "quote_number": quote.quote_number,
        "title": quote.title,
        "lead_id": quote.lead.id if quote.lead else None,
        "lead_name": quote.lead.company_name if quote.lead else "",
        "customer_id": quote.customer.id if quote.customer else None,
        "customer_name": quote.customer.business_name if quote.customer else "",
        "site_id": quote.site.id if quote.site else None,
        "site_name": quote.site.site_name if quote.site else "",
        "contact_name": quote.contact_name,
        "email": quote.email,
        "sic_code": quote.sic_code,
        "address_line_1": quote.address_line_1,
        "address_line_2": quote.address_line_2,
        "town": quote.town,
        "county": quote.county,
        "postcode": quote.postcode,
        "contract_start_date": contract_start_date.isoformat() if contract_start_date else "",
        "status": quote.status,
        "valid_until": str(quote.valid_until) if quote.valid_until else "",
        "subtotal_per_month": float(quote.subtotal_per_month),
        "bin_rental_per_month": float(quote.bin_rental_per_month),
        "total_per_month": float(quote.total_per_month),
        "supplier_cost_per_month": float(quote.supplier_cost_per_month),
        "margin_per_month": float(quote.margin_per_month),
        "margin_percent": float(quote.margin_percent),
        "notes": quote.notes,
        "internal_notes": quote.internal_notes,
        "created_at": quote.created_at.isoformat(),
        "updated_at": quote.updated_at.isoformat(),
        "line_count": quote.lines.count(),
        "document_count": quote.documents.count(),
    }

    if include_lines:
        data["lines"] = [_serialize_quote_line(line) for line in quote.lines.all()]

    if include_documents:
        data["documents"] = [_serialize_quote_document(document) for document in quote.documents.all()]

    return data


def _pricebook_waste_type_for_lookup(waste_type):
    if waste_type == "mixed_recycling":
        return "recycling"
    return waste_type


def _normalise_bin_size_for_waste_type(waste_type, bin_size):
    if waste_type in ["glass", "food"]:
        return "240"

    if not bin_size:
        return "240"

    return str(bin_size)


def _is_valid_bin_size_for_waste_type(waste_type, bin_size):
    if waste_type in ["glass", "food"]:
        return bin_size == "240"

    if waste_type in ["general", "mixed_recycling"]:
        return bin_size in ["240", "360", "660", "1100"]

    return False


def _lookup_price_item(waste_type, bin_size):
    normalised_bin_size = _normalise_bin_size_for_waste_type(waste_type, bin_size)
    today = timezone.localdate()

    return PriceBookItem.objects.filter(
        waste_type=_pricebook_waste_type_for_lookup(waste_type),
        bin_size=normalised_bin_size,
        active=True,
    ).filter(
        (Q(effective_from__isnull=True) | Q(effective_from__lte=today))
        & (Q(effective_to__isnull=True) | Q(effective_to__gte=today))
    ).first()


def _lookup_price_values(waste_type, bin_size):
    item = _lookup_price_item(waste_type, bin_size)

    if not item:
        return {
            "price_per_lift": Decimal("0.00"),
            "rental_per_day": Decimal("0.00"),
            "supplier_price_per_lift": Decimal("0.00"),
            "supplier_rental_per_day": Decimal("0.00"),
            "target_margin_percent": Decimal("0.00"),
            "found": False,
        }

    return {
        "price_per_lift": item.price_per_lift,
        "rental_per_day": item.rental_per_day,
        "supplier_price_per_lift": item.supplier_price_per_lift,
        "supplier_rental_per_day": item.supplier_rental_per_day,
        "target_margin_percent": item.target_margin_percent,
        "found": True,
    }


def _validate_lines_payload(lines_payload):
    for index, line_data in enumerate(lines_payload):
        waste_type = line_data.get("waste_type") or "general"
        requested_bin_size = str(line_data.get("bin_size") or "240")
        normalised_bin_size = _normalise_bin_size_for_waste_type(waste_type, requested_bin_size)

        if not _is_valid_bin_size_for_waste_type(waste_type, normalised_bin_size):
            return {
                "success": False,
                "message": (
                    f"Invalid bin size '{requested_bin_size}' for waste type "
                    f"'{waste_type}' on line {index + 1}."
                ),
            }

    return None


def _replace_quote_lines(quote, lines_payload):
    quote.lines.all().delete()

    for index, line_data in enumerate(lines_payload):
        waste_type = line_data.get("waste_type") or "general"
        requested_bin_size = line_data.get("bin_size") or "240"
        bin_size = _normalise_bin_size_for_waste_type(waste_type, requested_bin_size)
        price_values = _lookup_price_values(waste_type, bin_size)

        QuoteLine.objects.create(
            quote=quote,
            waste_type=waste_type,
            bin_size=bin_size,
            bin_count=max(1, _int_or_default(line_data.get("bin_count"), 1)),
            collections_per_week=max(1, _int_or_default(line_data.get("collections_per_week"), 1)),
            price_per_lift=price_values["price_per_lift"],
            rental_per_day=price_values["rental_per_day"],
            supplier_price_per_lift=price_values["supplier_price_per_lift"],
            supplier_rental_per_day=price_values["supplier_rental_per_day"],
            sort_order=_int_or_default(line_data.get("sort_order"), index),
        )

    quote.recalculate_totals()


def _create_quote_pdf_document(quote, created_by="System"):
    pdf_buffer = build_quote_pdf(quote)
    pdf_bytes = pdf_buffer.getvalue()

    latest_document = quote.documents.order_by("-version_number").first()
    next_version = (latest_document.version_number + 1) if latest_document else 1

    document = QuoteDocument(
        quote=quote,
        version_number=next_version,
        file_size_bytes=len(pdf_bytes),
    )

    filename = f"{(quote.quote_number or f'quote-{quote.id}').replace('/', '-')}-v{next_version:03d}.pdf"
    document.file.save(filename, ContentFile(pdf_bytes), save=False)
    document.save()

    if quote.customer:
        create_customer_activity(
            customer=quote.customer,
            site=quote.site,
            activity_type="pdf",
            title=f"Quote PDF generated for {quote.quote_number}",
            description=f"Saved PDF version v{next_version:03d}.",
            created_by=created_by or "System",
            related_quote_number=quote.quote_number or "",
            related_document_id=document.id,
        )

    return document


def _build_customer_name_for_quote(quote):
    if quote.customer:
        return quote.customer.business_name

    if quote.lead and quote.lead.company_name:
        return quote.lead.company_name

    if quote.title:
        return quote.title

    if quote.contact_name:
        return quote.contact_name

    return f"Customer from {quote.quote_number}"


def _get_or_create_customer_for_quote(quote):
    if quote.customer:
        return quote.customer

    lead = quote.lead

    customer = Customer.objects.create(
        business_name=_build_customer_name_for_quote(quote),
        contact_name=quote.contact_name or (lead.contact_name if lead else "") or "",
        email=quote.email or (lead.email if lead else "") or "",
        phone=(lead.phone if lead else "") or "",
        sic_code=quote.sic_code or (lead.sic_code if lead else "") or "",
        status=CUSTOMER_STATUS_ONBOARDING,
        notes=quote.notes or "",
        address_line_1=quote.address_line_1 or (lead.address_line_1 if lead else "") or "",
        address_line_2=quote.address_line_2 or (lead.address_line_2 if lead else "") or "",
        town=quote.town or (lead.town if lead else "") or "",
        county=quote.county or (lead.county if lead else "") or "",
        postcode=quote.postcode or (lead.postcode if lead else "") or "",
    )

    quote.customer = customer
    return customer


def _default_staff_mailbox_user():
    profile = (
        StaffProfile.objects.select_related("user")
        .filter(mailbox_enabled=True)
        .exclude(mailbox_password="")
        .exclude(company_email="")
        .filter(user__is_active=True, user__is_staff=True)
        .order_by("user__id")
        .first()
    )
    return profile.user if profile else None


def _public_signing_url(pack):
    base_url = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    return f"{base_url}/sign/{pack.token}"


def _create_and_send_onboarding_signing_pack(*, quote, customer, site, documents, created_by):
    company_name = get_company_name()
    existing_open_pack = (
        SigningPack.objects.filter(quote=quote)
        .exclude(status__in=["cancelled", "expired"])
        .order_by("-id")
        .first()
    )
    pack = existing_open_pack or SigningPack.objects.create(
        quote=quote,
        customer=customer,
        site=site,
        signer_name=quote.contact_name or customer.contact_name or "",
        signer_email=quote.email or customer.email or "",
        message=f"Please review and sign your {company_name} onboarding documents.",
        status="ready",
    )

    pack.customer = customer
    pack.site = site
    pack.signer_name = pack.signer_name or quote.contact_name or customer.contact_name or ""
    pack.signer_email = pack.signer_email or quote.email or customer.email or ""
    pack.message = pack.message or f"Please review and sign your {company_name} onboarding documents."
    pack.documents.set(documents)

    if not pack.signer_email:
        pack.status = "ready"
        pack.save(update_fields=["customer", "site", "signer_name", "signer_email", "message", "status", "updated_at"])
        raise ValueError("Onboarding documents were generated, but no signer email is available.")

    sender_user = _default_staff_mailbox_user()
    if not sender_user:
        pack.status = "ready"
        pack.save(update_fields=["customer", "site", "signer_name", "signer_email", "message", "status", "updated_at"])
        raise ValueError("Onboarding documents were generated, but no enabled staff mailbox is available to email them.")

    signing_url = _public_signing_url(pack)
    subject = f"Please review and sign your {company_name} documents - {quote.quote_number}"
    start_date = _date_or_none(quote.contract_start_date)
    start_date_label = start_date.strftime("%d/%m/%Y") if start_date else "To be confirmed"
    body = (
        f"Hi {pack.signer_name or 'there'},\n\n"
        f"Thank you for accepting your {company_name} quote. Please review and sign your onboarding documents here:\n"
        f"{signing_url}\n\n"
        f"Requested service start date: {start_date_label}\n\n"
        "Once the documents are signed, we can continue setting up your service.\n\n"
        f"Thanks,\n{company_name}"
    )
    html = f"""
        <p>Hi {escape(pack.signer_name or 'there')},</p>
        <p>Thank you for accepting your {escape(company_name)} quote. Please review and sign your onboarding documents using the secure link below.</p>
        <p><strong>Requested service start date:</strong> {escape(start_date_label)}</p>
        <p><a href="{escape(signing_url)}">Review and sign onboarding documents</a></p>
        <p>Once the documents are signed, we can continue setting up your service.</p>
        <p>Thanks,<br />{escape(company_name)}</p>
    """
    try:
        send_staff_mailbox_email(
            user=sender_user,
            subject=subject,
            message=body,
            html_message=html,
            to_emails=[pack.signer_email],
        )
    except Exception:
        pack.status = "ready"
        pack.save(update_fields=["customer", "site", "signer_name", "signer_email", "message", "status", "updated_at"])
        create_customer_activity(
            customer=customer,
            site=site,
            activity_type="email",
            title="Onboarding signing pack ready",
            description="Onboarding documents were prepared, but the email could not be sent right now.",
            created_by=created_by,
            related_quote_number=quote.quote_number or "",
        )
        return pack

    pack.status = "sent"
    pack.sent_at = timezone.now()
    pack.save(update_fields=["customer", "site", "signer_name", "signer_email", "message", "status", "sent_at", "updated_at"])

    for document in documents:
        document.status = "sent"
        document.save(update_fields=["status", "updated_at"])

    create_customer_activity(
        customer=customer,
        site=site,
        activity_type="email",
        title="Onboarding signing pack sent",
        description=f"Sent onboarding documents to {pack.signer_email}.",
        created_by=created_by,
        related_quote_number=quote.quote_number or "",
    )

    return pack


def _get_or_create_site_for_quote(quote, customer):
    if quote.site:
        return quote.site

    existing_sites = customer.sites.all().order_by("id")

    if existing_sites.count() == 1:
        site = existing_sites.first()
        quote.site = site
        return site

    lead = quote.lead

    site = Site.objects.create(
        customer=customer,
        site_name=customer.business_name,
        address_line_1=quote.address_line_1 or (lead.address_line_1 if lead else "") or customer.address_line_1 or "",
        address_line_2=quote.address_line_2 or (lead.address_line_2 if lead else "") or customer.address_line_2 or "",
        town=quote.town or (lead.town if lead else "") or customer.town or "",
        county=quote.county or (lead.county if lead else "") or customer.county or "",
        postcode=quote.postcode or (lead.postcode if lead else "") or customer.postcode or "",
    )

    quote.site = site
    return site


def _quote_already_has_matching_live_services(quote):
    if not quote.customer or not quote.site:
        return False

    quote_lines = list(quote.lines.all())
    if not quote_lines:
        return False

    for line in quote_lines:
        exists = Service.objects.filter(
            customer=quote.customer,
            site=quote.site,
            waste_type=line.waste_type,
            bin_size=line.bin_size,
            bin_count=line.bin_count,
            collections_per_week=line.collections_per_week,
            status__in=["active", PENDING_SCHEDULE_STATUS],
        ).exists()

        if not exists:
            return False

    return True


def _required_convert_fields_payload(quote, payload):
    missing = []

    sic_code = (payload.get("sic_code") or quote.sic_code or "").strip()
    if not sic_code:
        missing.append("sic_code")

    contact_name = (payload.get("contact_name") or quote.contact_name or "").strip()
    if not contact_name:
        missing.append("contact_name")

    email = (payload.get("email") or quote.email or "").strip()
    if not email:
        missing.append("email")

    address_line_1 = (payload.get("address_line_1") or quote.address_line_1 or getattr(quote.lead, "address_line_1", "") or "").strip()
    town = (payload.get("town") or quote.town or getattr(quote.lead, "town", "") or "").strip()
    postcode = (payload.get("postcode") or quote.postcode or getattr(quote.lead, "postcode", "") or "").strip()

    if not address_line_1:
        missing.append("address_line_1")
    if not town:
        missing.append("town")
    if not postcode:
        missing.append("postcode")

    confirmations = payload.get("service_confirmations") or []
    if not isinstance(confirmations, list) or len(confirmations) != quote.lines.count():
        missing.append("service_confirmations")
    else:
        for confirmation in confirmations:
            if not (confirmation.get("service_start_date") or "").strip():
                missing.append("service_start_date")
                break

    return missing


def _format_name(name):
    cleaned = (name or "").strip()
    if not cleaned:
        return "there"

    return " ".join(part[:1].upper() + part[1:] for part in cleaned.split(" "))


def _get_sender_display_name(request, created_by="System"):
    username = ""

    if request is not None:
        username = (
            request.headers.get("X-Staff-Username")
            or request.META.get("HTTP_X_STAFF_USERNAME")
            or ""
        ).strip()

    if username:
        user = User.objects.filter(username__iexact=username).first()
        if user:
            full_name = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
            if full_name:
                return full_name

    created_by_clean = (created_by or "").strip()
    if created_by_clean:
        return created_by_clean

    return get_company_name()


def _build_quote_accept_token(quote):
    payload = {
        "quote_id": quote.id,
        "quote_number": quote.quote_number,
        "email": quote.email or "",
    }
    return signing.dumps(payload, salt=QUOTE_ACCEPT_TOKEN_SALT)


def _verify_quote_accept_token(quote, token):
    if not token:
        raise ValueError("Missing acceptance token.")

    try:
        payload = signing.loads(
            token,
            salt=QUOTE_ACCEPT_TOKEN_SALT,
        )
    except signing.BadSignature as exc:
        raise ValueError("This acceptance link is invalid.") from exc

    if payload.get("quote_id") != quote.id:
        raise ValueError("This acceptance link does not match the quote.")

    if (payload.get("quote_number") or "") != (quote.quote_number or ""):
        raise ValueError("This acceptance link does not match the quote.")

    if (payload.get("email") or "") != (quote.email or ""):
        raise ValueError("This acceptance link does not match the quote.")

    if not quote.valid_until:
        raise ValueError("This quote no longer has a valid until date, so the acceptance link cannot be used.")

    if _quote_is_expired(quote):
        raise ValueError("This quote has expired and can no longer be accepted.")

    return payload


def _build_quote_accept_url(request, quote):
    token = _build_quote_accept_token(quote)
    path = f"/api/quotes/{quote.id}/accept/?token={token}"
    if request is not None:
        return request.build_absolute_uri(path)
    return path


def _get_default_service_start_date(quote):
    if quote.contract_start_date:
        return _date_or_none(quote.contract_start_date) or timezone.localdate()
    return timezone.localdate()


def _convert_quote_to_live_records(quote, created_by="System", payload=None, allow_missing_payload=False):
    payload = payload or {}

    if not quote.lines.exists():
        raise ValueError("Quote has no lines to convert.")

    if not allow_missing_payload:
        missing_fields = _required_convert_fields_payload(quote, payload)
        if missing_fields:
            raise ValueError("Some required conversion information is missing.")

    line_confirmations = {}
    for item in payload.get("service_confirmations") or []:
        line_id = _int_or_default(item.get("quote_line_id"), 0)
        if line_id:
            line_confirmations[line_id] = item

    with transaction.atomic():
        if payload:
            quote.contact_name = (payload.get("contact_name") or quote.contact_name or "").strip()
            quote.email = (payload.get("email") or quote.email or "").strip()
            quote.sic_code = (payload.get("sic_code") or quote.sic_code or "").strip()
            quote.address_line_1 = (payload.get("address_line_1") or quote.address_line_1 or getattr(quote.lead, "address_line_1", "") or "").strip()
            quote.address_line_2 = (payload.get("address_line_2") or quote.address_line_2 or getattr(quote.lead, "address_line_2", "") or "").strip()
            quote.town = (payload.get("town") or quote.town or getattr(quote.lead, "town", "") or "").strip()
            quote.county = (payload.get("county") or quote.county or getattr(quote.lead, "county", "") or "").strip()
            quote.postcode = (payload.get("postcode") or quote.postcode or getattr(quote.lead, "postcode", "") or "").strip()
            contract_start_date = _datetime_or_none(payload.get("contract_start_date"))
            if contract_start_date:
                quote.contract_start_date = contract_start_date
            quote.save()

        customer = _get_or_create_customer_for_quote(quote)
        site = _get_or_create_site_for_quote(quote, customer)

        created_service_ids = []
        default_start_date = _get_default_service_start_date(quote)

        for line in quote.lines.all().order_by("sort_order", "id"):
            confirmation = line_confirmations.get(line.id, {})
            schedule_start_date = _date_or_none(confirmation.get("service_start_date")) or default_start_date

            existing_service = Service.objects.filter(
                customer=customer,
                site=site,
                waste_type=line.waste_type,
                bin_size=line.bin_size,
                bin_count=line.bin_count,
                collections_per_week=line.collections_per_week,
                status__in=["active", PENDING_SCHEDULE_STATUS],
            ).first()

            if existing_service:
                created_service_ids.append(existing_service.id)
                continue

            service = Service.objects.create(
                customer=customer,
                site=site,
                waste_type=line.waste_type,
                bin_size=line.bin_size,
                bin_count=line.bin_count,
                collections_per_week=line.collections_per_week,
                status=PENDING_SCHEDULE_STATUS,
                schedule_start_date=schedule_start_date,
            )
            created_service_ids.append(service.id)

            create_customer_activity(
                customer=customer,
                site=site,
                activity_type="service",
                title=f"Service created from {quote.quote_number}",
                description=(
                    f"{line.get_waste_type_display()} • {line.get_bin_size_display()} • "
                    f"{line.bin_count} bin(s) • {line.collections_per_week} collection(s) per week • "
                    f"Start date: {schedule_start_date or 'TBC'}."
                ),
                created_by=created_by,
                related_quote_number=quote.quote_number or "",
                related_service_id=service.id,
            )

        create_generated_documents_for_quote(
            customer=customer,
            site=site,
            quote=quote,
        )

        created_documents = list(
            GeneratedDocument.objects.filter(
                customer=customer,
                site=site,
                quote=quote,
                document_type__in=[
                    "service_agreement",
                    "service_schedule",
                    "duty_of_care",
                ],
            ).order_by("-created_at")
        )

        for generated_document in created_documents:
            create_customer_activity(
                customer=customer,
                site=site,
                activity_type="pdf",
                title=f"{generated_document.title} generated",
                description=f"Generated from accepted quote {quote.quote_number}.",
                created_by=created_by,
                related_quote_number=quote.quote_number or "",
            )

        signing_pack = _create_and_send_onboarding_signing_pack(
            quote=quote,
            customer=customer,
            site=site,
            documents=created_documents,
            created_by=created_by,
        )

        quote.status = "accepted"
        quote.customer = customer
        quote.site = site
        quote.save()

        signing_description = (
            f"sent {len(created_documents)} onboarding document(s) for signing."
            if signing_pack.status == "sent"
            else f"prepared {len(created_documents)} onboarding document(s) for signing."
        )
        create_customer_activity(
            customer=customer,
            site=site,
            activity_type="quote",
            title=f"Quote accepted and converted: {quote.quote_number}",
            description=(
                f"Created {len(created_service_ids)} service(s) awaiting scheduling and "
                f"{signing_description}"
            ),
            created_by=created_by,
            related_quote_number=quote.quote_number or "",
            related_document_id=signing_pack.id,
        )

        if quote.lead:
            quote.lead.status = "won"
            quote.lead.converted_customer = customer
            if hasattr(quote.lead, "sic_code"):
                quote.lead.sic_code = quote.sic_code or quote.lead.sic_code
                quote.lead.save(update_fields=["status", "converted_customer", "sic_code"])
            else:
                quote.lead.save(update_fields=["status", "converted_customer"])

    return customer, site, created_service_ids


def _build_quote_email_message(quote, sender_display_name="", accept_url=""):
    company_name = get_company_name()
    contact_name = _format_name(quote.contact_name)
    valid_until = str(quote.valid_until) if quote.valid_until else "Please contact us if you need a refreshed version."
    start_date = _date_or_none(quote.contract_start_date)
    start_date_text = start_date.strftime("%d/%m/%Y") if start_date else "To be confirmed with you"
    acceptance_line = ""
    if accept_url:
        acceptance_line = f"To accept this quote now, open this secure link:\n{accept_url}\n\n"

    return (
        f"Hi {contact_name},\n\n"
        f"Please find attached your {company_name} quote {quote.quote_number}.\n\n"
        f"Quote title: {quote.title or 'Waste Collection Quote'}\n"
        f"Estimated monthly total: £{quote.total_per_month}\n"
        f"Requested service start date: {start_date_text}\n"
        f"Valid until: {valid_until}\n\n"
        f"{acceptance_line}"
        "If you would like to proceed, please reply to this email.\n\n"
        f"{sender_display_name or company_name}\n"
        f"{company_name}"
    )


def _build_quote_email_html(quote, sender_display_name="", accept_url=""):
    company_name = get_company_name()
    contact_name = escape(_format_name(quote.contact_name))
    quote_number = escape(quote.quote_number or "")
    title = escape(quote.title or "Waste Collection Quote")
    valid_until = escape(str(quote.valid_until) if quote.valid_until else "Please contact us if you need a refreshed version.")
    start_date = _date_or_none(quote.contract_start_date)
    start_date_text = escape(start_date.strftime("%d/%m/%Y") if start_date else "To be confirmed with you")
    total = f"£{quote.total_per_month:.2f}"
    sender_name_html = escape(sender_display_name or company_name)
    company_name_html = escape(company_name)
    logo_html = company_logo_or_name_html(width=180, light=True)
    accept_url_html = escape(accept_url or "")

    accept_button_html = ""
    if accept_url_html:
        accept_button_html = f"""
        <div style="margin-top:20px;text-align:center;">
          <a href="{accept_url_html}" style="display:inline-block;background:#5a39c7;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:700;">
            Accept Quote
          </a>
        </div>
        """

    summary_rows = "".join(
        [
            f"""
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #eee7ff;color:#2d2363;font-size:14px;">{escape(line.get_waste_type_display())}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #eee7ff;color:#2d2363;font-size:14px;">{escape(line.bin_size)}L</td>
              <td style="padding:10px 12px;border-bottom:1px solid #eee7ff;color:#2d2363;font-size:14px;">{line.bin_count}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #eee7ff;color:#2d2363;font-size:14px;">{line.collections_per_week} / week</td>
            </tr>
            """
            for line in quote.lines.all()
        ]
    )

    return f"""
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f4f1ff;font-family:Arial,sans-serif;color:#241b4b;">
        <div style="max-width:720px;margin:0 auto;padding:32px 16px;">
          <div style="background:linear-gradient(135deg,#4f35a8 0%,#6a44d4 100%);border-radius:24px 24px 0 0;padding:28px 32px;">
            {logo_html}
            <div style="margin-top:6px;font-size:14px;color:#ddd6ff;">Waste Collection Quote</div>
          </div>

          <div style="background:#ffffff;border:1px solid #e9e2ff;border-top:none;border-radius:0 0 24px 24px;overflow:hidden;">
            <div style="padding:32px;">
              <div style="display:inline-block;background:#efe9ff;color:#5a39c7;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">
                Quote {quote_number}
              </div>

              <h1 style="margin:18px 0 12px;font-size:30px;line-height:1.2;color:#241b4b;">Hi {contact_name},</h1>

              <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#4b3f84;">
                Please find attached your {company_name_html} waste collection quote. I've included a summary below, and the full PDF is attached for review.
              </p>

              <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:24px 0 28px;">
                <div style="background:#f8f5ff;border:1px solid #ebe4ff;border-radius:18px;padding:16px;">
                  <div style="font-size:12px;font-weight:700;color:#7a67c7;text-transform:uppercase;letter-spacing:.05em;">Quote title</div>
                  <div style="margin-top:8px;font-size:18px;font-weight:700;color:#241b4b;">{title}</div>
                </div>
                <div style="background:#f8f5ff;border:1px solid #ebe4ff;border-radius:18px;padding:16px;">
                  <div style="font-size:12px;font-weight:700;color:#7a67c7;text-transform:uppercase;letter-spacing:.05em;">Estimated monthly total</div>
                  <div style="margin-top:8px;font-size:22px;font-weight:800;color:#2f8f5b;">{total}</div>
                </div>
                <div style="background:#f8f5ff;border:1px solid #ebe4ff;border-radius:18px;padding:16px;">
                  <div style="font-size:12px;font-weight:700;color:#7a67c7;text-transform:uppercase;letter-spacing:.05em;">Valid until</div>
                  <div style="margin-top:8px;font-size:18px;font-weight:700;color:#241b4b;">{valid_until}</div>
                </div>
                <div style="background:#f8f5ff;border:1px solid #ebe4ff;border-radius:18px;padding:16px;">
                  <div style="font-size:12px;font-weight:700;color:#7a67c7;text-transform:uppercase;letter-spacing:.05em;">Requested start date</div>
                  <div style="margin-top:8px;font-size:18px;font-weight:700;color:#241b4b;">{start_date_text}</div>
                </div>
                <div style="background:#f8f5ff;border:1px solid #ebe4ff;border-radius:18px;padding:16px;">
                  <div style="font-size:12px;font-weight:700;color:#7a67c7;text-transform:uppercase;letter-spacing:.05em;">Next step</div>
                  <div style="margin-top:8px;font-size:18px;font-weight:700;color:#241b4b;">Reply or accept online</div>
                </div>
              </div>

              <div style="margin-top:10px;border:1px solid #ebe4ff;border-radius:20px;overflow:hidden;">
                <div style="background:#f7f3ff;padding:14px 16px;font-size:14px;font-weight:700;color:#241b4b;">
                  Service summary
                </div>
                <table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr style="background:#fcfaff;">
                      <th align="left" style="padding:12px;border-bottom:1px solid #eee7ff;color:#7a67c7;font-size:12px;text-transform:uppercase;">Waste type</th>
                      <th align="left" style="padding:12px;border-bottom:1px solid #eee7ff;color:#7a67c7;font-size:12px;text-transform:uppercase;">Bin size</th>
                      <th align="left" style="padding:12px;border-bottom:1px solid #eee7ff;color:#7a67c7;font-size:12px;text-transform:uppercase;">Bins</th>
                      <th align="left" style="padding:12px;border-bottom:1px solid #eee7ff;color:#7a67c7;font-size:12px;text-transform:uppercase;">Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary_rows}
                  </tbody>
                </table>
              </div>

              <div style="margin-top:28px;padding:18px 20px;background:#f8f5ff;border:1px solid #ebe4ff;border-radius:18px;">
                <p style="margin:0;font-size:15px;line-height:1.7;color:#4b3f84;">
                  If you would like to go ahead, you can reply to this email or use the secure button below and we’ll take care of the next steps.
                </p>
                {accept_button_html}
              </div>

              <p style="margin:28px 0 0;font-size:15px;line-height:1.8;color:#4b3f84;">
                {sender_name_html}<br>
                <strong style="color:#241b4b;">{company_name_html}</strong>
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
    """


@csrf_exempt
def quotes_list(request):
    if request.method == "GET":
        quotes = (
            Quote.objects.select_related("lead", "customer", "site")
            .prefetch_related("lines", "documents")
            .all()
            .order_by("-id")
        )
        return JsonResponse([_serialize_quote(quote) for quote in quotes], safe=False)

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        lead = None
        customer = None
        site = None

        lead_id = payload.get("lead_id")
        customer_id = payload.get("customer_id")
        site_id = payload.get("site_id")

        if lead_id:
            lead = Lead.objects.filter(pk=lead_id).first()

        if customer_id:
            customer = Customer.objects.filter(pk=customer_id).first()

        if site_id:
            site = Site.objects.filter(pk=site_id).first()

        lines_payload = payload.get("lines", []) or []
        validation_error = _validate_lines_payload(lines_payload)
        if validation_error:
            return JsonResponse(validation_error, status=400)

        try:
            _require_valid_until_value(payload.get("valid_until"))
        except ValueError as exc:
            return JsonResponse({"success": False, "message": str(exc)}, status=400)

        with transaction.atomic():
            quote = Quote.objects.create(
                title=payload.get("title", "") or "",
                lead=lead,
                customer=customer,
                site=site,
                contact_name=payload.get("contact_name", "") or "",
                email=payload.get("email", "") or "",
                sic_code=payload.get("sic_code", "") or "",
                address_line_1=payload.get("address_line_1", "") or "",
                address_line_2=payload.get("address_line_2", "") or "",
                town=payload.get("town", "") or "",
                county=payload.get("county", "") or "",
                postcode=payload.get("postcode", "") or "",
                contract_start_date=_datetime_or_none(payload.get("contract_start_date")),
                status=payload.get("status", "draft") or "draft",
                valid_until=payload.get("valid_until")
                or (timezone.localdate() + timezone.timedelta(days=int(CompanyDetails.get_solo().default_quote_validity_days or 14))),
                notes=payload.get("notes", "") or "",
                internal_notes=payload.get("internal_notes", "") or "",
            )

            _replace_quote_lines(quote, lines_payload)
            quote.refresh_from_db()

        return JsonResponse(
            {
                "success": True,
                "message": "Quote created successfully.",
                "quote": _serialize_quote(quote, include_lines=True, include_documents=True),
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def quote_detail(request, quote_id):
    quote = get_object_or_404(
        Quote.objects.select_related("lead", "customer", "site").prefetch_related("lines", "documents"),
        pk=quote_id,
    )

    if request.method == "GET":
        return JsonResponse(_serialize_quote(quote, include_lines=True, include_documents=True))

    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON payload."}, status=400)

        lead = None
        customer = None
        site = None

        lead_id = payload.get("lead_id")
        customer_id = payload.get("customer_id")
        site_id = payload.get("site_id")

        if lead_id:
            lead = Lead.objects.filter(pk=lead_id).first()

        if customer_id:
            customer = Customer.objects.filter(pk=customer_id).first()

        if site_id:
            site = Site.objects.filter(pk=site_id).first()

        lines_payload = payload.get("lines", []) or []
        validation_error = _validate_lines_payload(lines_payload)
        if validation_error:
            return JsonResponse(validation_error, status=400)

        try:
            _require_valid_until_value(payload.get("valid_until"))
        except ValueError as exc:
            return JsonResponse({"success": False, "message": str(exc)}, status=400)

        quote.title = payload.get("title", "") or ""
        quote.lead = lead
        quote.customer = customer
        quote.site = site
        quote.contact_name = payload.get("contact_name", "") or ""
        quote.email = payload.get("email", "") or ""
        quote.sic_code = payload.get("sic_code", "") or ""
        quote.address_line_1 = payload.get("address_line_1", "") or ""
        quote.address_line_2 = payload.get("address_line_2", "") or ""
        quote.town = payload.get("town", "") or ""
        quote.county = payload.get("county", "") or ""
        quote.postcode = payload.get("postcode", "") or ""
        quote.contract_start_date = _datetime_or_none(payload.get("contract_start_date"))
        quote.status = payload.get("status", "draft") or "draft"
        quote.valid_until = payload.get("valid_until") or None
        quote.notes = payload.get("notes", "") or ""
        quote.internal_notes = payload.get("internal_notes", "") or ""
        quote.save()

        _replace_quote_lines(quote, lines_payload)

        quote.refresh_from_db()

        return JsonResponse(
            {
                "success": True,
                "message": "Quote updated successfully.",
                "quote": _serialize_quote(quote, include_lines=True, include_documents=True),
            }
        )

    if request.method == "DELETE":
        quote.delete()
        return JsonResponse(
            {
                "success": True,
                "message": "Quote deleted successfully.",
            }
        )

    return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)


@csrf_exempt
def quote_send(request, quote_id):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    quote = get_object_or_404(
        Quote.objects.select_related("lead", "customer", "site").prefetch_related("lines", "documents"),
        pk=quote_id,
    )

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        payload = {}

    if not quote.email:
        return JsonResponse({"success": False, "message": "Quote does not have a customer email address."}, status=400)

    if not quote.lines.exists():
        return JsonResponse({"success": False, "message": "Quote has no lines to send."}, status=400)

    try:
        _require_quote_has_valid_until(quote)
        _require_quote_not_expired(quote)
    except ValueError as exc:
        return JsonResponse({"success": False, "message": str(exc)}, status=400)

    created_by = (payload.get("created_by") or "").strip() or "System"
    sender_user = get_request_user_from_request(request) or get_request_user_from_username(created_by)
    sender_display_name = _get_sender_display_name(request, created_by=created_by)
    accept_url = _build_quote_accept_url(request, quote)
    subject = (payload.get("subject") or "").strip() or f"Your Waste Collection Quote - {quote.quote_number}"
    message = (payload.get("message") or "").strip() or _build_quote_email_message(
        quote,
        sender_display_name=sender_display_name,
        accept_url=accept_url,
    )
    html_message = _build_quote_email_html(
        quote,
        sender_display_name=sender_display_name,
        accept_url=accept_url,
    )

    try:
        document = _create_quote_pdf_document(quote, created_by=created_by)

        with document.file.open("rb") as pdf_file:
            pdf_bytes = pdf_file.read()

        send_staff_mailbox_email(
            user=sender_user,
            subject=subject,
            message=message,
            html_message=html_message,
            to_emails=[quote.email],
            attachments=[
                (
                    document.file.name.split("/")[-1],
                    pdf_bytes,
                    "application/pdf",
                )
            ],
        )

        quote.status = "sent"
        quote.save(update_fields=["status", "updated_at"])

        if quote.customer:
            create_customer_activity(
                customer=quote.customer,
                site=quote.site,
                activity_type="email",
                title=f"Quote email sent: {quote.quote_number}",
                description=f"Sent quote email to {quote.email}.",
                created_by=created_by,
                related_quote_number=quote.quote_number or "",
                related_document_id=document.id,
            )

    except Exception as exc:
        return JsonResponse(
            {
                "success": False,
                "message": f"Could not send quote email: {str(exc)}",
            },
            status=400,
        )

    quote.refresh_from_db()

    return JsonResponse(
        {
            "success": True,
            "message": "Quote email sent successfully.",
            "quote": _serialize_quote(quote, include_lines=True, include_documents=True),
            "document": _serialize_quote_document(document),
        }
    )


def _render_accept_error_page(message, status=400):
    logo_html = company_logo_or_name_html(width=180, light=True)
    return HttpResponse(
        f"""
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Quote Acceptance Error</title>
          </head>
          <body style="margin:0;padding:0;background:#fff5f5;font-family:Arial,sans-serif;color:#3b1f1f;">
            <div style="max-width:720px;margin:0 auto;padding:32px 16px;">
              <div style="background:#b42318;border-radius:24px 24px 0 0;padding:28px 32px;">
                {logo_html}
                <div style="margin-top:6px;font-size:14px;color:#ffe0e0;">Quote Acceptance</div>
              </div>

              <div style="background:#ffffff;border:1px solid #ffd0d0;border-top:none;border-radius:0 0 24px 24px;overflow:hidden;">
                <div style="padding:32px;">
                  <h1 style="margin:0 0 12px;font-size:30px;line-height:1.2;color:#7a271a;">
                    We couldn't complete that acceptance
                  </h1>

                  <p style="margin:0;font-size:16px;line-height:1.7;color:#5c2b2b;">
                    {escape(message)}
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
        """,
        content_type="text/html",
        status=status,
    )


def _render_quote_accept_confirm_page(quote, token):
    logo_html = company_logo_or_name_html(width=180, light=True)
    quote_number = escape(quote.quote_number or "")
    company_name = escape(
        (quote.customer.business_name if quote.customer else None)
        or (quote.lead.company_name if quote.lead else None)
        or quote.title
        or "your business"
    )
    total = escape(f"{quote.total_per_month:.2f}")
    valid_until = escape(str(quote.valid_until) if quote.valid_until else "")
    start_date = _date_or_none(quote.contract_start_date)
    start_date_text = escape(start_date.strftime("%d/%m/%Y") if start_date else "To be confirmed")
    token_html = escape(token)

    return HttpResponse(
        f"""
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Confirm Quote Acceptance</title>
          </head>
          <body style="margin:0;padding:0;background:#f4f1ff;font-family:Arial,sans-serif;color:#241b4b;">
            <div style="max-width:760px;margin:0 auto;padding:32px 16px;">
              <div style="background:linear-gradient(135deg,#4f35a8 0%,#6a44d4 100%);border-radius:24px 24px 0 0;padding:28px 32px;">
                {logo_html}
                <div style="margin-top:6px;font-size:14px;color:#ddd6ff;">Quote Acceptance</div>
              </div>

              <div style="background:#ffffff;border:1px solid #e9e2ff;border-top:none;border-radius:0 0 24px 24px;overflow:hidden;">
                <div style="padding:32px;">
                  <div style="display:inline-block;background:#efe9ff;color:#5a39c7;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">
                    Quote {quote_number}
                  </div>

                  <h1 style="margin:18px 0 12px;font-size:30px;line-height:1.2;color:#241b4b;">
                    Confirm to proceed with onboarding
                  </h1>

                  <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#4b3f84;">
                    Please confirm you would like to accept this quote and start the onboarding process.
                    We will then prepare your customer account, site, services, and onboarding documents.
                  </p>

                  <div style="margin-top:24px;padding:18px 20px;background:#f8f5ff;border:1px solid #ebe4ff;border-radius:18px;">
                    <p style="margin:0;font-size:15px;line-height:1.8;color:#4b3f84;">
                      <strong style="color:#241b4b;">Business:</strong> {company_name}<br>
                      <strong style="color:#241b4b;">Quote number:</strong> {quote_number}<br>
                      <strong style="color:#241b4b;">Monthly total:</strong> &pound;{total}<br>
                      <strong style="color:#241b4b;">Requested service start date:</strong> {start_date_text}<br>
                      <strong style="color:#241b4b;">Valid until:</strong> {valid_until}<br>
                      <strong style="color:#241b4b;">Services:</strong> {quote.lines.count()}
                    </p>
                  </div>

                  <form method="post" action="?token={token_html}" style="margin-top:26px;">
                    <button type="submit" style="width:100%;border:0;background:#08a86b;color:#ffffff;padding:16px 20px;border-radius:14px;font-size:16px;font-weight:800;cursor:pointer;">
                      Confirm and proceed with onboarding
                    </button>
                  </form>

                  <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6f639f;">
                    If anything looks wrong, close this page and reply to the quote email instead.
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
        """,
        content_type="text/html",
    )


def _render_quote_accepted_page(quote, customer, created_service_ids):
    business_name = escape(get_company_name())
    logo_html = company_logo_or_name_html(width=180, light=True)
    company_name = escape(
        customer.business_name if customer else
        (quote.customer.business_name if quote.customer else
         (quote.lead.company_name if quote.lead else quote.title or "your business"))
    )
    quote_number = escape(quote.quote_number or "")

    return HttpResponse(
        f"""
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Quote Accepted</title>
          </head>
          <body style="margin:0;padding:0;background:#f4f1ff;font-family:Arial,sans-serif;color:#241b4b;">
            <div style="max-width:720px;margin:0 auto;padding:32px 16px;">
              <div style="background:linear-gradient(135deg,#4f35a8 0%,#6a44d4 100%);border-radius:24px 24px 0 0;padding:28px 32px;">
                {logo_html}
                <div style="margin-top:6px;font-size:14px;color:#ddd6ff;">Quote Acceptance</div>
              </div>

              <div style="background:#ffffff;border:1px solid #e9e2ff;border-top:none;border-radius:0 0 24px 24px;overflow:hidden;">
                <div style="padding:32px;">
                  <div style="display:inline-block;background:#efe9ff;color:#5a39c7;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">
                    Quote {quote_number}
                  </div>

                  <h1 style="margin:18px 0 12px;font-size:30px;line-height:1.2;color:#241b4b;">
                    Quote accepted
                  </h1>

                  <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#4b3f84;">
                    Thank you. We've recorded your acceptance and started the onboarding process.
                  </p>

                  <div style="margin-top:24px;padding:18px 20px;background:#f8f5ff;border:1px solid #ebe4ff;border-radius:18px;">
                    <p style="margin:0;font-size:15px;line-height:1.7;color:#4b3f84;">
                      <strong style="color:#241b4b;">Business:</strong> {company_name}<br>
                      <strong style="color:#241b4b;">Quote number:</strong> {quote_number}<br>
                      <strong style="color:#241b4b;">Services prepared:</strong> {len(created_service_ids) if created_service_ids else quote.lines.count()}
                    </p>
                  </div>

                  <p style="margin:28px 0 0;font-size:15px;line-height:1.8;color:#4b3f84;">
                    {business_name}<br>
                    <strong style="color:#241b4b;">Waste Management</strong>
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
        """,
        content_type="text/html",
    )


@csrf_exempt
def accept_quote(request, quote_id):
    if request.method not in ["GET", "POST"]:
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    quote = get_object_or_404(
        Quote.objects.select_related("lead", "customer", "site").prefetch_related("lines"),
        pk=quote_id,
    )

    token = (request.GET.get("token") or "").strip()

    try:
        _verify_quote_accept_token(quote, token)
    except ValueError as exc:
        return _render_accept_error_page(str(exc), status=400)

    already_fully_converted = _quote_already_has_matching_live_services(quote)

    if request.method == "GET" and not already_fully_converted:
        return _render_quote_accept_confirm_page(quote, token)

    try:
        customer = None
        created_service_ids = []

        if already_fully_converted:
            quote.status = "accepted"
            quote.save(update_fields=["status", "updated_at"])
            customer = quote.customer
        else:
            customer, site, created_service_ids = _convert_quote_to_live_records(
                quote,
                created_by="Customer",
                payload={},
                allow_missing_payload=True,
            )

        quote.refresh_from_db()

        return _render_quote_accepted_page(quote, customer, created_service_ids)

    except Exception as exc:
        return _render_accept_error_page(str(exc), status=400)


@csrf_exempt
def convert_quote(request, quote_id):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    quote = get_object_or_404(
        Quote.objects.select_related("lead", "customer", "site").prefetch_related("lines"),
        pk=quote_id,
    )

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        payload = {}

    created_by = (payload.get("created_by") or "").strip() or "System"

    if quote.status == "accepted" and _quote_already_has_matching_live_services(quote):
        customer = quote.customer
        site = quote.site
        service_ids = list(
            Service.objects.filter(
                customer=customer,
                site=site,
                status__in=["active", PENDING_SCHEDULE_STATUS],
            ).values_list("id", flat=True)
        ) if customer and site else []

        return JsonResponse(
            {
                "success": True,
                "message": "Quote has already been converted.",
                "customer_id": customer.id if customer else None,
                "site_id": site.id if site else None,
                "service_ids": service_ids,
                "quote": _serialize_quote(quote, include_lines=True, include_documents=True),
            }
        )

    try:
        customer, site, created_service_ids = _convert_quote_to_live_records(
            quote,
            created_by=created_by,
            payload=payload,
            allow_missing_payload=False,
        )
    except ValueError as exc:
        missing_fields = _required_convert_fields_payload(quote, payload)
        return JsonResponse(
            {
                "success": False,
                "message": str(exc),
                "missing_fields": missing_fields,
            },
            status=400,
        )
    except Exception as exc:
        return JsonResponse(
            {
                "success": False,
                "message": f"Could not convert quote: {str(exc)}",
            },
            status=400,
        )

    return JsonResponse(
        {
            "success": True,
            "message": "Quote accepted and converted successfully.",
            "customer_id": customer.id,
            "site_id": site.id,
            "service_ids": created_service_ids,
            "quote": _serialize_quote(quote, include_lines=True, include_documents=True),
        }
    )


def quote_price_lookup(request):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    waste_type = request.GET.get("waste_type", "")
    bin_size = request.GET.get("bin_size", "")

    if not waste_type or not bin_size:
        return JsonResponse(
            {
                "success": False,
                "message": "waste_type and bin_size are required.",
            },
            status=400,
        )

    normalised_bin_size = _normalise_bin_size_for_waste_type(waste_type, bin_size)

    if not _is_valid_bin_size_for_waste_type(waste_type, normalised_bin_size):
        return JsonResponse(
            {
                "success": False,
                "message": "Invalid waste type / bin size combination.",
            },
            status=400,
        )

    values = _lookup_price_values(waste_type, normalised_bin_size)

    return JsonResponse(
        {
            "success": True,
            "found": values["found"],
            "price_per_lift": float(values["price_per_lift"]),
            "rental_per_day": float(values["rental_per_day"]),
            "supplier_price_per_lift": float(values["supplier_price_per_lift"]),
            "supplier_rental_per_day": float(values["supplier_rental_per_day"]),
            "target_margin_percent": float(values["target_margin_percent"]),
            "bin_size": normalised_bin_size,
            "message": "Price found." if values["found"] else "No active pricebook item found.",
        }
    )


def quote_pdf(request, quote_id):
    quote = get_object_or_404(
        Quote.objects.select_related("lead", "customer", "site").prefetch_related("lines", "documents"),
        pk=quote_id,
    )

    created_by = (request.GET.get("created_by") or "").strip() or "System"

    try:
        _require_quote_has_valid_until(quote)
        _require_quote_not_expired(quote)
    except ValueError as exc:
        return JsonResponse({"success": False, "message": str(exc)}, status=400)

    document = _create_quote_pdf_document(quote, created_by=created_by)

    quote.refresh_from_db()

    return FileResponse(
        document.file.open("rb"),
        as_attachment=True,
        filename=document.file.name.split("/")[-1],
        content_type="application/pdf",
    )


def quote_documents_list(request, quote_id):
    quote = get_object_or_404(
        Quote.objects.select_related("customer", "site").prefetch_related("documents"),
        pk=quote_id,
    )

    documents = (
        quote.documents.select_related("quote", "quote__customer", "quote__site")
        .all()
        .order_by("-version_number", "-created_at")
    )

    return JsonResponse(
        {
            "quote_id": quote.id,
            "quote_number": quote.quote_number,
            "documents": [_serialize_quote_document(document) for document in documents],
        }
    )


def quote_documents_search(request):
    search = (request.GET.get("search") or "").strip()

    documents = QuoteDocument.objects.select_related(
        "quote",
        "quote__customer",
        "quote__site",
    ).all()

    if search:
        documents = documents.filter(
            Q(quote__quote_number__icontains=search)
            | Q(quote__title__icontains=search)
            | Q(quote__customer__business_name__icontains=search)
            | Q(quote__site__site_name__icontains=search)
            | Q(quote__contact_name__icontains=search)
            | Q(quote__email__icontains=search)
            | Q(notes__icontains=search)
        )

    documents = documents.order_by("-created_at", "-version_number")

    return JsonResponse(
        {
            "results": [_serialize_quote_document(document) for document in documents]
        }
    )


def quote_document_download(request, document_id):
    document = get_object_or_404(
        QuoteDocument.objects.select_related("quote"),
        pk=document_id,
    )

    return FileResponse(
        document.file.open("rb"),
        as_attachment=True,
        filename=document.file.name.split("/")[-1],
        content_type="application/pdf",
    )


@csrf_exempt
def quote_create_from_lead(request, lead_id):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    lead = get_object_or_404(Lead, pk=lead_id)

    quote = Quote.objects.create(
        title=f"{lead.company_name} Waste Quote",
        lead=lead,
        contact_name=lead.contact_name or lead.who_spoke_to or "",
        email=lead.email or "",
        sic_code=lead.sic_code or "",
        address_line_1=lead.address_line_1 or "",
        address_line_2=lead.address_line_2 or "",
        town=lead.town or "",
        county=lead.county or "",
        postcode=lead.postcode or "",
        status="draft",
        valid_until=timezone.localdate()
        + timezone.timedelta(days=int(CompanyDetails.get_solo().default_quote_validity_days or 14)),
        notes=lead.notes or "",
    )

    line_specs = []

    if lead.general_waste_required and lead.general_waste_bin_count and lead.general_waste_collections_per_week:
        line_specs.append({
            "waste_type": "general",
            "bin_size": lead.general_waste_bin_size or "1100",
            "bin_count": lead.general_waste_bin_count,
            "collections_per_week": lead.general_waste_collections_per_week,
        })

    if lead.recycling_required and lead.recycling_bin_count and lead.recycling_collections_per_week:
        line_specs.append({
            "waste_type": "mixed_recycling",
            "bin_size": lead.recycling_bin_size or "1100",
            "bin_count": lead.recycling_bin_count,
            "collections_per_week": lead.recycling_collections_per_week,
        })

    if lead.glass_required and lead.glass_bin_count and lead.glass_collections_per_week:
        line_specs.append({
            "waste_type": "glass",
            "bin_size": "240",
            "bin_count": lead.glass_bin_count,
            "collections_per_week": lead.glass_collections_per_week,
        })

    if lead.food_required and lead.food_bin_count and lead.food_collections_per_week:
        line_specs.append({
            "waste_type": "food",
            "bin_size": "240",
            "bin_count": lead.food_bin_count,
            "collections_per_week": lead.food_collections_per_week,
        })

    for index, spec in enumerate(line_specs):
        normalised_bin_size = _normalise_bin_size_for_waste_type(spec["waste_type"], spec["bin_size"])
        price_values = _lookup_price_values(spec["waste_type"], normalised_bin_size)

        QuoteLine.objects.create(
            quote=quote,
            waste_type=spec["waste_type"],
            bin_size=normalised_bin_size,
            bin_count=spec["bin_count"],
            collections_per_week=spec["collections_per_week"],
            price_per_lift=price_values["price_per_lift"],
            rental_per_day=price_values["rental_per_day"],
            supplier_price_per_lift=price_values["supplier_price_per_lift"],
            supplier_rental_per_day=price_values["supplier_rental_per_day"],
            sort_order=index,
        )

    quote.recalculate_totals()

    lead.status = "quoted"
    lead.save(update_fields=["status"])

    return JsonResponse(
        {
            "success": True,
            "message": "Quote created from lead successfully.",
            "quote": _serialize_quote(quote, include_lines=True, include_documents=True),
        }
    )
