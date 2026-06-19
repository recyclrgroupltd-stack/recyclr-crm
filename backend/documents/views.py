import base64
import binascii
import json
from io import BytesIO

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.html import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework.decorators import api_view
from rest_framework.response import Response

from accounts_api.company_branding import get_company_details, get_company_logo_url, get_company_name
from accounts_api.views import require_permission
from accounts_api.models import StaffProfile
from crm_email.services import send_staff_mailbox_email
from customers.models import create_customer_activity
from purchase_orders.models import StaffNotification
from quotes.models import Quote

from .models import GeneratedDocument, SignedPackDocument, SigningPack
from .services import create_generated_documents_for_quote


def _absolute_backend_url(path):
    if not path:
        return ""
    if path.startswith("http"):
        return path
    return f"{settings.BACKEND_BASE_URL}{path}"


def _public_signing_url(pack):
    return f"{settings.FRONTEND_BASE_URL}/sign/{pack.token}"


def _request_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _default_mailbox_user():
    profile = (
        StaffProfile.objects.select_related("user")
        .filter(mailbox_enabled=True, user__is_active=True)
        .exclude(mailbox_password="")
        .order_by("user__id")
        .first()
    )
    return profile.user if profile else None


def _assign_account_manager(customer):
    if customer.account_manager_id:
        return customer.account_manager

    manager = (
        User.objects.filter(
            is_active=True,
            staff_profile__isnull=False,
            staff_profile__auto_assign_customers=True,
        )
        .order_by("?")
        .first()
    )
    if not manager:
        manager = User.objects.filter(is_active=True).order_by("?").first()

    if manager:
        customer.account_manager = manager
        customer.save(update_fields=["account_manager", "updated_at"])
    return manager


def _staff_display_name(user):
    if not user:
        return "your account manager"
    return user.get_full_name() or user.username


def _staff_email(user):
    profile = getattr(user, "staff_profile", None)
    return getattr(profile, "company_email", "") or getattr(user, "email", "") or ""


def _staff_phone(user):
    profile = getattr(user, "staff_profile", None)
    return getattr(profile, "company_phone", "") or ""


def _quote_service_summary(quote):
    rows = []
    for line in quote.lines.all().order_by("sort_order", "id"):
        rows.append(
            {
                "waste_type": line.get_waste_type_display(),
                "bin_size": line.get_bin_size_display(),
                "bin_count": line.bin_count,
                "frequency": f"{line.collections_per_week} / week",
            }
        )
    return rows


