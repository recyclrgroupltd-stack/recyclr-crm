# Generated manually for container QR label print settings.

from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts_api", "0009_remove_staffprofile_mileage_rate_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="companydetails",
            name="container_qr_label_height_mm",
            field=models.DecimalField(decimal_places=2, default=Decimal("50"), max_digits=6),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="container_qr_label_width_mm",
            field=models.DecimalField(decimal_places=2, default=Decimal("50"), max_digits=6),
        ),
    ]
