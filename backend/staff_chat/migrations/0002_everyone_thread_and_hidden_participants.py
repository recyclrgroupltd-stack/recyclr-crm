from django.conf import settings
from django.db import migrations, models


def create_everyone_thread(apps, schema_editor):
    User = apps.get_model("auth", "User")
    StaffConversation = apps.get_model("staff_chat", "StaffConversation")
    StaffConversationParticipant = apps.get_model("staff_chat", "StaffConversationParticipant")

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

    users = User.objects.filter(is_staff=True, is_active=True)
    for user in users:
        StaffConversationParticipant.objects.get_or_create(conversation=conversation, user=user)


class Migration(migrations.Migration):

    dependencies = [
        ("staff_chat", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="staffconversation",
            name="is_everyone",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="staffconversation",
            name="is_pinned",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="staffconversationparticipant",
            name="hidden_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(create_everyone_thread, migrations.RunPython.noop),
    ]
