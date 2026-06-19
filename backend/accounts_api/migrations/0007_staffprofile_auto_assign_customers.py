from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts_api", "0006_staffprofile_mailbox_enabled_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="staffprofile",
            name="auto_assign_customers",
            field=models.BooleanField(default=True),
        ),
    ]