def _send_customer_signed_next_steps_email(pack, account_manager):
    if not pack.signer_email:
        return "no signer email"

    sender = account_manager
    try:
        profile = sender.staff_profile if sender else None
        if not (profile and profile.mailbox_enabled and profile.mailbox_password):
            sender = _default_mailbox_user()
    except StaffProfile.DoesNotExist:
        sender = _default_mailbox_user()

    if not sender:
        return "no enabled staff mailbox"

    manager_name = _staff_display_name(account_manager)
    manager_email = _staff_email(account_manager)
    manager_phone = _staff_phone(account_manager)
    site_address = ", ".join(
        part
        for part in [
            pack.site.address_line_1 if pack.site else "",
            pack.site.address_line_2 if pack.site else "",
            pack.site.town if pack.site else "",
            pack.site.county if pack.site else "",
            pack.site.postcode if pack.site else "",
        ]
        if part
    )
    service_rows = _quote_service_summary(pack.quote)
    service_text = "\n".join(
        f"- {row['waste_type']}: {row['bin_count']} x {row['bin_size']}, {row['frequency']}"
        for row in service_rows
    ) or "- Services are being reviewed by operations."
    service_html = "".join(
        "<li>"
        f"{escape(row['waste_type'])}: {row['bin_count']} x {escape(row['bin_size'])}, {escape(row['frequency'])}"
        "</li>"
        for row in service_rows
    ) or "<li>Services are being reviewed by operations.</li>"

    attachments = []
    for signed_document in pack.signed_documents.all():
        if signed_document.file:
            try:
                with signed_document.file.open("rb") as file_handle:
                    attachments.append((signed_document.filename(), file_handle.read(), "application/pdf"))
            except Exception:
                pass

    company = get_company_details()
    company_name = get_company_name(company)
    subject = f"Welcome to {company_name} - your account is being set up"
    body = (
        f"Hi {pack.signed_name or pack.signer_name or 'there'},\n\n"
        "Thank you. Your onboarding documents have been signed successfully.\n\n"
        "What happens next:\n"
        "- Your account is now with our operations team for service setup.\n"
        "- We will review the signed documents and confirm the agreed service details.\n"
        "- Containers and collections will be scheduled.\n"
        "- We will contact you with delivery and collection start details before the service goes live.\n"
        "- If anything is missing, your account manager will contact you.\n\n"
        f"Your account manager is {manager_name}.\n"
        f"{'Email: ' + manager_email if manager_email else ''}\n"
        f"{'Phone: ' + manager_phone if manager_phone else ''}\n\n"
        f"Customer: {pack.customer.business_name}\n"
        f"Site: {pack.site.site_name if pack.site else pack.customer.business_name}\n"
        f"{'Address: ' + site_address if site_address else ''}\n"
        f"Quote: {pack.quote.quote_number}\n\n"
        "Agreed services:\n"
        f"{service_text}\n\n"
        "Your signed documents are attached for your records.\n\n"
        f"Thanks,\n{company_name}"
    )
    html = f"""
        <p>Hi {escape(pack.signed_name or pack.signer_name or 'there')},</p>
        <p>Thank you. Your onboarding documents have been signed successfully.</p>
        <p><strong>What happens next:</strong></p>
        <ul>
          <li>Your account is now with our operations team for service setup.</li>
          <li>We will review the signed documents and confirm the agreed service details.</li>
          <li>Containers and collections will be scheduled.</li>
          <li>We will contact you with delivery and collection start details before the service goes live.</li>
          <li>If anything is missing, your account manager will contact you.</li>
        </ul>
        <p><strong>Your account manager:</strong> {escape(manager_name)}</p>
        {f"<p>Email: {escape(manager_email)}</p>" if manager_email else ""}
        {f"<p>Phone: {escape(manager_phone)}</p>" if manager_phone else ""}
        <p><strong>Customer:</strong> {escape(pack.customer.business_name)}<br />
        <strong>Site:</strong> {escape(pack.site.site_name if pack.site else pack.customer.business_name)}<br />
        {f"<strong>Address:</strong> {escape(site_address)}<br />" if site_address else ""}
        <strong>Quote:</strong> {escape(pack.quote.quote_number)}</p>
        <p><strong>Agreed services:</strong></p>
        <ul>{service_html}</ul>
        <p>Your signed documents are attached for your records.</p>
        <p>Thanks,<br />{escape(company_name)}</p>
    """

    send_staff_mailbox_email(
        user=sender,
        subject=subject,
        message=body,
        html_message=html,
        to_emails=[pack.signer_email],
        attachments=attachments,
    )
    return "sent"


def _notify_account_manager(pack, account_manager):
    if not account_manager:
        return

    StaffNotification.objects.create(
        recipient=account_manager,
        notification_type=StaffNotification.TYPE_GENERAL,
        title=f"New customer ready for setup: {pack.customer.business_name}",
        message=(
            f"{pack.customer.business_name} has signed onboarding documents. "
            "Please review the customer account, assign containers, and create the required job/service setup."
        ),
        target_url=f"/customers/{pack.customer.id}",
        source_type="customer_onboarding",
        source_id=pack.customer.id,
    )


