from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AIInteractionLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(default="openai", max_length=40)),
                ("model", models.CharField(blank=True, max_length=80)),
                ("context_type", models.CharField(blank=True, max_length=80)),
                ("context_id", models.PositiveIntegerField(blank=True, null=True)),
                ("intent", models.CharField(blank=True, max_length=80)),
                ("prompt", models.TextField(blank=True)),
                ("response", models.TextField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("disabled", "Disabled"),
                            ("completed", "Completed"),
                            ("error", "Error"),
                        ],
                        default="disabled",
                        max_length=20,
                    ),
                ),
                ("error_message", models.TextField(blank=True)),
                ("input_tokens", models.PositiveIntegerField(default=0)),
                ("output_tokens", models.PositiveIntegerField(default=0)),
                ("estimated_cost_gbp", models.DecimalField(decimal_places=4, default=Decimal("0.0000"), max_digits=10)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ai_interaction_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
    ]
