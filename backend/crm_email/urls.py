from django.urls import path

from .views import (
    mailbox_archive_view,
    mailbox_attachment_view,
    mailbox_delete_view,
    mailbox_folders_view,
    mailbox_messages_view,
    mailbox_move_view,
    mailbox_read_view,
    mailbox_rule_delete_view,
    mailbox_rules_apply_view,
    mailbox_rules_view,
    mailbox_send_view,
)

urlpatterns = [
    path("folders/", mailbox_folders_view, name="crm-email-folders"),
    path("messages/", mailbox_messages_view, name="crm-email-messages"),
    path("messages/<str:folder>/<str:message_id>/read/", mailbox_read_view, name="crm-email-read"),
    path("messages/<str:folder>/<str:message_id>/delete/", mailbox_delete_view, name="crm-email-delete"),
    path("messages/<str:folder>/<str:message_id>/archive/", mailbox_archive_view, name="crm-email-archive"),
    path("messages/<str:folder>/<str:message_id>/move/", mailbox_move_view, name="crm-email-move"),
    path(
        "messages/<str:folder>/<str:message_id>/attachments/<str:attachment_id>/",
        mailbox_attachment_view,
        name="crm-email-attachment",
    ),
    path("send/", mailbox_send_view, name="crm-email-send"),
    path("rules/", mailbox_rules_view, name="crm-email-rules"),
    path("rules/apply/", mailbox_rules_apply_view, name="crm-email-rules-apply"),
    path("rules/<int:rule_id>/delete/", mailbox_rule_delete_view, name="crm-email-rule-delete"),
]
