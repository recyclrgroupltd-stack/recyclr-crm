from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts_api", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="CompanyDetails",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("singleton_key", models.PositiveSmallIntegerField(default=1, editable=False, unique=True)),
                ("company_name", models.CharField(default="Recyclr Ltd", max_length=200)),
                ("company_number", models.CharField(blank=True, max_length=100)),
                ("registered_office", models.TextField(blank=True)),
                ("trading_address", models.TextField(blank=True)),
                ("website", models.CharField(blank=True, max_length=255)),
                ("main_email", models.EmailField(blank=True, max_length=254)),
                ("legal_documents_email", models.EmailField(blank=True, max_length=254)),
                ("phone_number", models.CharField(blank=True, max_length=50)),
                ("waste_broker_registration", models.CharField(blank=True, max_length=150)),
                ("legal_signatory_name", models.CharField(blank=True, max_length=150)),
                ("legal_signatory_title", models.CharField(blank=True, max_length=150)),
                ("legal_signature_data", models.TextField(blank=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Company Details",
                "verbose_name_plural": "Company Details",
            },
        ),
    ]
