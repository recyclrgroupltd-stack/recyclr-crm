import base64
import email
import imaplib
import re
from email import policy
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime

from django.conf import settings
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from accounts_api.views import get_request_user_from_username, get_staff_profile
from .models import MailFolder, MailRule
from .services import send_staff_mailbox_email


FOLDER_CANDIDATES = {
    "inbox": ["INBOX"],
    "sent": ["Sent", "Sent Messages"],
    "drafts": ["Drafts"],
    "archive": ["Archive", "All Mail"],
    "spam": ["Spam", "Junk"],
    "trash": ["Trash", "Deleted Messages"],
}

FOLDER_LABELS = {
    "inbox": "Inbox",
    "sent": "Sent",
    "drafts": "Drafts",
    "archive": "Archive",
    "spam": "Spam",
    "trash": "Trash",
}

SYSTEM_FOLDER_IDS = set(FOLDER_LABELS.keys())


def _mailbox_address(user):
    profile = get_staff_profile(user)
    if profile.company_email:
        return profile.company_email

    local_part = str(user.username or "").strip().lower().replace(" ", ".")
    local_part = "".join(char for char in local_part if char.isalnum() or char in {".", "-", "_"})
    local_part = ".".join(part for part in local_part.split(".") if part)
    return f"{local_part}@{settings.CRM_EMAIL_DOMAIN}" if local_part else ""


def _decode(value):
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return str(value)