def _serialize_document(document):
    return {
        "id": document.id,
        "document_type": document.document_type,
        "document_type_label": document.get_document_type_display(),
        "title": document.title,
        "status": document.status,
        "file": document.file.url if document.file else "",
        "download_url": _absolute_backend_url(document.file.url if document.file else ""),
        "filename": document.filename(),
        "created_at": document.created_at.isoformat() if document.created_at else "",
        "updated_at": document.updated_at.isoformat() if document.updated_at else "",
    }


def _serialize_signed_document(document):
    return {
        "id": document.id,
        "title": document.title,
        "filename": document.filename(),
        "created_at": document.created_at.isoformat() if document.created_at else "",
        "download_url": f"/api/documents/signing-packs/signed-documents/{document.id}/download/",
        "absolute_download_url": _absolute_backend_url(
            f"/api/documents/signing-packs/signed-documents/{document.id}/download/"
        ),
    }


def _serialize_pack(pack, public=False):
    quote = pack.quote
    company = get_company_details()
    data = {
        "id": pack.id,
        "token": pack.token if not public else "",
        "quote_id": quote.id,
        "quote_number": quote.quote_number,
        "quote_title": quote.title,
        "customer_id": pack.customer_id,
        "customer_name": pack.customer.business_name,
        "site_id": pack.site_id,
        "site_name": pack.site.site_name if pack.site else "",
        "status": "expired" if pack.is_expired() and pack.status not in ["signed", "cancelled"] else pack.status,
        "signer_name": pack.signer_name,
        "signer_email": pack.signer_email,
        "signed_name": pack.signed_name,
        "signed_email": pack.signed_email,
        "message": pack.message,
        "public_url": _public_signing_url(pack),
        "sent_at": pack.sent_at.isoformat() if pack.sent_at else "",
        "viewed_at": pack.viewed_at.isoformat() if pack.viewed_at else "",
        "signed_at": pack.signed_at.isoformat() if pack.signed_at else "",
        "expires_at": pack.expires_at.isoformat() if pack.expires_at else "",
        "created_at": pack.created_at.isoformat() if pack.created_at else "",
        "updated_at": pack.updated_at.isoformat() if pack.updated_at else "",
        "document_count": pack.documents.count(),
        "signed_document_count": pack.signed_documents.count(),
        "documents": [_serialize_document(document) for document in pack.documents.all()],
        "signed_documents": [_serialize_signed_document(document) for document in pack.signed_documents.all()],
        "audit_summary": pack.audit_summary or {},
        "company": {
            "name": get_company_name(company),
            "logo_data": "",
            "logo_url": get_company_logo_url(company),
            "email": getattr(company, "main_email", "") or "",
            "phone": getattr(company, "phone_number", "") or "",
            "website": getattr(company, "website", "") or "",
        },
    }
    return data


def _ensure_pack_documents(pack):
    existing = list(pack.documents.all())
    if existing:
        return existing

    generated = list(GeneratedDocument.objects.filter(quote=pack.quote).order_by("document_type", "-created_at"))
    if not generated:
        generated = create_generated_documents_for_quote(
            customer=pack.customer,
            site=pack.site,
            quote=pack.quote,
        )

    # Keep only the newest document for each type.
    selected = {}
    for document in generated:
        selected.setdefault(document.document_type, document)

    documents = list(selected.values())
    pack.documents.set(documents)
    if pack.status == "draft":
        pack.status = "ready"
        pack.save(update_fields=["status", "updated_at"])
    return documents


def _save_signature_image(pack, data_url):
    if not data_url or "," not in data_url:
        raise ValueError("Signature image is missing.")
    header, encoded = data_url.split(",", 1)
    extension = "png" if "png" in header else "jpg"
    try:
        image_bytes = base64.b64decode(encoded)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Signature image could not be read.") from exc
    pack.signature_image.save(
        f"signature-{pack.id}.{extension}",
        ContentFile(image_bytes),
        save=False,
    )


