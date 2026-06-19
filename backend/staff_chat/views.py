import re
from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Count, Max, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from accounts_api.views import require_authenticated_staff_user
from purchase_orders.notifications import create_mention_notifications

from .models import StaffConversation, StaffConversationParticipant, StaffMessage


MENTION_RE = re.compile(r"@([A-Za-z0-9_.-]+)")


def _user_data(user):
    return {
        "id": user.id,
        "username": user.username,
        "name": user.get_full_name() or user.username,
        "email": user.email,
        "initials": "".join(part[:1].upper() for part in (user.get_full_name() or user.username).replace(".", " ").replace("_", " ").split()[:2]) or user.username[:1].upper(),
    }


def _conversation_title(conversation, viewer):
    if conversation.title:
        return conversation.title
    others = [p.user for p in conversation.conversation_participants.all() if p.user_id != viewer.id]
    if not others:
        return "Saved notes"
    return ", ".join((user.get_full_name() or user.username) for user in others)


def _unread_count(conversation, viewer):
    participant = next((p for p in conversation.conversation_participants.all() if p.user_id == viewer.id), None)
    if not participant:
        return 0
    queryset = conversation.messages.exclude(sender_id=viewer.id)
    if participant.last_read_at:
        queryset = queryset.filter(created_at__gt=participant.last_read_at)
    unread_messages = queryset.count()
    if unread_messages:
        return unread_messages
    return 1 if participant.manually_marked_unread else 0


def _viewer_participant(conversation, viewer):
    return next((p for p in conversation.conversation_participants.all() if p.user_id == viewer.id), None)


def _is_muted(conversation, viewer):
    participant = _viewer_participant(conversation, viewer)
    return bool(participant and participant.muted_until and participant.muted_until > timezone.now())


def _serialize_message(message):
    return {
        "id": message.id,
        "body": message.body,
        "sender": _user_data(message.sender) if message.sender else None,
        "sender_id": message.sender_id,
        "mention_ids": list(message.mentions.values_list("id", flat=True)),
        "created_at": message.created_at.isoformat() if message.created_at else "",
    }


def _serialize_conversation(conversation, viewer, include_messages=False):
    latest = conversation.messages.order_by("-created_at").first()
    participant = _viewer_participant(conversation, viewer)
    data = {
        "id": conversation.id,
        "title": _conversation_title(conversation, viewer),
        "custom_title": conversation.title,
        "is_group": conversation.is_group,
        "is_everyone": conversation.is_everyone,
        "is_pinned": conversation.is_pinned,
        "participants": [_user_data(item.user) for item in conversation.conversation_participants.all()],
        "last_message": _serialize_message(latest) if latest else None,
        "unread_count": _unread_count(conversation, viewer),
        "is_muted": _is_muted(conversation, viewer),
        "muted_until": participant.muted_until.isoformat() if participant and participant.muted_until else "",
        "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else "",
        "created_at": conversation.created_at.isoformat() if conversation.created_at else "",
    }
    if include_messages:
        data["messages"] = [_serialize_message(message) for message in conversation.messages.select_related("sender").prefetch_related("mentions")]
    return data


def _viewer_conversations(user):
    return (
        StaffConversation.objects.filter(conversation_participants__user=user, conversation_participants__hidden_at__isnull=True)
        .select_related("created_by")
        .prefetch_related("conversation_participants__user", "messages__sender", "messages__mentions")
        .annotate(last_message_at=Max("messages__created_at"))
        .order_by("-is_pinned", "-last_message_at", "-updated_at")
        .distinct()
    )


def _ensure_everyone_conversation():
    conversation, _ = StaffConversation.objects.get_or_create(
        is_everyone=True,
        defaults={
            "title": "Everyone",
            "is_group": True,
            "is_pinned": True,
        },
    )
    changed = False
    if conversation.title != "Everyone":
        conversation.title = "Everyone"
        changed = True
    if not conversation.is_group:
        conversation.is_group = True
        changed = True
    if not conversation.is_pinned:
        conversation.is_pinned = True
        changed = True
    if changed:
        conversation.save(update_fields=["title", "is_group", "is_pinned"])

    staff_users = User.objects.filter(is_staff=True, is_active=True)
    for staff_user in staff_users:
        StaffConversationParticipant.objects.get_or_create(conversation=conversation, user=staff_user)
    StaffConversationParticipant.objects.filter(conversation=conversation).update(hidden_at=None)
    return conversation


@api_view(["GET"])
def staff_chat_users(request):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response
    _ensure_everyone_conversation()
    users = User.objects.filter(is_staff=True, is_active=True).order_by("username")
    return Response({"success": True, "users": [_user_data(item) for item in users], "current_user": _user_data(user)})


@api_view(["GET"])
def conversation_summary(request):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response
    _ensure_everyone_conversation()
    conversations = _viewer_conversations(user)
    unread = sum(_unread_count(conversation, user) for conversation in conversations if not _is_muted(conversation, user))
    return Response({"success": True, "unread_count": unread})


