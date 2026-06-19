import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from django.conf import settings

from accounts_api.models import CompanyDetails
from accounts_api.views import get_staff_profile


def company_email_domain():
    try:
        domain = (CompanyDetails.get_solo().company_email_domain or "").strip().lower().replace("@", "")
        if domain:
            return domain
    except Exception:
        pass
    return getattr(settings, "CRM_EMAIL_DOMAIN", "recyclrgroup.co.uk")


def mailbox_address_for_user(user):
    profile = get_staff_profile(user)
    if profile.company_email:
        return profile.company_email

    local_part = str(user.username or "").strip().lower().replace(" ", ".")
    local_part = "".join(char for char in local_part if char.isalnum() or char in {".", "-", "_"})
    local_part = ".".join(part for part in local_part.split(".") if part)
    return f"{local_part}@{company_email_domain()}" if local_part else ""


def require_staff_mailbox(user):
    if not user:
        raise ValueError("Please sign in again before sending email.")

    profile = get_staff_profile(user)
    mailbox = mailbox_address_for_user(user)

    if not mailbox:
        raise ValueError("No company email address is set for your staff profile.")
    if not profile.mailbox_enabled:
        raise ValueError("Your CRM mailbox is not enabled in Staff settings.")
    if not profile.mailbox_password:
        raise ValueError("Your Zoho app password has not been saved in Staff settings.")

    return profile, mailbox


def send_staff_mailbox_email(
    *,
    user,
    subject,
    message,
    to_emails,
    cc_emails=None,
    bcc_emails=None,
    html_message=None,
    attachments=None,
):
    profile, mailbox = require_staff_mailbox(user)
    clean_to = [str(item).strip() for item in (to_emails or []) if str(item).strip()]
    clean_cc = [str(item).strip() for item in (cc_emails or []) if str(item).strip()]
    clean_bcc = [str(item).strip() for item in (bcc_emails or []) if str(item).strip()]

    if not clean_to:
        raise ValueError("Add at least one recipient.")

    email = EmailMessage()
    email["From"] = formataddr(("", mailbox))
    email["To"] = ", ".join(clean_to)
    if clean_cc:
        email["Cc"] = ", ".join(clean_cc)
    if clean_bcc:
        email["Bcc"] = ", ".join(clean_bcc)
    email["Subject"] = subject
    email.set_content(message or "")

    if html_message:
        email.add_alternative(html_message, subtype="html")

    for attachment in attachments or []:
        if len(attachment) == 3:
            filename, content, mimetype = attachment
            maintype, _, subtype = (mimetype or "application/octet-stream").partition("/")
            email.add_attachment(
                content,
                maintype=maintype or "application",
                subtype=subtype or "octet-stream",
                filename=filename,
            )
        elif len(attachment) == 2:
            filename, content = attachment
            email.add_attachment(
                content,
                maintype="application",
                subtype="octet-stream",
                filename=filename,
            )

    with smtplib.SMTP(settings.CRM_EMAIL_SMTP_HOST, settings.CRM_EMAIL_SMTP_PORT, timeout=30) as smtp:
        smtp.starttls()
        smtp.login(mailbox, profile.mailbox_password)
        smtp.send_message(email)

    return {"from_email": mailbox, "to_emails": clean_to, "cc_emails": clean_cc, "bcc_emails": clean_bcc}
