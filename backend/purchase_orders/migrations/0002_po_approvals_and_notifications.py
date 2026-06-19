from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class AddFieldIfNotExists(migrations.AddField):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.model_name)
        table_name = model._meta.db_table

        with schema_editor.connection.cursor() as cursor:
            columns = {
                column.name
                for column in schema_editor.connection.introspection.get_table_description(cursor, table_name)
            }

        if self.name in columns:
            return

        super().database_forwards(app_label, schema_editor, from_state, to_state)


class CreateModelIfNotExists(migrations.CreateModel):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.name)

        with schema_editor.connection.cursor() as cursor:
            tables = schema_editor.connection.introspection.table_names(cursor)

        if model._meta.db_table in tables:
            return

        super().database_forwards(app_label, schema_editor, from_state, to_state)


class Migration(migrations.Migration):

    dependencies = [
        ("purchase_orders", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        AddFieldIfNotExists(
            model_name="purchaseorder",
            name="approval_note",
            field=models.TextField(blank=True),
        ),
        AddFieldIfNotExists(
            model_name="purchaseorder",
            name="approved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        AddFieldIfNotExists(
            model_name="purchaseorder",
            name="approved_by",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name="purchaseorder",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("pending", "Pending Approval"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("received", "Received"),
                    ("cancelled", "Cancelled"),
                ],
                default="draft",
                max_length=20,
            ),
        ),
        CreateModelIfNotExists(
            name="StaffNotification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("notification_type", models.CharField(
                    choices=[
                        ("po_approval", "PO Approval"),
                        ("po_decision", "PO Decision"),
                        ("general", "General"),
                    ],
                    default="general",
                    max_length=30,
                )),
                ("title", models.CharField(max_length=255)),
                ("message", models.TextField(blank=True)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("purchase_order", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="notifications",
                    to="purchase_orders.purchaseorder",
                )),
                ("recipient", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="staff_notifications",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "ordering": ["is_read", "-created_at"],
            },
        ),
    ]
