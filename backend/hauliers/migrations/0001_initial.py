from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Haulier",
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
            name="HaulierRate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "waste_type",
                    models.CharField(
                        choices=[
                            ("general", "General Waste"),
                            ("mixed_recycling", "Mixed Recycling"),
                            ("glass", "Glass"),
                            ("food", "Food"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "bin_size",
                    models.CharField(
                        choices=[
                            ("240", "240L"),
                            ("360", "360L"),
                            ("660", "660L"),
                            ("1100", "1100L"),
                        ],
                        max_length=10,
                    ),
                ),
                ("price_per_lift", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("rental_per_day", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("active", models.BooleanField(default=True)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "haulier",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="rates", to="hauliers.haulier"),
                ),
            ],
            options={
                "ordering": ["haulier__name", "waste_type", "bin_size", "-id"],
                "unique_together": {("haulier", "waste_type", "bin_size")},
            },
        ),
    ]