# Generated manually for Recyclr CRM pricebook commercial controls.

from decimal import Decimal

from django.db import migrations, models


def seed_supplier_costs(apps, schema_editor):
    PriceBookItem = apps.get_model("pricing", "PriceBookItem")
    for item in PriceBookItem.objects.all():
        item.supplier_price_per_lift = (item.price_per_lift * Decimal("0.70")).quantize(Decimal("0.01"))
        item.supplier_rental_per_day = (item.rental_per_day * Decimal("0.70")).quantize(Decimal("0.01"))
        item.target_margin_percent = Decimal("30.00")
        item.save(
            update_fields=[
                "supplier_price_per_lift",
                "supplier_rental_per_day",
                "target_margin_percent",
            ]
        )


class Migration(migrations.Migration):

    dependencies = [
        ("pricing", "0003_pricebookitem_notes"),
    ]

    operations = [
        migrations.AddField(
            model_name="pricebookitem",
            name="delivery_charge",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10),
        ),
        migrations.AddField(
            model_name="pricebookitem",
            name="effective_from",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pricebookitem",
            name="effective_to",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pricebookitem",
            name="minimum_monthly_charge",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10),
        ),
        migrations.AddField(
            model_name="pricebookitem",
            name="supplier_price_per_lift",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10),
        ),
        migrations.AddField(
            model_name="pricebookitem",
            name="supplier_rental_per_day",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10),
        ),
        migrations.AddField(
            model_name="pricebookitem",
            name="target_margin_percent",
            field=models.DecimalField(decimal_places=2, default=Decimal("30.00"), max_digits=6),
        ),
        migrations.RunPython(seed_supplier_costs, migrations.RunPython.noop),
    ]