def _build_signed_certificate(pack, source_document):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=42, bottomMargin=40)
    styles = getSampleStyleSheet()
    story = [
        Paragraph(f"{get_company_name()} Contract Signing Certificate", styles["Title"]),
        Spacer(1, 16),
        Paragraph(
            "This certificate records the digital signing event for the document named below.",
            styles["BodyText"],
        ),
        Spacer(1, 14),
    ]

    rows = [
        ["Document", source_document.title],
        ["Document Type", source_document.get_document_type_display()],
        ["Quote", pack.quote.quote_number],
        ["Customer", pack.customer.business_name],
        ["Site", pack.site.site_name if pack.site else "-"],
        ["Signed Name", pack.signed_name],
        ["Signed Email", pack.signed_email],
        ["Signed At", pack.signed_at.strftime("%d/%m/%Y, %H:%M:%S") if pack.signed_at else "-"],
        ["IP Address", pack.signed_ip_address or "-"],
        ["User Agent", (pack.signed_user_agent or "-")[:120]],
    ]
    table = Table(rows, colWidths=[130, 350])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f3f0ff")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#111827")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d8d2f0")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend([table, Spacer(1, 18), Paragraph("Customer Signature", styles["Heading2"])])

    if pack.signature_image:
        try:
            signature = Image(pack.signature_image.path, width=220, height=80)
            signature.hAlign = "LEFT"
            story.append(signature)
        except Exception:
            story.append(Paragraph("Signature image could not be rendered in this certificate.", styles["BodyText"]))

    story.append(Spacer(1, 14))
    story.append(
        Paragraph(
            "Acceptance confirmed: documents reviewed, terms accepted, and authority to sign confirmed.",
            styles["BodyText"],
        )
    )
    doc.build(story)
    buffer.seek(0)
    return buffer


def _create_signed_documents(pack):
    pack.signed_documents.all().delete()
    for document in pack.documents.all():
        certificate = _build_signed_certificate(pack, document)
        signed = SignedPackDocument.objects.create(
            pack=pack,
            source_document=document,
            title=f"Signed {document.title}",
        )
        safe_title = document.document_type.replace("_", "-")
        signed.file.save(f"{safe_title}-{pack.quote.quote_number}-signed.pdf", ContentFile(certificate.getvalue()), save=True)
        document.status = "signed"
        document.save(update_fields=["status", "updated_at"])


@api_view(["GET"])
def get_customer_documents(request, customer_id):
    documents = (
        GeneratedDocument.objects.filter(customer_id=customer_id)
        .order_by("-created_at")
    )

    return Response(
        [
            {
                "id": document.id,
                "document_type": document.document_type,
                "document_type_label": document.get_document_type_display(),
                "title": document.title,
                "status": document.status,
                "file": document.file.url if document.file else "",
                "filename": document.filename(),
                "created_at": document.created_at,
                "updated_at": document.updated_at,
            }
            for document in documents
        ]
    )


@api_view(["GET"])
def signing_pack_list(request):
    _, error_response = require_permission(request, "quotes.view", "You do not have permission to view signing packs.")
    if error_response:
        return error_response

    packs = SigningPack.objects.select_related("quote", "customer", "site").prefetch_related("documents", "signed_documents")
    search = request.GET.get("search", "").strip()
    if search:
        packs = packs.filter(
            quote__quote_number__icontains=search
        ) | packs.filter(customer__business_name__icontains=search) | packs.filter(signer_email__icontains=search)

    return Response({"success": True, "results": [_serialize_pack(pack) for pack in packs.distinct()[:100]]})


@api_view(["POST"])
def signing_pack_create(request):
    user, error_response = require_permission(request, "quotes.edit", "You do not have permission to create signing packs.")
    if error_response:
        return error_response

    quote_id = request.data.get("quote_id")
    quote = get_object_or_404(Quote.objects.select_related("customer", "site"), id=quote_id)
    if not quote.customer:
        return Response({"success": False, "message": "This quote needs a linked customer before a signing pack can be created."}, status=400)

    pack = SigningPack.objects.create(
        quote=quote,
        customer=quote.customer,
        site=quote.site,
        signer_name=request.data.get("signer_name", "") or quote.contact_name or getattr(quote.customer, "primary_contact_name", ""),
        signer_email=request.data.get("signer_email", "") or quote.email or getattr(quote.customer, "email", ""),
        message=request.data.get("message", ""),
        created_by=user,
        status="ready",
    )
    _ensure_pack_documents(pack)
    return Response({"success": True, "message": "Signing pack created.", "pack": _serialize_pack(pack)})