@api_view(["GET", "POST"])
def conversations(request):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response
    _ensure_everyone_conversation()

    if request.method == "GET":
        rows = [_serialize_conversation(conversation, user) for conversation in _viewer_conversations(user)]
        return Response({"success": True, "conversations": rows})

    participant_ids = request.data.get("participant_ids") or []
    title = (request.data.get("title") or "").strip()
    is_group = bool(request.data.get("is_group"))

    try:
        participant_ids = [int(item) for item in participant_ids]
    except (TypeError, ValueError):
        return Response({"success": False, "message": "Invalid staff members selected."}, status=status.HTTP_400_BAD_REQUEST)

    participant_ids = sorted(set(participant_ids + [user.id]))
    participants = list(User.objects.filter(id__in=participant_ids, is_staff=True, is_active=True))
    if len(participants) < 2:
        return Response({"success": False, "message": "Choose at least one other staff member."}, status=status.HTTP_400_BAD_REQUEST)

    if len(participants) == 2 and not title:
        other_user_id = [item.id for item in participants if item.id != user.id][0]
        user_conversation_ids = StaffConversationParticipant.objects.filter(user=user).values("conversation_id")
        other_conversation_ids = StaffConversationParticipant.objects.filter(user_id=other_user_id).values("conversation_id")
        exact_private_conversations = (
            StaffConversation.objects.filter(is_group=False, id__in=user_conversation_ids)
            .filter(id__in=other_conversation_ids)
            .prefetch_related("conversation_participants")
            .annotate(participant_count=Count("conversation_participants", distinct=True))
            .filter(participant_count=2)
            .order_by("-updated_at")
        )
        existing = None
        newest_hidden_at = None
        for candidate in exact_private_conversations:
            membership = next((item for item in candidate.conversation_participants.all() if item.user_id == user.id), None)
            if membership and membership.hidden_at:
                if newest_hidden_at is None or membership.hidden_at > newest_hidden_at:
                    existing = candidate
                    newest_hidden_at = membership.hidden_at
            if existing is None:
                existing = candidate
        if existing:
            StaffConversationParticipant.objects.filter(conversation=existing, user=user).update(hidden_at=None)
            conversation = _viewer_conversations(user).get(id=existing.id)
            return Response({"success": True, "conversation": _serialize_conversation(conversation, user, include_messages=True)})

    conversation = StaffConversation.objects.create(
        title=title if is_group else "",
        is_group=is_group or len(participants) > 2,
        created_by=user,
    )
    StaffConversationParticipant.objects.bulk_create(
        [StaffConversationParticipant(conversation=conversation, user=participant) for participant in participants]
    )
    conversation = _viewer_conversations(user).get(id=conversation.id)
    return Response({"success": True, "conversation": _serialize_conversation(conversation, user, include_messages=True)})


