from email.mime.image import MIMEImage
import os

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from .models import EmailMessage


def send_system_email(
    subject,
    message,
    to_email,
    *,
    html_message=None,
    customer=None,
    site=None,
    sent_by=None,
    attachments=None,
):
    email = EmailMultiAlternatives(
        subject=subject,
        body=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )


    if html_message:
        email.attach_alternative(html_message, "text/html")

    for attachment in attachments or []:
        if len(attachment) == 3:
            filename, content, mimetype = attachment
            email.attach(filename, content, mimetype)
        elif len(attachment) == 2:
            filename, content = attachment
            email.attach(filename, content)

    logo_path = os.path.join(settings.BASE_DIR, "static", "email", "logo.png")

    if os.path.exists(logo_path):
        with open(logo_path, "rb") as f:
            logo = MIMEImage(f.read(), _subtype="png")
            logo.add_header("Content-ID", "<logo>")
            logo.add_header("Content-Disposition", "inline", filename="logo.png")
            email.attach(logo)

    status = "sent"

    try:
        sent_count = email.send(fail_silently=False)
    except Exception:
        status = "failed"
        sent_count = 0

        if customer is not None:
            EmailMessage.objects.create(
                customer=customer,
                site=site,
                to_email=to_email,
                subject=subject,
                body=message,
                status=status,
                sent_by=sent_by,
            )
        raise

    if customer is not None:
        EmailMessage.objects.create(
            customer=customer,
            site=site,
            to_email=to_email,
            subject=subject,
            body=message,
            status=status,
            sent_by=sent_by,
        )

    return sent_count