@api_view(["POST"])
def signing_pack_send(request, pack_id):
    user, error_response = require_permission(request, "quotes.edit", "You do not have permission to send signing packs.")
    if error_response:
        return error_response

    pack = get_object_or_404(SigningPack.objects.select_related("quote", "customer", "site"), id=pack_id)
    _ensure_pack_documents(pack)

    signer_email = request.data.get("signer_email", "").strip() or pack.signer_email
    signer_name = request.data.get("signer_name", "").strip() or pack.signer_name
    message = request.data.get("message", "").strip() or pack.message
    if not signer_email:
        return Response({"success": False, "message": "Please add a signer email before sending."}, status=400)

    pack.signer_email = signer_email
    pack.signer_name = signer_name
    pack.message = message
    pack.status = "sent"
    pack.sent_at = timezone.now()
    pack.save(update_fields=["signer_email", "signer_name", "message", "status", "sent_at", "updated_at"])

    signing_url = _public_signing_url(pack)
    company_name = get_company_name()
    subject = f"Please review and sign your {company_name} documents - {pack.quote.quote_number}"
    body = (
        f"Hi {signer_name or 'there'},\n\n"
        f"Please review and sign your {company_name} service documents using this secure link:\n"
        f"{signing_url}\n\n"
        f"Thanks,\n{company_name}"
    )
    html = f"""
        <p>Hi {signer_name or 'there'},</p>
        <p>Please review and sign your {escape(company_name)} service documents using the secure link below.</p>
        <p><a href="{signing_url}">Review and sign documents</a></p>
        <p>{message}</p>
        <p>Thanks,<br />{escape(company_name)}</p>
    """
    email_status = "sent"
    try:
        send_staff_mailbox_email(
            user=user,
            subject=subject,
            message=body,
            html_message=html,
            to_emails=[signer_email],
        )
    except Exception as exc:
        email_status = f"failed: {exc}"

    return Response({
        "success": True,
        "message": "Signing pack marked as sent." if email_status == "sent" else "Signing pack created, but email sending failed. Copy the link manually.",
        "email_status": email_status,
        "pack": _serialize_pack(pack),
    })


@api_view(["POST"])
def signing_pack_cancel(request, pack_id):
    _, error_response = require_permission(request, "quotes.edit", "You do not have permission to cancel signing packs.")
    if error_response:
        return error_response
    pack = get_object_or_404(SigningPack, id=pack_id)
    pack.status = "cancelled"
    pack.cancelled_at = timezone.now()
    pack.save(update_fields=["status", "cancelled_at", "updated_at"])
    return Response({"success": True, "message": "Signing pack cancelled.", "pack": _serialize_pack(pack)})


@api_view(["GET"])
def public_signing_pack(request, token):
    pack = get_object_or_404(
        SigningPack.objects.select_related("quote", "customer", "site").prefetch_related("documents", "signed_documents"),
        token=token,
    )
    if pack.status == "cancelled":
        return Response({"success": False, "message": "This signing link has been cancelled."}, status=410)
    if pack.is_expired() and pack.status != "signed":
        pack.status = "expired"
        pack.save(update_fields=["status", "updated_at"])
        return Response({"success": False, "message": "This signing link has expired."}, status=410)
    if not pack.viewed_at:
        pack.viewed_at = timezone.now()
        pack.viewed_ip_address = _request_ip(request)
        pack.viewed_user_agent = request.META.get("HTTP_USER_AGENT", "")
        if pack.status == "sent":
            pack.status = "viewed"
        pack.save(update_fields=["viewed_at", "viewed_ip_address", "viewed_user_agent", "status", "updated_at"])
    _ensure_pack_documents(pack)
    return Response({"success": True, "pack": _serialize_pack(pack, public=True)})


