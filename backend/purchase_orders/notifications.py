import re

from django.contrib.auth import get_user_model

from .models import StaffNotification

MENTION_RE = re.compile(r"@([A-Za-z0-9_.-]+)")

User = get_user_model()


def mentioned_users_from_text(text):
    mentioned_names = {item.lower() for item in MENTION_RE.findall(text or "")}
    if not mentioned_names:
        return []

    users = User.objects.filter(is_staff=True, is_active=True)
    return [user for user in users if user.username.lower() in mentioned_names]


def create_mention_notifications(*, actor, text, title, message, target_url, source_type, source_id, allowed_users=None):
    users = mentioned_users_from_text(text)
    if allowed_users is not None:
        allowed_ids = {user.id for user in allowed_users}
        users = [user for user in users if user.id in allowed_ids]

    created = []
    for user in users:
        if actor and user.id == actor.id:
            continue
        notification = StaffNotification.objects.create(
            recipient=user,
            notification_type=StaffNotification.TYPE_MENTION,
            title=title,
            message=message,
            target_url=target_url,
            source_type=source_type,
            source_id=source_id,
        )
        created.append(notification)
    return created
