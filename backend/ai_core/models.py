from decimal import Decimal

from django.conf import settings
from django.db import models


class AIInteractionLog(models.Model):
    STATUS_DISABLED = "disabled"
    STATUS_COMPLETED = "completed"
    STATUS_ERROR = "error"

    STATUS_CHOICES = [
        (STATUS_DISABLED, "Disabled"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_ERROR, "Error"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_interaction_logs",
    )
    provider = models.CharField(max_length=40, default="openai")
    model = models.CharField(max_length=80, blank=True)
    context_type = models.CharField(max_length=80, blank=True)
    context_id = models.PositiveIntegerField(null=True, blank=True)
    intent = models.CharField(max_length=80, blank=True)
    prompt = models.TextField(blank=True)
    response = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DISABLED)
    error_message = models.TextField(blank=True)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    estimated_cost_gbp = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0.0000"))
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.provider} {self.intent or 'assistant'} - {self.status}"
