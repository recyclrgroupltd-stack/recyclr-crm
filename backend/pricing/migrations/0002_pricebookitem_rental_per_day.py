from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pricing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="pricebookitem",
            name="rental_per_day",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.25"),
                max_digits=10,
            ),
        ),
    ]