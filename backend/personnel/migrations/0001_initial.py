import django.db.models.deletion
import personnel.models
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PersonnelDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("contract", "Employment Contract"),
                            ("right_to_work", "Right to Work"),
                            ("id", "ID / Proof of Address"),
                            ("handbook", "Handbook / Policy Sign-off"),
                            ("training", "Training Record"),
                            ("licence", "Licence / Certificate"),
                            ("disciplinary", "Disciplinary / HR Note"),
                            ("other", "Other"),
                        ],
                        default="other",
                        max_length=40,
                    ),
                ),
                ("title", models.CharField(max_length=180)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("needed", "Needed"),
                            ("requested", "Requested"),
                            ("received", "Received"),
                            ("approved", "Approved"),
                            ("expired", "Expired"),
                        ],
                        default="needed",
                        max_length=20,
                    ),
                ),
                ("expiry_date", models.DateField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                ("file", models.FileField(blank=True, null=True, upload_to=personnel.models.personnel_document_upload_to)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "staff_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="personnel_documents",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="uploaded_personnel_documents",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["staff_user__first_name", "staff_user__last_name", "staff_user__username", "category", "title"],
            },
        ),
    ]
