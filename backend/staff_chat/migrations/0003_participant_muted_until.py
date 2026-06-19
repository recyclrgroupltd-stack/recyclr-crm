from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("staff_chat", "0002_everyone_thread_and_hidden_participants"),
    ]

    operations = [
        migrations.AddField(
            model_name="staffconversationparticipant",
            name="muted_until",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
