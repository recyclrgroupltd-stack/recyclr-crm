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


def receipt_upload_to(instance, filename):
    staff_name = instance.submitted_by.username if instance.submitted_by_id else "staff"
    return f"expenses/receipts/{staff_name}/{timezone.now().strftime('%Y/%m')}/{filename}"


class ExpenseCategory(models.Model):
    name = models.CharField(max_length=120, unique=True)
    active = models.BooleanField(default=True)
    requires_receipt = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Expense categories"

    def __str__(self):
        return self.name


class ExpenseClaim(models.Model):
    TYPE_GENERAL = "general"
    TYPE_MILEAGE = "mileage"

    EXPENSE_TYPE_CHOICES = [
        (TYPE_GENERAL, "General Expense"),
        (TYPE_MILEAGE, "Mileage"),
    ]

    STATUS_DRAFT = "draft"
    STATUS_SUBMITTED = "submitted"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_PAID = "paid"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_PAID, "Paid"),
    ]

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expense_claims",
    )
    category = models.ForeignKey(
        ExpenseCategory,
        on_delete=models.PROTECT,
        related_name="expenses",
    )

    expense_type = models.CharField(max_length=20, choices=EXPENSE_TYPE_CHOICES, default=TYPE_GENERAL)
    expense_date = models.DateField(default=timezone.localdate)
    merchant = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    mileage = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    mileage_rate = models.DecimalField(max_digits=8, decimal_places=4, default=0)

    receipt = models.FileField(upload_to=receipt_upload_to, blank=True, null=True)
    receipt_original_name = models.CharField(max_length=255, blank=True)
    extracted_text = models.TextField(blank=True)
    extracted_merchant = models.CharField(max_length=255, blank=True)
    extracted_date = models.DateField(null=True, blank=True)
    extracted_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    extraction_status = models.CharField(max_length=50, default="not_run")
    extraction_message = models.CharField(max_length=255, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SUBMITTED)
    submitted_at = models.DateTimeField(default=timezone.now)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_expenses",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status", "-expense_date", "-id"]

    def save(self, *args, **kwargs):
        if self.expense_type == self.TYPE_MILEAGE:
            self.amount = (_decimal(self.mileage) * _decimal(self.mileage_rate)).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.submitted_by} - {self.category} - £{self.amount}"



class ExpenseLine(models.Model):
    claim = models.ForeignKey(
        ExpenseClaim,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    category = models.ForeignKey(
        ExpenseCategory,
        on_delete=models.PROTECT,
        related_name="expense_lines",
        null=True,
        blank=True,
    )
    description = models.CharField(max_length=255, blank=True)
    merchant = models.CharField(max_length=255, blank=True)
    serial_number = models.CharField(max_length=120, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.claim_id} - {self.description or self.category} - GBP {self.amount}"
