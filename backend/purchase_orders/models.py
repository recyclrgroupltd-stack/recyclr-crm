from datetime import date
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import models
from django.utils import timezone


def _decimal(value, default="0.00"):
    if value in (None, ""):
        return Decimal(default)

    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _coerce_order_date(value):
    if isinstance(value, date):
        return value

    if isinstance(value, str) and value.strip():
        try:
            return date.fromisoformat(value.strip())
        except ValueError:
            return timezone.localdate()

    return timezone.localdate()


class Supplier(models.Model):
    name = models.CharField(max_length=255, unique=True)
    contact_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class PurchaseOrder(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_RECEIVED = "received"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PENDING, "Pending Approval"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_RECEIVED, "Received"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="purchase_orders",
    )
    po_number = models.CharField(max_length=30, unique=True, blank=True)
    order_date = models.DateField(default=timezone.localdate)
    requested_by = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    notes = models.TextField(blank=True)

    approval_note = models.TextField(blank=True)
    approved_by = models.CharField(max_length=255, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    received_by = models.CharField(max_length=255, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    received_note = models.TextField(blank=True)
    supplier_reference = models.CharField(max_length=255, blank=True)
    received_proof = models.FileField(
        upload_to="purchase_orders/received_proof/",
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return self.po_number or f"PO #{self.pk}"

    def save(self, *args, **kwargs):
        self.order_date = _coerce_order_date(self.order_date)

        creating = self.pk is None
        super().save(*args, **kwargs)

        if creating and not self.po_number:
            year = self.order_date.year if self.order_date else timezone.localdate().year
            self.po_number = f"PO-{year}-{self.pk:05d}"
            super().save(update_fields=["po_number"])

    @property
    def subtotal(self):
        total = Decimal("0.00")
        for line in self.lines.all():
            total += line.line_total
        return total.quantize(Decimal("0.01"))

    @property
    def vat_amount(self):
        return (self.subtotal * Decimal("0.20")).quantize(Decimal("0.01"))

    @property
    def total_inc_vat(self):
        return (self.subtotal + self.vat_amount).quantize(Decimal("0.01"))

    @property
    def total(self):
        return self.subtotal


class PurchaseOrderLine(models.Model):
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    line_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["line_order", "id"]

    def __str__(self):
        return self.description

    @property
    def line_total(self):
        qty = _decimal(self.quantity, "0.00")
        cost = _decimal(self.unit_cost, "0.00")
        return (qty * cost).quantize(Decimal("0.01"))


class StaffNotification(models.Model):
    TYPE_PO_APPROVAL = "po_approval"
    TYPE_PO_DECISION = "po_decision"
    TYPE_MENTION = "mention"
    TYPE_GENERAL = "general"

    TYPE_CHOICES = [
        (TYPE_PO_APPROVAL, "PO Approval"),
        (TYPE_PO_DECISION, "PO Decision"),
        (TYPE_MENTION, "Mention"),
        (TYPE_GENERAL, "General"),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_notifications",
    )
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default=TYPE_GENERAL)
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    is_read = models.BooleanField(default=False)
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    target_url = models.CharField(max_length=500, blank=True)
    source_type = models.CharField(max_length=50, blank=True)
    source_id = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["is_read", "-created_at"]

    def __str__(self):
        return f"{self.recipient} - {self.title}"
