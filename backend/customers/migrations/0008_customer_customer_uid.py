from django.db import migrations, models


def backfill_customer_uids(apps, schema_editor):
    Customer = apps.get_model("customers", "Customer")
    for customer in Customer.objects.filter(customer_uid__isnull=True).order_by("id"):
        customer.customer_uid = f"CUST-{customer.id:06d}"
        customer.save(update_fields=["customer_uid"])


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0007_customer_sic_code"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="customer_uid",
            field=models.CharField(blank=True, max_length=20, null=True, unique=True),
        ),
        migrations.RunPython(backfill_customer_uids, migrations.RunPython.noop),
    ]
