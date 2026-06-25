import random
from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


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


class ContainerMovement(models.Model):
    TYPE_DELIVERY = "delivery"
    TYPE_COLLECTION = "collection"
    TYPE_REPLACEMENT_DELIVERY = "replacement_delivery"

    TYPE_CHOICES = [
        (TYPE_DELIVERY, "Delivery"),
        (TYPE_COLLECTION, "Collection"),
        (TYPE_REPLACEMENT_DELIVERY, "Replacement Delivery"),
    ]

    STATUS_SCHEDULED = "scheduled"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_SCHEDULED, "Scheduled"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    movement_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SCHEDULED)
    scheduled_date = models.DateField()

    customer = models.ForeignKey("customers.Customer", on_delete=models.CASCADE, related_name="container_movements")
    site = models.ForeignKey("customers.Site", on_delete=models.CASCADE, related_name="container_movements")
    service = models.ForeignKey(
        "services.Service",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="container_movements",
    )
    container = models.ForeignKey(
        Container,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movements",
    )

    waste_stream = models.CharField(max_length=30, choices=WASTE_STREAM_CHOICES)
    bin_size = models.CharField(max_length=10, choices=BIN_SIZE_CHOICES)
    quantity = models.PositiveIntegerField(default=1)

    reason = models.TextField(blank=True)
    created_by = models.CharField(max_length=255, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completion_notes = models.TextField(blank=True)
    qr_scan_value = models.CharField(max_length=255, blank=True)
    customer_present = models.BooleanField(default=False)
    signature_data = models.TextField(blank=True)
    photo_data = models.JSONField(default=list, blank=True)

    billable_to_customer = models.BooleanField(default=False)
    charge_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    charge_reason = models.CharField(max_length=255, blank=True)
    billed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_date", "id"]

    def __str__(self):
        return f"{self.get_movement_type_display()} - {self.customer} - {self.scheduled_date}"


DEFAULT_CUSTOMER_DAMAGED_BIN_CHARGE = Decimal("75.00")


def suggested_delivery_date_for_service(service):
    today = timezone.localdate()
    start_date = getattr(service, "schedule_start_date", None)
    if not start_date:
        return today
    return max(today, start_date - timedelta(days=2))


def ensure_delivery_movement_for_service(service, created_by="CRM automation"):
    if not getattr(service, "customer_id", None) or not getattr(service, "site_id", None):
        return None
    if service.status != getattr(service, "STATUS_ACTIVE", "active"):
        return None

    scheduled_date = suggested_delivery_date_for_service(service)
    movement, _ = ContainerMovement.objects.get_or_create(
        movement_type=ContainerMovement.TYPE_DELIVERY,
        service=service,
        defaults={
            "status": ContainerMovement.STATUS_SCHEDULED,
            "customer": service.customer,
            "site": service.site,
            "scheduled_date": scheduled_date,
            "waste_stream": service.waste_type,
            "bin_size": service.bin_size,
            "quantity": max(int(service.bin_count or 1), 1),
            "reason": "Auto scheduled for new active service.",
            "created_by": created_by,
        },
    )
    return movement


def ensure_collection_movement_for_service(service, created_by="CRM automation"):
    if not getattr(service, "customer_id", None) or not getattr(service, "site_id", None):
        return None
    if service.status != getattr(service, "STATUS_ENDED", "ended"):
        return None

    scheduled_date = timezone.localdate() + timedelta(days=1)
    movement, _ = ContainerMovement.objects.get_or_create(
        movement_type=ContainerMovement.TYPE_COLLECTION,
        service=service,
        defaults={
            "status": ContainerMovement.STATUS_SCHEDULED,
            "customer": service.customer,
            "site": service.site,
            "scheduled_date": scheduled_date,
            "waste_stream": service.waste_type,
            "bin_size": service.bin_size,
            "quantity": max(int(service.bin_count or 1), 1),
            "reason": "Auto scheduled because service ended.",
            "created_by": created_by,
        },
    )
    return movement


def create_replacement_delivery_movement(old_container, replacement, *, customer_damaged=False, created_by="CRM automation"):
    site = replacement.site or old_container.site
    service = replacement.service or old_container.service
    if not site or not site.customer_id:
        return None

    return ContainerMovement.objects.create(
        movement_type=ContainerMovement.TYPE_REPLACEMENT_DELIVERY,
        status=ContainerMovement.STATUS_SCHEDULED,
        scheduled_date=timezone.localdate(),
        customer=site.customer,
        site=site,
        service=service,
        container=replacement,
        waste_stream=replacement.waste_stream,
        bin_size=replacement.bin_size,
        quantity=1,
        reason=f"Replacement for {old_container.container_uid} marked EOL.",
        created_by=created_by,
        billable_to_customer=customer_damaged,
        charge_amount=DEFAULT_CUSTOMER_DAMAGED_BIN_CHARGE if customer_damaged else Decimal("0.00"),
        charge_reason="Customer damaged bin replacement delivery" if customer_damaged else "",
    )
