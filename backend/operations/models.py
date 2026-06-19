from django.db import models

from customers.models import Customer, Site
from services.models import Service


class CollectionEvent(models.Model):
    STATUS_CHOICES = [
        ("collected", "Collected"),
        ("failed", "Failed"),
    ]

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="collection_events",
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="collection_events",
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="collection_events",
    )

    waste_type = models.CharField(max_length=50)
    date_time = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    reason = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_time", "-id"]

    def __str__(self):
        return f"{self.site} - {self.waste_type} - {self.status}"