def _strip_html(value):
    value = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", value or "")
    value = re.sub(r"(?s)<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _clean_html(value):
    return re.sub(r"(?is)<script.*?>.*?</script>", "", value or "")


def _message_body(message):
    text_fallback = ""
    html_fallback = ""

    if message.is_multipart():
        for part in message.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition") or "").lower()
            if "attachment" in disposition:
                continue

            try:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                text = payload.decode(charset, errors="replace") if payload else ""
            except Exception:
                text = ""

            if content_type == "text/html" and text.strip() and not html_fallback:
                html_fallback = text.strip()
            if content_type == "text/plain" and text.strip() and not text_fallback:
                text_fallback = text.strip()

        if html_fallback:
            return _clean_html(html_fallback), "html", text_fallback
        return text_fallback, "text", text_fallback

    try:
        payload = message.get_payload(decode=True)
        charset = message.get_content_charset() or "utf-8"
        text = payload.decode(charset, errors="replace").strip() if payload else ""
        body_type = "html" if message.get_content_type() == "text/html" else "text"
        return (_clean_html(text) if body_type == "html" else text), body_type, _strip_html(text)
    except Exception:
        return "", "text", ""


def _message_attachments(message):
    attachments = []
    for index, part in enumerate(message.walk()):
        if part.is_multipart():
            continue
        filename = _decode(part.get_filename() or "")
        disposition = str(part.get("Content-Disposition") or "").lower()
        if not filename and "attachment" not in disposition:
            continue
        payload = part.get_payload(decode=True) or b""
        attachments.append(
            {
                "id": str(index),
                "filename": filename or f"attachment-{index}",
                "content_type": part.get_content_type() or "application/octet-stream",
                "size": len(payload),
            }
        )
    return attachments


def _message_attachment(message, attachment_id):
    for index, part in enumerate(message.walk()):
        if str(index) != str(attachment_id):
            continue
        filename = _decode(part.get_filename() or f"attachment-{index}")
        payload = part.get_payload(decode=True) or b""
        return filename, part.get_content_type() or "application/octet-stream", payload
    return None


def _parse_flags(metadata):
    metadata = metadata or ""
    match = re.search(r"FLAGS \((.*?)\)", metadata, re.IGNORECASE)
    return match.group(1) if match else ""


def _normalise_uid(uid):
    if isinstance(uid, bytes):
        uid = uid.decode("ascii", errors="ignore")
    uid = str(uid or "").strip()
    if not re.fullmatch(r"\d+", uid):
        raise ValueError("Invalid message id.")
    return uid


def _fetch_message(mail, uid):
    uid = _normalise_uid(uid)
    status_code, data = mail.uid("fetch", uid, "(RFC822 FLAGS)")
    if status_code != "OK":
        raise ValueError("Could not load message.")

    metadata = ""
    raw = b""
    for item in data or []:
        if isinstance(item, tuple):
            metadata = item[0].decode(errors="ignore") if isinstance(item[0], bytes) else str(item[0])
            raw = item[1] or b""
            break
    if not raw:
        raise ValueError("Message body was empty.")

    return email.message_from_bytes(raw, policy=policy.default), metadata


def _message_summary(mail, uid):
    message, metadata = _fetch_message(mail, uid)
    flags = _parse_flags(metadata)
    received_at = ""

    try:
        parsed_date = parsedate_to_datetime(message.get("Date", ""))
        received_at = parsed_date.isoformat()
    except Exception:
        received_at = str(message.get("Date", ""))

    body, body_type, plain_fallback = _message_body(message)
    snippet_source = _strip_html(body) if body_type == "html" else body
    attachments = _message_attachments(message)

    return {
        "id": _normalise_uid(uid),
        "subject": _decode(message.get("Subject", "")) or "(No subject)",
        "from": _decode(message.get("From", "")),
        "to": _decode(message.get("To", "")),
        "cc": _decode(message.get("Cc", "")),
        "bcc": _decode(message.get("Bcc", "")),
        "date": received_at,
        "snippet": " ".join((snippet_source or plain_fallback).split())[:220],
        "body": body,
        "body_type": body_type,
        "plain_body": plain_fallback,
        "is_unread": "\\Seen" not in flags,
        "is_flagged": "\\Flagged" in flags,
        "has_attachments": bool(attachments),
        "attachments": attachments,
    }


def _get_mailbox_user(request):
    username = request.headers.get("x-staff-username") or request.headers.get("X-Staff-Username")
    user = get_request_user_from_username(username)
    if not user:
        return None, Response({"success": False, "message": "Staff user not found."}, status=status.HTTP_401_UNAUTHORIZED)

    profile = get_staff_profile(user)
    if not profile.mailbox_enabled:
        return None, Response({"success": False, "message": "Mailbox is not enabled for this staff member."}, status=400)
    if not profile.mailbox_password:
        return None, Response({"success": False, "message": "Mailbox password has not been saved for this staff member."}, status=400)

    mailbox = _mailbox_address(user)
    if not mailbox:
        return None, Response({"success": False, "message": "Mailbox email address could not be worked out."}, status=400)

    return (user, profile, mailbox), None


def _connect_imap(mailbox, password):
    mail = imaplib.IMAP4_SSL(settings.CRM_EMAIL_IMAP_HOST, settings.CRM_EMAIL_IMAP_PORT)
    mail.login(mailbox, password)
    return mail


def _open_folder(mail, folder_key, readonly=False):
    for folder in _folder_candidates_for_key(folder_key):
        status_code, _ = mail.select(f'"{folder}"', readonly=readonly)
        if status_code == "OK":
            return folder
    raise ValueError(f"Could not open {FOLDER_LABELS.get(folder_key, folder_key)} folder.")


def _folder_candidates_for_key(folder_key):
    folder_key = str(folder_key or "inbox")
    if folder_key.startswith("custom:"):
        return [folder_key.split(":", 1)[1]]
    return FOLDER_CANDIDATES.get(folder_key.lower(), ["INBOX"])


def _folder_label_for_key(user, folder_key):
    folder_key = str(folder_key or "")
    if folder_key in FOLDER_LABELS:
        return FOLDER_LABELS[folder_key]
    if folder_key.startswith("custom:"):
        folder = MailFolder.objects.filter(user=user, imap_name=folder_key.split(":", 1)[1]).first()
        return folder.name if folder else folder_key.split(":", 1)[1]
    return folder_key


def _target_folder_for_key(user, folder_key):
    folder_key = str(folder_key or "").strip()
    if folder_key.lower() in FOLDER_CANDIDATES:
        return FOLDER_CANDIDATES[folder_key.lower()][0]
    if folder_key.startswith("custom:"):
        imap_name = folder_key.split(":", 1)[1].strip()
        if MailFolder.objects.filter(user=user, imap_name=imap_name).exists():
            return imap_name
    raise ValueError("Choose a valid target folder.")


def _clean_folder_name(name):
    name = re.sub(r"[\\\\/]+", " ", str(name or "")).strip()
    name = re.sub(r"\s+", " ", name)
    if len(name) > 100:
        name = name[:100].strip()
    if not name:
        raise ValueError("Folder name is required.")
    if name.lower() in {value.lower() for value in FOLDER_LABELS.values()}:
        raise ValueError("That folder name is already used by a system folder.")
    return name


def _rule_payload(rule):
    return {
        "id": rule.id,
        "name": rule.name,
        "field": rule.field,
        "contains": rule.contains,
        "target_folder": rule.target_folder,
        "mark_read": rule.mark_read,
        "active": rule.active,
    }


def _message_rule_value(summary, field):
    if field == "subject":
        return summary.get("subject", "")
    if field == "to":
        return " ".join([summary.get("to", ""), summary.get("cc", ""), summary.get("bcc", "")])
    return summary.get("from", "")


def _apply_mail_rules(user, profile, mailbox):
    rules = list(MailRule.objects.filter(user=user, active=True).exclude(contains=""))
    if not rules:
        return 0

    moved = 0
    mail = _connect_imap(mailbox, profile.mailbox_password)
    try:
        _open_folder(mail, "inbox", readonly=False)
        _, search_data = mail.uid("search", None, "ALL")
        ids = [_normalise_uid(item) for item in search_data[0].split()] if search_data and search_data[0] else []
        for message_id in ids[-100:]:
            try:
                summary = _message_summary(mail, message_id)
            except Exception:
                continue
            for rule in rules:
                if rule.contains.lower() not in _message_rule_value(summary, rule.field).lower():
                    continue
                if rule.mark_read:
                    mail.uid("STORE", message_id, "+FLAGS", "(\\Seen)")
                _move_uid(mail, message_id, _target_folder_for_key(user, rule.target_folder))
                moved += 1
                break
    finally:
        mail.logout()
    return moved


def _folder_counts(mail, folder_key):
    try:
        folder = _open_folder(mail, folder_key, readonly=True)
        status_code, data = mail.status(f'"{folder}"', "(MESSAGES UNSEEN)")
        if status_code != "OK" or not data:
            return 0, 0
        text = data[0].decode(errors="ignore") if isinstance(data[0], bytes) else str(data[0])
        total_match = re.search(r"MESSAGES\s+(\d+)", text)
        unread_match = re.search(r"UNSEEN\s+(\d+)", text)
        return int(total_match.group(1)) if total_match else 0, int(unread_match.group(1)) if unread_match else 0
    except Exception:
        return 0, 0


def _filter_messages(messages, term):
    term = (term or "").strip().lower()
    if not term:
        return messages
    return [
        item
        for item in messages
        if term
        in " ".join(
            [
                item.get("subject", ""),
                item.get("from", ""),
                item.get("to", ""),
                item.get("cc", ""),
                item.get("snippet", ""),
                _strip_html(item.get("body", "")),
            ]
        ).lower()
    ]


def _parse_address_list(value):
    if isinstance(value, str):
        value = re.split(r"[;,]", value)
    return [str(item).strip() for item in (value or []) if str(item).strip()]


def _decode_payload_attachment(item):
    filename = str(item.get("filename") or "attachment").strip() or "attachment"
    content_type = str(item.get("content_type") or "application/octet-stream").strip()
    content_base64 = str(item.get("content_base64") or "")
    if "," in content_base64 and content_base64.lower().startswith("data:"):
        content_base64 = content_base64.split(",", 1)[1]
    return filename, base64.b64decode(content_base64), content_type


def _move_uid(mail, uid, target_folder):
    uid = _normalise_uid(uid)
    mail.uid("COPY", uid, f'"{target_folder}"')
    mail.uid("STORE", uid, "+FLAGS", "(\\Deleted)")
    mail.expunge()


@api_view(["GET", "POST"])
def mailbox_folders_view(request):
    mailbox_context, error_response = _get_mailbox_user(request)
    if error_response:
        return error_response

    user, profile, mailbox = mailbox_context
    if request.method == "POST":
        payload = request.data if isinstance(request.data, dict) else {}
        try:
            name = _clean_folder_name(payload.get("name"))
            folder, created = MailFolder.objects.get_or_create(
                user=user,
                name=name,
                defaults={"imap_name": name},
            )
            mail = _connect_imap(mailbox, profile.mailbox_password)
            try:
                mail.create(f'"{folder.imap_name}"')
            finally:
                mail.logout()
            return Response(
                {
                    "success": True,
                    "folder": {
                        "id": f"custom:{folder.imap_name}",
                        "label": folder.name,
                        "total": 0,
                        "unread": 0,
                        "custom": True,
                    },
                    "message": "Folder ready." if not created else "Folder created.",
                }
            )
        except Exception as exc:
            return Response({"success": False, "message": f"Could not create folder: {str(exc)}"}, status=400)

    try:
        mail = _connect_imap(mailbox, profile.mailbox_password)
        folders = []
        for folder_id, label in FOLDER_LABELS.items():
            total, unread = _folder_counts(mail, folder_id)
            folders.append({"id": folder_id, "label": label, "total": total, "unread": unread, "custom": False})
        for custom_folder in MailFolder.objects.filter(user=user):
            folder_id = f"custom:{custom_folder.imap_name}"
            total, unread = _folder_counts(mail, folder_id)
            folders.append(
                {
                    "id": folder_id,
                    "label": custom_folder.name,
                    "total": total,
                    "unread": unread,
                    "custom": True,
                }
            )
        mail.logout()
    except Exception:
        folders = [
            {"id": folder_id, "label": label, "total": 0, "unread": 0, "custom": False}
            for folder_id, label in FOLDER_LABELS.items()
        ]

    return Response({"success": True, "mailbox": mailbox, "folders": folders})


@api_view(["GET"])
def mailbox_messages_view(request):
    mailbox_context, error_response = _get_mailbox_user(request)
    if error_response:
        return error_response

    user, profile, mailbox = mailbox_context
    folder_key = (request.GET.get("folder") or "inbox").lower()
    limit = max(1, min(int(request.GET.get("limit") or 50), 100))
    search_term = request.GET.get("search") or ""

    try:
        if folder_key == "inbox":
            _apply_mail_rules(user, profile, mailbox)
        mail = _connect_imap(mailbox, profile.mailbox_password)
        _open_folder(mail, folder_key, readonly=False)
        _, search_data = mail.uid("search", None, "ALL")
        ids = [_normalise_uid(item) for item in search_data[0].split()] if search_data and search_data[0] else []
        selected_ids = list(reversed(ids[-limit:]))
        messages = [_message_summary(mail, message_id) for message_id in selected_ids]
        messages = _filter_messages(messages, search_term)
        mail.logout()

        return Response({"success": True, "mailbox": mailbox, "folder": folder_key, "messages": messages})
    except Exception as exc:
        return Response({"success": False, "message": f"Could not load mailbox: {str(exc)}"}, status=400)


@api_view(["POST"])
def mailbox_send_view(request):
    mailbox_context, error_response = _get_mailbox_user(request)
    if error_response:
        return error_response

    user, _, _ = mailbox_context
    payload = request.data if isinstance(request.data, dict) else {}
    to_addresses = _parse_address_list(payload.get("to") or [])
    cc_addresses = _parse_address_list(payload.get("cc") or [])
    bcc_addresses = _parse_address_list(payload.get("bcc") or [])
    subject = str(payload.get("subject") or "").strip()
    body = str(payload.get("body") or "").strip()
    attachments = []

    for item in payload.get("attachments") or []:
        try:
            attachments.append(_decode_payload_attachment(item))
        except Exception:
            return Response({"success": False, "message": "One attachment could not be read."}, status=400)

    if not to_addresses:
        return Response({"success": False, "message": "Add at least one recipient."}, status=400)
    if not subject:
        return Response({"success": False, "message": "Add an email subject."}, status=400)
    if not body:
        return Response({"success": False, "message": "Add an email message."}, status=400)

    try:
        send_staff_mailbox_email(
            user=user,
            subject=subject,
            message=body,
            to_emails=to_addresses,
            cc_emails=cc_addresses,
            bcc_emails=bcc_addresses,
            attachments=attachments,
        )
    except Exception as exc:
        return Response({"success": False, "message": f"Could not send email: {str(exc)}"}, status=400)

    return Response({"success": True, "message": "Email sent successfully."})


@api_view(["POST"])
def mailbox_read_view(request, folder, message_id):
    mailbox_context, error_response = _get_mailbox_user(request)
    if error_response:
        return error_response

    user, profile, mailbox = mailbox_context
    is_read = bool((request.data or {}).get("is_read", True))

    try:
        mail = _connect_imap(mailbox, profile.mailbox_password)
        _open_folder(mail, folder.lower(), readonly=False)
        mail.uid("STORE", _normalise_uid(message_id), "+FLAGS" if is_read else "-FLAGS", "(\\Seen)")
        mail.logout()
        return Response({"success": True})
    except Exception as exc:
        return Response({"success": False, "message": f"Could not update read state: {str(exc)}"}, status=400)


@api_view(["POST"])
def mailbox_delete_view(request, folder, message_id):
    mailbox_context, error_response = _get_mailbox_user(request)
    if error_response:
        return error_response

    _, profile, mailbox = mailbox_context
    folder_key = folder.lower()

    try:
        mail = _connect_imap(mailbox, profile.mailbox_password)
        _open_folder(mail, folder_key, readonly=False)
        if folder_key == "trash":
            mail.uid("STORE", _normalise_uid(message_id), "+FLAGS", "(\\Deleted)")
            mail.expunge()
        else:
            target_folder = FOLDER_CANDIDATES["trash"][0]
            _move_uid(mail, message_id, target_folder)
        mail.logout()
        return Response({"success": True, "message": "Message deleted."})
    except Exception as exc:
        return Response({"success": False, "message": f"Could not delete message: {str(exc)}"}, status=400)


@api_view(["POST"])
def mailbox_archive_view(request, folder, message_id):
    mailbox_context, error_response = _get_mailbox_user(request)
    if error_response:
        return error_response

    user, profile, mailbox = mailbox_context

    try:
        mail = _connect_imap(mailbox, profile.mailbox_password)
        _open_folder(mail, folder.lower(), readonly=False)
        _move_uid(mail, message_id, FOLDER_CANDIDATES["archive"][0])
        mail.logout()
        return Response({"success": True, "message": "Message archived."})
    except Exception as exc:
        return Response({"success": False, "message": f"Could not archive message: {str(exc)}"}, status=400)


@api_view(["POST"])
def mailbox_move_view(request, folder, message_id):
    mailbox_context, error_response = _get_mailbox_user(request)
    if error_response:
        return error_response

    user, profile, mailbox = mailbox_context
    raw_target_key = str((request.data or {}).get("target_folder") or "").strip()
    target_key = raw_target_key.lower() if not raw_target_key.startswith("custom:") else raw_target_key

    try:
        mail = _connect_imap(mailbox, profile.mailbox_password)
        _open_folder(mail, folder.lower(), readonly=False)
        _move_uid(mail, message_id, _target_folder_for_key(user, target_key))
        mail.logout()
        return Response({"success": True, "message": f"Message moved to {_folder_label_for_key(user, target_key)}."})
    except Exception as exc:
        return Response({"success": False, "message": f"Could not move message: {str(exc)}"}, status=400)


@api_view(["GET", "POST"])
def mailbox_rules_view(request):
    mailbox_context, error_response = _get_mailbox_user(request)
    if error_response:
        return error_response

    user, profile, mailbox = mailbox_context
    if request.method == "GET":
        return Response(
            {
                "success": True,
                "rules": [_rule_payload(rule) for rule in MailRule.objects.filter(user=user)],
            }
        )

    payload = request.data if isinstance(request.data, dict) else {}
    name = str(payload.get("name") or "").strip()
    field = str(payload.get("field") or "from").strip().lower()
    contains = str(payload.get("contains") or "").strip()
    raw_target_folder = str(payload.get("target_folder") or "").strip()
    target_folder = raw_target_folder.lower() if not raw_target_folder.startswith("custom:") else raw_target_folder
    if not name:
        return Response({"success": False, "message": "Rule name is required."}, status=400)
    if field not in {"from", "to", "subject"}:
        return Response({"success": False, "message": "Choose a valid rule field."}, status=400)
    if not contains:
        return Response({"success": False, "message": "Add text to match."}, status=400)
    try:
        _target_folder_for_key(user, target_folder)
    except Exception as exc:
        return Response({"success": False, "message": str(exc)}, status=400)

    rule = MailRule.objects.create(
        user=user,
        name=name,
        field=field,
        contains=contains,
        target_folder=target_folder,
        mark_read=bool(payload.get("mark_read", False)),
        active=bool(payload.get("active", True)),
    )
    moved = 0
    try:
        moved = _apply_mail_rules(user, profile, mailbox)
    except Exception:
        moved = 0
    return Response({"success": True, "rule": _rule_payload(rule), "message": f"Rule saved. Applied to {moved} emails."})


@api_view(["POST"])
def mailbox_rule_delete_view(request, rule_id):
    mailbox_context, error_response = _get_mailbox_user(request)
    if error_response:
        return error_response

    user, _, _ = mailbox_context
    deleted, _ = MailRule.objects.filter(user=user, id=rule_id).delete()
    if not deleted:
        return Response({"success": False, "message": "Rule not found."}, status=404)
    return Response({"success": True, "message": "Rule deleted."})


@api_view(["POST"])
def mailbox_rules_apply_view(request):
    mailbox_context, error_response = _get_mailbox_user(request)
    if error_response:
        return error_response

    user, profile, mailbox = mailbox_context
    try:
        moved = _apply_mail_rules(user, profile, mailbox)
        return Response({"success": True, "message": f"Rules applied to {moved} emails."})
    except Exception as exc:
        return Response({"success": False, "message": f"Could not apply rules: {str(exc)}"}, status=400)


@api_view(["GET"])
def mailbox_attachment_view(request, folder, message_id, attachment_id):
    mailbox_context, error_response = _get_mailbox_user(request)
    if error_response:
        return error_response

    _, profile, mailbox = mailbox_context

    try:
        mail = _connect_imap(mailbox, profile.mailbox_password)
        _open_folder(mail, folder.lower(), readonly=True)
        message, _ = _fetch_message(mail, message_id)
        attachment = _message_attachment(message, attachment_id)
        mail.logout()
        if not attachment:
            return Response({"success": False, "message": "Attachment not found."}, status=404)

        filename, content_type, payload = attachment
        response = HttpResponse(payload, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
    except Exception as exc:
        return Response({"success": False, "message": f"Could not download attachment: {str(exc)}"}, status=400)
