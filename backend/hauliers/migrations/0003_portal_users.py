from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0006_customeractivity"),
        ("hauliers", "0002_rename_rental_per_day_haulierrate_excess_per_kg_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="HaulierPortalUser",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("full_name", models.CharField(max_length=255)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("portal_pin", models.CharField(max_length=20)),
                ("active", models.BooleanField(default=True)),
                ("can_view_all_sites", models.BooleanField(default=True)),
                ("notes", models.TextField(blank=True)),
                ("last_login_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "haulier",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="portal_users",
                        to="hauliers.haulier",
                    ),
                ),
            ],
            options={
                "ordering": ["haulier__name", "full_name", "email"],
            },
        ),
        migrations.CreateModel(
            name="HaulierPortalUserSiteAccess",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "portal_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="site_access_entries",
                        to="hauliers.haulierportaluser",
                    ),
                ),
                (
                    "site",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="haulier_portal_access_entries",
                        to="customers.site",
                    ),
                ),
            ],
            options={
                "ordering": ["site__site_name", "id"],
                "unique_together": {("portal_user", "site")},
            },
        ),
    ]