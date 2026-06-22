from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0010_customer_auto_invoice_enabled_customer_invoice_email_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="portal_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="customer",
            name="portal_password_hash",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
