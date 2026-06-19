import random

from django.core.exceptions import ValidationError
from django.db import models


WASTE_STREAM_CHOICES = [
    ("general", "General Waste"),
    ("mixed_recycling", "Mixed Recycling"),
    ("cardboard", "Cardboard"),
    ("glass", "Glass"),
    ("food", "Food"),
    ("paper", "Paper"),
]

BIN_SIZE_CHOICES = [
    ("240", "240L"),
    ("360", "360L"),
    ("660", "660L"),
    ("1100", "1100L"),
]

STREAM_CODES = {
    "general": "11",
    "mixed_recycling": "12",
    "cardboard": "13",
    "glass": "14",
    "food": "15",
    "paper": "16",
}


class ContainerBatch(models.Model):
    bin_size = models.CharField(max_length=10, choices=BIN_SIZE_CHOICES)
    waste_stream = models.CharField(max_length=30, choices=WASTE_STREAM_CHOICES)
    quantity = models.PositiveIntegerField()
    supplier = models.CharField(max_length=255, blank=True)
    delivery_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.quantity} x {self.bin_size}L {self.get_waste_stream_display()}"


class Container(models.Model):
    STATUS_INACTIVE = "inactive"
    STATUS_ASSIGNED = "assigned"
    STATUS_ACTIVE = "active"
    STATUS_MAINTENANCE = "maintenance"
    STATUS_EOL = "eol"

    STATUS_CHOICES = [
        (STATUS_INACTIVE, "In Stock"),
        (STATUS_ASSIGNED, "Assigned"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_MAINTENANCE, "Maintenance"),
        (STATUS_EOL, "EOL"),
    ]

    container_uid = models.CharField(max_length=40, unique=True, blank=True)
    bin_size = models.CharField(max_length=10, choices=BIN_SIZE_CHOICES)
    waste_stream = models.CharField(max_length=30, choices=WASTE_STREAM_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_INACTIVE)

    batch = models.ForeignKey(
        ContainerBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="containers",
    )
    site = models.ForeignKey(
        "customers.Site",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="containers",
    )
    service = models.ForeignKey(
        "services.Service",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="containers",
    )

    qr_payload = models.CharField(max_length=255, blank=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    eol_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["container_uid", "id"]

    def clean(self):
        if self.status in [self.STATUS_ASSIGNED, self.STATUS_ACTIVE] and not self.site_id:
            raise ValidationError("Assigned and active containers must be linked to a site.")

        if self.status == self.STATUS_INACTIVE:
            self.site = None
            self.service = None
            self.assigned_at = None
            self.delivered_at = None

    def generate_container_uid(self):
        stream_code = STREAM_CODES.get(self.waste_stream, "00")
        for _ in range(50):
            suffix = f"{random.randint(0, 999999):06d}"
            candidate = f"CONT-{self.bin_size}-{stream_code}{suffix}"
            if not Container.objects.filter(container_uid=candidate).exclude(pk=self.pk).exists():
                return candidate
        raise ValidationError("Could not generate a unique container ID. Please try again.")

    def save(self, *args, **kwargs):
        if not self.container_uid:
            self.container_uid = self.generate_container_uid()
        if not self.qr_payload:
            self.qr_payload = f"recyclr://containers/{self.container_uid}"
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.container_uid or "Container"


class ContainerMaintenanceEvent(models.Model):
    STATUS_OPEN = "open"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_RESOLVED = "resolved"
    STATUS_EOL = "eol"

    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_RESOLVED, "Resolved"),
        (STATUS_EOL, "Marked EOL"),
    ]

    container = models.ForeignKey(Container, on_delete=models.CASCADE, related_name="maintenance_events")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN)
    title = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    reported_by = models.CharField(max_length=255, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.container} - {self.title}"
