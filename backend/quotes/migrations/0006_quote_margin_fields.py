# Generated manually for internal quote margin tracking.

from decimal import Decimal

from django.db import migrations, models


def seed_quote_costs(apps, schema_editor):
    Quote = apps.get_model("quotes", "Quote")
    QuoteLine = apps.get_model("quotes", "QuoteLine")

    for line in QuoteLine.objects.all():
        line.supplier_price_per_lift = (line.price_per_lift * Decimal("0.70")).quantize(Decimal("0.01"))
        line.supplier_rental_per_day = (line.rental_per_day * Decimal("0.70")).quantize(Decimal("0.01"))
        supplier_collection = (
            Decimal(line.bin_count)
            * Decimal(line.collections_per_week)
            * Decimal("4.33")
            * line.supplier_price_per_lift
        )
        supplier_rental = Decimal(line.bin_count) * Decimal("30") * line.supplier_rental_per_day
        line.supplier_cost_per_month = (supplier_collection + supplier_rental).quantize(Decimal("0.01"))
        line.margin_per_month = (line.line_total_per_month - line.supplier_cost_per_month).quantize(Decimal("0.01"))
        line.margin_percent = (
            (line.margin_per_month / line.line_total_per_month) * Decimal("100")
            if line.line_total_per_month > 0
            else Decimal("0.00")
        ).quantize(Decimal("0.01"))
        line.save(
            update_fields=[
                "supplier_price_per_lift",
                "supplier_rental_per_day",
                "supplier_cost_per_month",
                "margin_per_month",
                "margin_percent",
            ]
        )

    for quote in Quote.objects.all():
        subtotal = Decimal("0.00")
        rental_total = Decimal("0.00")
        supplier_cost_total = Decimal("0.00")
        for line in quote.lines.all():
            subtotal += line.collection_charge_per_month
            rental_total += line.bin_rental_per_month
            supplier_cost_total += line.supplier_cost_per_month
        quote.subtotal_per_month = subtotal.quantize(Decimal("0.01"))
        quote.bin_rental_per_month = rental_total.quantize(Decimal("0.01"))
        quote.total_per_month = (subtotal + rental_total).quantize(Decimal("0.01"))
        quote.supplier_cost_per_month = supplier_cost_total.quantize(Decimal("0.01"))
        quote.margin_per_month = (quote.total_per_month - quote.supplier_cost_per_month).quantize(Decimal("0.01"))
        quote.margin_percent = (
            (quote.margin_per_month / quote.total_per_month) * Decimal("100")
            if quote.total_per_month > 0
            else Decimal("0.00")
        ).quantize(Decimal("0.01"))
        quote.save(
            update_fields=[
                "subtotal_per_month",
                "bin_rental_per_month",
                "total_per_month",
                "supplier_cost_per_month",
                "margin_per_month",
                "margin_percent",
            ]
        )


class Migration(migrations.Migration):

    dependencies = [
        ("quotes", "0005_quote_contract_start_date_alter_quote_address_line_1_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="quote",
            name="margin_per_month",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="quote",
            name="margin_percent",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AddField(
            model_name="quote",
            name="supplier_cost_per_month",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="quoteline",
            name="margin_per_month",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="quoteline",
            name="margin_percent",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AddField(
            model_name="quoteline",
            name="supplier_cost_per_month",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="quoteline",
            name="supplier_price_per_lift",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="quoteline",
            name="supplier_rental_per_day",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.RunPython(seed_quote_costs, migrations.RunPython.noop),
    ]
