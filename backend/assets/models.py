from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class AssetLocation(models.Model):
    KIND_DEPOT = "depot"
    KIND_OFFICE = "office"
    KIND_VEHICLE = "vehicle"
    KIND_STORAGE = "storage"
    KIND_OTHER = "other"

    KIND_CHOICES = [
        (KIND_DEPOT, "Depot"),
        (KIND_OFFICE, "Office"),
        (KIND_VEHICLE, "Vehicle"),
        (KIND_STORAGE, "Storage"),
        (KIND_OTHER, "Other"),
    ]

    name = models.CharField(max_length=120, unique=True)
    kind = models.CharField(max_length=30, choices=KIND_CHOICES, default=KIND_DEPOT)
    address = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Asset(models.Model):
    CATEGORY_CHOICES = [
        ("vehicle", "Vehicle"),
        ("plant", "Plant / Machinery"),
        ("it", "IT / Device"),
        ("office", "Office Equipment"),
        ("tool", "Tool"),
        ("ppe", "PPE"),
        ("other", "Other"),
    ]

    STATUS_ACTIVE = "active"
    STATUS_IN_REPAIR = "in_repair"
    STATUS_LOST = "lost"
    STATUS_RETIRED = "retired"
    STATUS_SOLD = "sold"

    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_IN_REPAIR, "In Repair"),
        (STATUS_LOST, "Lost"),
        (STATUS_RETIRED, "Retired"),
        (STATUS_SOLD, "Sold"),
    ]

    asset_uid = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default="other")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    serial_number = models.CharField(max_length=120, blank=True)
    location = models.CharField(max_length=255, blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_assets",
    )
    purchase_date = models.DateField(null=True, blank=True)
    purchase_value = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    supplier = models.CharField(max_length=255, blank=True)
    warranty_expiry = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    purchase_order = models.ForeignKey(
        "purchase_orders.PurchaseOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets",
    )
    expense_claim = models.ForeignKey(
        "expenses.ExpenseClaim",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_assets",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["asset_uid", "name"]

    def save(self, *args, **kwargs):
        creating = self.pk is None
        super().save(*args, **kwargs)
        if creating and not self.asset_uid:
            self.asset_uid = f"AST-{self.pk:06d}"
            super().save(update_fields=["asset_uid"])

    @property
    def qr_payload(self):
        return f"recyclr-asset:{self.asset_uid}"

    def __str__(self):
        return f"{self.asset_uid or 'AST-new'} - {self.name}"


class AssetEvent(models.Model):
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="events")
    title = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    old_status = models.CharField(max_length=30, blank=True)
    new_status = models.CharField(max_length=30, blank=True)
    created_by = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.asset.asset_uid} - {self.title}"