@api_view(["GET"])
def conversation_detail(request, conversation_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response
    _ensure_everyone_conversation()
    try:
        conversation = _viewer_conversations(user).get(id=conversation_id)
    except StaffConversation.DoesNotExist:
        return Response({"success": False, "message": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
    StaffConversationParticipant.objects.filter(conversation=conversation, user=user).update(
        last_read_at=timezone.now(),
        manually_marked_unread=False,
    )
    conversation = _viewer_conversations(user).get(id=conversation_id)
    return Response({"success": True, "conversation": _serialize_conversation(conversation, user, include_messages=True)})


@api_view(["POST"])
def send_message(request, conversation_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response
    body = (request.data.get("body") or "").strip()
    if not body:
        return Response({"success": False, "message": "Type a message first."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        conversation = StaffConversation.objects.filter(conversation_participants__user=user).get(id=conversation_id)
    except StaffConversation.DoesNotExist:
        return Response({"success": False, "message": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)

    message = StaffMessage.objects.create(conversation=conversation, sender=user, body=body)
    mentioned_names = set(MENTION_RE.findall(body))
    if mentioned_names:
        mentioned_users = User.objects.filter(
            Q(username__in=mentioned_names) | Q(first_name__in=mentioned_names),
            is_staff=True,
            is_active=True,
            staff_chat_participations__conversation=conversation,
        ).distinct()
        message.mentions.set(mentioned_users)
        create_mention_notifications(
            actor=user,
            text=body,
            title=f"You were mentioned in Messenger by {user.username}",
            message=body[:240],
            target_url=f"/dashboard?chat={conversation.id}&message={message.id}",
            source_type="staff_chat",
            source_id=message.id,
            allowed_users=list(mentioned_users),
        )
    StaffConversationParticipant.objects.filter(conversation=conversation).update(hidden_at=None)
    StaffConversationParticipant.objects.filter(conversation=conversation, user=user).update(
        last_read_at=timezone.now(),
        manually_marked_unread=False,
    )
    conversation.updated_at = timezone.now()
    conversation.save(update_fields=["updated_at"])
    return Response({"success": True, "message": _serialize_message(message)})


@api_view(["POST"])
def mark_read(request, conversation_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response
    StaffConversationParticipant.objects.filter(conversation_id=conversation_id, user=user).update(
        last_read_at=timezone.now(),
        manually_marked_unread=False,
    )
    return Response({"success": True})


@api_view(["POST"])
def mark_unread(request, conversation_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response
    conversation = StaffConversation.objects.filter(conversation_participants__user=user).filter(id=conversation_id).first()
    if not conversation:
        return Response({"success": False, "message": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
    StaffConversationParticipant.objects.filter(conversation=conversation, user=user).update(
        manually_marked_unread=True,
        hidden_at=None,
    )
    return Response({"success": True})


@api_view(["POST"])
def mute_conversation(request, conversation_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response
    conversation = StaffConversation.objects.filter(conversation_participants__user=user).filter(id=conversation_id).first()
    if not conversation:
        return Response({"success": False, "message": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
    muted_until = timezone.now() + timedelta(hours=1)
    StaffConversationParticipant.objects.filter(conversation=conversation, user=user).update(
        muted_until=muted_until,
        hidden_at=None,
    )
    return Response({"success": True, "muted_until": muted_until.isoformat()})


@api_view(["POST"])
def hide_conversation(request, conversation_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response
    conversation = StaffConversation.objects.filter(conversation_participants__user=user).filter(id=conversation_id).first()
    if not conversation:
        return Response({"success": False, "message": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
    if conversation.is_everyone:
        return Response({"success": False, "message": "The Everyone thread cannot be deleted."}, status=status.HTTP_400_BAD_REQUEST)
    StaffConversationParticipant.objects.filter(conversation=conversation, user=user).update(
        hidden_at=timezone.now(),
        last_read_at=timezone.now(),
        manually_marked_unread=False,
    )
    return Response({"success": True})


@api_view(["POST"])
def add_participants(request, conversation_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    conversation = StaffConversation.objects.filter(conversation_participants__user=user).filter(id=conversation_id).first()
    if not conversation:
        return Response({"success": False, "message": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
    if conversation.is_everyone:
        return Response({"success": False, "message": "The Everyone thread already includes all active staff."}, status=status.HTTP_400_BAD_REQUEST)

    participant_ids = request.data.get("participant_ids") or []
    try:
        participant_ids = [int(item) for item in participant_ids]
    except (TypeError, ValueError):
        return Response({"success": False, "message": "Invalid staff members selected."}, status=status.HTTP_400_BAD_REQUEST)

    users_to_add = User.objects.filter(id__in=set(participant_ids), is_staff=True, is_active=True)
    added_count = 0
    for staff_user in users_to_add:
        _, created = StaffConversationParticipant.objects.get_or_create(conversation=conversation, user=staff_user)
        if created:
            added_count += 1
        else:
            StaffConversationParticipant.objects.filter(conversation=conversation, user=staff_user).update(hidden_at=None)

    participant_count = StaffConversationParticipant.objects.filter(conversation=conversation).count()
    if participant_count > 2 and not conversation.is_group:
        conversation.is_group = True
        conversation.save(update_fields=["is_group", "updated_at"])
    else:
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=["updated_at"])

    conversation = _viewer_conversations(user).get(id=conversation.id)
    return Response(
        {
            "success": True,
            "message": f"{added_count} staff member{'s' if added_count != 1 else ''} added.",
            "conversation": _serialize_conversation(conversation, user, include_messages=True),
        }
    )


@api_view(["POST"])
def remove_participant(request, conversation_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    conversation = StaffConversation.objects.filter(conversation_participants__user=user).filter(id=conversation_id).first()
    if not conversation:
        return Response({"success": False, "message": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
    if conversation.is_everyone:
        return Response({"success": False, "message": "Staff cannot be removed from the Everyone thread."}, status=status.HTTP_400_BAD_REQUEST)

    participant_id = request.data.get("participant_id")
    try:
        participant_id = int(participant_id)
    except (TypeError, ValueError):
        return Response({"success": False, "message": "Choose a staff member to remove."}, status=status.HTTP_400_BAD_REQUEST)

    if participant_id == user.id:
        return Response({"success": False, "message": "Use Leave thread to remove yourself."}, status=status.HTTP_400_BAD_REQUEST)

    membership = StaffConversationParticipant.objects.filter(conversation=conversation, user_id=participant_id).first()
    if not membership:
        return Response({"success": False, "message": "That staff member is not in this thread."}, status=status.HTTP_404_NOT_FOUND)

    membership.delete()
    conversation.updated_at = timezone.now()
    conversation.save(update_fields=["updated_at"])
    conversation = _viewer_conversations(user).get(id=conversation.id)
    return Response(
        {
            "success": True,
            "message": "Staff member removed.",
            "conversation": _serialize_conversation(conversation, user, include_messages=True),
        }
    )


@api_view(["POST"])
def leave_conversation(request, conversation_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    conversation = StaffConversation.objects.filter(conversation_participants__user=user).filter(id=conversation_id).first()
    if not conversation:
        return Response({"success": False, "message": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
    if conversation.is_everyone:
        return Response({"success": False, "message": "You cannot leave the Everyone thread."}, status=status.HTTP_400_BAD_REQUEST)

    StaffConversationParticipant.objects.filter(conversation=conversation, user=user).delete()
    conversation.updated_at = timezone.now()
    conversation.save(update_fields=["updated_at"])
    return Response({"success": True, "message": "You left the thread."})
