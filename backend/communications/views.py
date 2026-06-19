import base64

from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from accounts_api.company_branding import get_company_name
from accounts_api.views import get_request_user_from_request
from crm_email.services import send_staff_mailbox_email
from customers.models import Customer
from .models import EmailMessage

User = get_user_model()


@api_view(["POST"])
def send_email(request):
    sender = get_request_user_from_request(request)
    if not sender:
        return Response({"success": False, "message": "Please sign in again."}, status=status.HTTP_401_UNAUTHORIZED)

    customer_id = request.data.get("customer_id")
    to_email = request.data.get("to_email")
    subject = request.data.get("subject")
    body = request.data.get("body")

    if not all([customer_id, to_email, subject, body]):
        return Response({"error": "Missing fields"}, status=400)

    try:
        customer = Customer.objects.get(id=customer_id)
    except Customer.DoesNotExist:
        return Response({"error": "Customer not found"}, status=404)

    try:
        send_staff_mailbox_email(
            user=sender,
            subject=subject,
            message=body,
            to_emails=[to_email],
        )

        email = EmailMessage.objects.create(
            customer=customer,
            to_email=to_email,
            subject=subject,
            body=body,
            status="sent",
            sent_by=sender,
        )

        return Response({"success": True})

    except Exception as e:
        EmailMessage.objects.create(
            customer=customer,
            to_email=to_email,
            subject=subject,
            body=body,
            status="failed",
        )

        return Response({"error": str(e)}, status=500)


@api_view(["GET"])
def customer_emails(request, customer_id):
    emails = EmailMessage.objects.filter(customer_id=customer_id).order_by("-sent_at")

    data = [
        {
            "id": e.id,
            "to_email": e.to_email,
            "subject": e.subject,
            "body": e.body,
            "status": e.status,
            "sent_at": e.sent_at,
            "sent_by": str(e.sent_by) if e.sent_by else "System",
        }
        for e in emails
    ]

    return Response(data)


@api_view(["POST"])
def send_staff_email(request):
    sender = get_request_user_from_request(request)
    if not sender:
        return Response({"success": False, "message": "Please sign in again."}, status=status.HTTP_401_UNAUTHORIZED)

    recipient_id = request.data.get("recipient_id")
    to_email = (request.data.get("to_email") or "").strip()
    to_emails = request.data.get("to_emails") or []
    cc_emails = request.data.get("cc_emails") or []
    subject = (request.data.get("subject") or "").strip()
    body = (request.data.get("body") or "").strip()
    attachments = request.data.get("attachments") or []

    if not subject or not body:
        return Response({"success": False, "message": "Subject and message are required."}, status=status.HTTP_400_BAD_REQUEST)

    recipient = None
    if recipient_id:
        recipient = User.objects.filter(id=recipient_id, is_staff=True).first()

    if isinstance(to_emails, str):
        to_emails = [item.strip() for item in to_emails.split(",") if item.strip()]
    if not isinstance(to_emails, list):
        to_emails = []

    clean_to = [str(item).strip() for item in to_emails if str(item).strip()]

    if to_email:
        clean_to = [to_email, *clean_to]

    if not clean_to and recipient:
        profile = getattr(recipient, "staff_profile", None)
        fallback_email = getattr(profile, "company_email", "") or recipient.email
        if fallback_email:
            clean_to.append(fallback_email)

    clean_to = list(dict.fromkeys(clean_to))

    if not clean_to:
        return Response({"success": False, "message": "Add at least one recipient."}, status=status.HTTP_400_BAD_REQUEST)

    if isinstance(cc_emails, str):
        cc_emails = [item.strip() for item in cc_emails.split(",") if item.strip()]
    if not isinstance(cc_emails, list):
        cc_emails = []

    clean_cc = [str(item).strip() for item in cc_emails if str(item).strip()]

    sender_label = sender.username
    sender_profile = getattr(sender, "staff_profile", None)
    sender_email = getattr(sender_profile, "company_email", "") or sender.email or ""

    email_body = body
    company_name = get_company_name()
    if sender_email:
        email_body = f"{body}\n\nSent by {sender_label} ({sender_email}) from {company_name}."
    else:
        email_body = f"{body}\n\nSent by {sender_label} from {company_name}."

    try:
        total_attachment_bytes = 0
        prepared_attachments = []
        for attachment in attachments:
            if not isinstance(attachment, dict):
                continue

            filename = str(attachment.get("filename") or "attachment").strip() or "attachment"
            content_type = str(attachment.get("content_type") or "application/octet-stream").strip()
            data = str(attachment.get("data") or "")

            if "," in data and data.startswith("data:"):
                data = data.split(",", 1)[1]

            try:
                file_bytes = base64.b64decode(data)
            except Exception:
                return Response({"success": False, "message": f"Could not read attachment {filename}."}, status=status.HTTP_400_BAD_REQUEST)

            total_attachment_bytes += len(file_bytes)
            if total_attachment_bytes > 15 * 1024 * 1024:
                return Response({"success": False, "message": "Attachments are too large. Keep the total under 15 MB."}, status=status.HTTP_400_BAD_REQUEST)

            prepared_attachments.append((filename, file_bytes, content_type))

        send_staff_mailbox_email(
            user=sender,
            subject=subject,
            message=email_body,
            to_emails=clean_to,
            cc_emails=clean_cc,
            attachments=prepared_attachments,
        )
    except Exception as exc:
        return Response({"success": False, "message": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({"success": True, "message": "Email sent successfully."})
