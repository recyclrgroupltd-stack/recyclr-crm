from django.urls import path

from .views import (
    add_participants,
    conversation_detail,
    conversation_summary,
    conversations,
    hide_conversation,
    leave_conversation,
    mark_read,
    mark_unread,
    mute_conversation,
    remove_participant,
    send_message,
    staff_chat_users,
)

urlpatterns = [
    path("users/", staff_chat_users, name="staff-chat-users"),
    path("summary/", conversation_summary, name="staff-chat-summary"),
    path("conversations/", conversations, name="staff-chat-conversations"),
    path("conversations/<int:conversation_id>/", conversation_detail, name="staff-chat-conversation-detail"),
    path("conversations/<int:conversation_id>/send/", send_message, name="staff-chat-send-message"),
    path("conversations/<int:conversation_id>/read/", mark_read, name="staff-chat-mark-read"),
    path("conversations/<int:conversation_id>/unread/", mark_unread, name="staff-chat-mark-unread"),
    path("conversations/<int:conversation_id>/mute/", mute_conversation, name="staff-chat-mute-conversation"),
    path("conversations/<int:conversation_id>/hide/", hide_conversation, name="staff-chat-hide-conversation"),
    path("conversations/<int:conversation_id>/participants/add/", add_participants, name="staff-chat-add-participants"),
    path("conversations/<int:conversation_id>/participants/remove/", remove_participant, name="staff-chat-remove-participant"),
    path("conversations/<int:conversation_id>/leave/", leave_conversation, name="staff-chat-leave-conversation"),
]
