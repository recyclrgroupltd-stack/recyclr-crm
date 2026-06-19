import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Supplier",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255, unique=True)),
                ("contact_name", models.CharField(blank=True, max_length=255)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("phone", models.CharField(blank=True, max_length=50)),
                ("notes", models.TextField(blank=True)),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="PurchaseOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("po_number", models.CharField(blank=True, max_length=30, unique=True)),
                ("order_date", models.DateField(default=django.utils.timezone.localdate)),
                ("requested_by", models.CharField(blank=True, max_length=255)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("pending", "Pending Approval"), ("approved", "Approved"), ("rejected", "Rejected"), ("received", "Received"), ("cancelled", "Cancelled")], default="draft", max_length=20)),
                ("notes", models.TextField(blank=True)),
                ("approval_note", models.TextField(blank=True)),
                ("approved_by", models.CharField(blank=True, max_length=255)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("supplier", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="purchase_orders", to="purchase_orders.supplier")),
            ],
            options={
                "ordering": ["-id"],
            },
        ),
        migrations.CreateModel(
            name="PurchaseOrderLine",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("description", models.CharField(max_length=255)),
                ("quantity", models.DecimalField(decimal_places=2, default=1, max_digits=10)),
                ("unit_cost", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("line_order", models.PositiveIntegerField(default=0)),
                ("purchase_order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lines", to="purchase_orders.purchaseorder")),
            ],
            options={
                "ordering": ["line_order", "id"],
            },
        ),
        migrations.CreateModel(
            name="StaffNotification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("notification_type", models.CharField(choices=[("po_approval", "PO Approval"), ("po_decision", "PO Decision"), ("general", "General")], default="general", max_length=30)),
                ("title", models.CharField(max_length=255)),
                ("message", models.TextField(blank=True)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("purchase_order", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="purchase_orders.purchaseorder")),
                ("recipient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="staff_notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["is_read", "-created_at"],
            },
        ),
    ]