from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("purchase_orders", "0002_po_approvals_and_notifications"),
    ]

    operations = [
        migrations.AddField(
            model_name="purchaseorder",
            name="received_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="purchaseorder",
            name="received_by",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="purchaseorder",
            name="received_note",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="purchaseorder",
            name="received_proof",
            field=models.FileField(blank=True, null=True, upload_to="purchase_orders/received_proof/"),
        ),
        migrations.AddField(
            model_name="purchaseorder",
            name="supplier_reference",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]