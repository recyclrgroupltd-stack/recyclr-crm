import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hauliers", "0002_rename_rental_per_day_haulierrate_excess_per_kg_and_more"),
        ("services", "0002_alter_service_waste_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="service",
            name="collection_days",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="service",
            name="haulier",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="services",
                to="hauliers.haulier",
            ),
        ),
        migrations.AddField(
            model_name="service",
            name="schedule_start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="service",
            name="schedule_type",
            field=models.CharField(
                choices=[
                    ("weekly", "Weekly"),
                    ("fortnightly", "Fortnightly"),
                    ("on_request", "On Request"),
                ],
                default="weekly",
                max_length=20,
            ),
        ),
    ]