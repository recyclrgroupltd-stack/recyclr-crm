from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0002_signingpack_signedpackdocument"),
    ]

    operations = [
        migrations.AddField(
            model_name="signingpack",
            name="acceptance_service_start_date",
            field=models.BooleanField(default=False),
        ),
    ]