@api_view(["POST"])
def public_signing_pack_submit(request, token):
    pack = get_object_or_404(
        SigningPack.objects.select_related("quote", "customer", "site").prefetch_related("documents"),
        token=token,
    )
    if pack.status in ["cancelled", "signed"]:
        return Response({"success": False, "message": "This signing link is no longer open for signing."}, status=400)
    if pack.is_expired():
        pack.status = "expired"
        pack.save(update_fields=["status", "updated_at"])
        return Response({"success": False, "message": "This signing link has expired."}, status=410)

    signed_name = request.data.get("signed_name", "").strip()
    signed_email = request.data.get("signed_email", "").strip()
    signature_data = request.data.get("signature_data", "")
    acceptance_terms = bool(request.data.get("acceptance_terms"))
    acceptance_authority = bool(request.data.get("acceptance_authority"))
    acceptance_documents = bool(request.data.get("acceptance_documents"))

    if not signed_name or not signed_email or not signature_data:
        return Response({"success": False, "message": "Please enter your name, email, and signature."}, status=400)
    if not (acceptance_terms and acceptance_authority and acceptance_documents):
        return Response({"success": False, "message": "Please confirm all signing declarations before submitting."}, status=400)

    _ensure_pack_documents(pack)
    pack.signed_name = signed_name
    pack.signed_email = signed_email
    pack.acceptance_terms = acceptance_terms
    pack.acceptance_authority = acceptance_authority
    pack.acceptance_documents = acceptance_documents
    pack.signed_at = timezone.now()
    pack.signed_ip_address = _request_ip(request)
    pack.signed_user_agent = request.META.get("HTTP_USER_AGENT", "")
    pack.status = "signed"
    pack.audit_summary = {
        "signed_name": signed_name,
        "signed_email": signed_email,
        "signed_at": pack.signed_at.isoformat(),
        "ip_address": pack.signed_ip_address,
        "user_agent": pack.signed_user_agent,
        "document_ids": list(pack.documents.values_list("id", flat=True)),
        "acceptance_terms": acceptance_terms,
        "acceptance_authority": acceptance_authority,
        "acceptance_documents": acceptance_documents,
    }
    try:
        _save_signature_image(pack, signature_data)
    except ValueError as exc:
        return Response({"success": False, "message": str(exc)}, status=400)
    pack.save()
    _create_signed_documents(pack)
    account_manager = _assign_account_manager(pack.customer)
    if pack.customer.status != "ready_for_setup":
        pack.customer.status = "ready_for_setup"
        pack.customer.save(update_fields=["status", "updated_at"])

    email_status = "not sent"
    try:
        email_status = _send_customer_signed_next_steps_email(pack, account_manager)
    except Exception as exc:
        email_status = f"failed: {exc}"

    _notify_account_manager(pack, account_manager)

    create_customer_activity(
        customer=pack.customer,
        site=pack.site,
        activity_type="system",
        title="Onboarding documents signed",
        description=(
            f"{signed_name} signed the onboarding documents. "
            "Customer account is ready for setup; services remain pending schedule until operations set collection days. "
            f"Account manager: {_staff_display_name(account_manager)}. "
            f"Customer next-steps email status: {email_status}."
        ),
        created_by="Customer",
        related_quote_number=pack.quote.quote_number or "",
    )

    return Response({"success": True, "message": "Documents signed successfully.", "pack": _serialize_pack(pack, public=True)})


@api_view(["GET"])
def signed_document_download(request, document_id):
    document = get_object_or_404(SignedPackDocument, id=document_id)
    return FileResponse(document.file.open("rb"), as_attachment=True, filename=document.filename())
