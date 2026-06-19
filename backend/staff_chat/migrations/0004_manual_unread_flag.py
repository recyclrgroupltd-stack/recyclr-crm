from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("staff_chat", "0003_participant_muted_until"),
    ]

    operations = [
        migrations.AddField(
            model_name="staffconversationparticipant",
            name="manually_marked_unread",
            field=models.BooleanField(default=False),
        ),
    ]
