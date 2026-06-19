from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0010_lead_sic_code"),
    ]

    operations = [
        migrations.CreateModel(
            name="LeadWasteRequirement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("waste_type", models.CharField(choices=[("general", "General Waste"), ("recycling", "Dry Mixed Recycling"), ("glass", "Glass"), ("food", "Food")], max_length=20)),
                ("bin_count", models.PositiveIntegerField(default=1)),
                ("bin_size", models.CharField(choices=[("240", "240L"), ("360", "360L"), ("660", "660L"), ("1100", "1100L")], max_length=10)),
                ("collections_per_week", models.PositiveIntegerField(default=1)),
                ("lock_required", models.BooleanField(default=False)),
                ("metal_bin_required", models.BooleanField(default=False)),
                ("current_provider", models.CharField(blank=True, max_length=255)),
                ("current_cost", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("lead", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="extra_waste_requirements", to="leads.lead")),
            ],
            options={
                "ordering": ["id"],
            },
        ),
    ]
