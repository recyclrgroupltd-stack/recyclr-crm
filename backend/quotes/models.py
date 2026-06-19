from decimal import Decimal

from django.db import models

from customers.models import Customer, Site
from leads.models import Lead


class Quote(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("sent", "Sent"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
        ("expired", "Expired"),
    ]

    quote_number = models.CharField(max_length=30, unique=True, blank=True)
    title = models.CharField(max_length=255, blank=True)

    lead = models.ForeignKey(
        Lead,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotes",
    )

    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotes",
    )

    site = models.ForeignKey(
        Site,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotes",
    )

    contact_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)

    # NEW
    sic_code = models.CharField(max_length=20, blank=True, null=True)

    # Address fallback (if no lead/site)
    address_line_1 = models.CharField(max_length=255, blank=True, null=True)
    address_line_2 = models.CharField(max_length=255, blank=True, null=True)
    town = models.CharField(max_length=100, blank=True, null=True)
    county = models.CharField(max_length=100, blank=True, null=True)
    postcode = models.CharField(max_length=20, blank=True, null=True)

    # NEW
    contract_start_date = models.DateTimeField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
    )

    valid_until = models.DateField(null=True, blank=True)

    subtotal_per_month = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    bin_rental_per_month = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_per_month = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    supplier_cost_per_month = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    margin_per_month = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    margin_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    notes = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return self.quote_number or f"Quote {self.pk}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new and not self.quote_number:
            self.quote_number = f"Q-{self.created_at.year}-{self.pk:04d}"
            super().save(update_fields=["quote_number"])

    def recalculate_totals(self):
        if hasattr(self, "_prefetched_objects_cache"):
            self._prefetched_objects_cache.pop("lines", None)

        subtotal = Decimal("0.00")
        rental_total = Decimal("0.00")
        supplier_cost_total = Decimal("0.00")

        for line in self.lines.all():
            subtotal += line.collection_charge_per_month
            rental_total += line.bin_rental_per_month
            supplier_cost_total += line.supplier_cost_per_month

        self.subtotal_per_month = subtotal.quantize(Decimal("0.01"))
        self.bin_rental_per_month = rental_total.quantize(Decimal("0.01"))
        self.total_per_month = (subtotal + rental_total).quantize(Decimal("0.01"))
        self.supplier_cost_per_month = supplier_cost_total.quantize(Decimal("0.01"))
        self.margin_per_month = (self.total_per_month - self.supplier_cost_per_month).quantize(Decimal("0.01"))
        self.margin_percent = (
            (self.margin_per_month / self.total_per_month) * Decimal("100")
            if self.total_per_month > 0
            else Decimal("0.00")
        ).quantize(Decimal("0.01"))

        self.save(
            update_fields=[
                "subtotal_per_month",
                "bin_rental_per_month",
                "total_per_month",
                "supplier_cost_per_month",
                "margin_per_month",
                "margin_percent",
                "updated_at",
            ]
        )


class QuoteLine(models.Model):
    WASTE_TYPE_CHOICES = [
        ("general", "General Waste"),
        ("mixed_recycling", "Mixed Recycling"),
        ("glass", "Glass"),
        ("food", "Food"),
    ]

    BIN_SIZE_CHOICES = [
        ("240", "240L"),
        ("360", "360L"),
        ("660", "660L"),
        ("1100", "1100L"),
    ]

    quote = models.ForeignKey(
        Quote,
        on_delete=models.CASCADE,
        related_name="lines",
    )

    waste_type = models.CharField(max_length=20, choices=WASTE_TYPE_CHOICES)
    bin_size = models.CharField(max_length=10, choices=BIN_SIZE_CHOICES)

    bin_count = models.PositiveIntegerField(default=1)
    collections_per_week = models.PositiveIntegerField(default=1)

    price_per_lift = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    rental_per_day = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    supplier_price_per_lift = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    supplier_rental_per_day = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    collection_charge_per_month = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    bin_rental_per_month = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    line_total_per_month = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    supplier_cost_per_month = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    margin_per_month = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    margin_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.quote.quote_number} - {self.waste_type} - {self.bin_size}"

    def calculate_collection_charge_per_month(self):
        return (
            Decimal(self.bin_count)
            * Decimal(self.collections_per_week)
            * Decimal("4.33")
            * self.price_per_lift
        ).quantize(Decimal("0.01"))

    def calculate_bin_rental_per_month(self):
        return (
            Decimal(self.bin_count)
            * Decimal("30")
            * self.rental_per_day
        ).quantize(Decimal("0.01"))

    def calculate_supplier_cost_per_month(self):
        collection_cost = (
            Decimal(self.bin_count)
            * Decimal(self.collections_per_week)
            * Decimal("4.33")
            * self.supplier_price_per_lift
        )
        rental_cost = Decimal(self.bin_count) * Decimal("30") * self.supplier_rental_per_day
        return (collection_cost + rental_cost).quantize(Decimal("0.01"))

    def save(self, *args, **kwargs):
        self.collection_charge_per_month = self.calculate_collection_charge_per_month()
        self.bin_rental_per_month = self.calculate_bin_rental_per_month()
        self.line_total_per_month = (
            self.collection_charge_per_month + self.bin_rental_per_month
        ).quantize(Decimal("0.01"))
        self.supplier_cost_per_month = self.calculate_supplier_cost_per_month()
        self.margin_per_month = (self.line_total_per_month - self.supplier_cost_per_month).quantize(Decimal("0.01"))
        self.margin_percent = (
            (self.margin_per_month / self.line_total_per_month) * Decimal("100")
            if self.line_total_per_month > 0
            else Decimal("0.00")
        ).quantize(Decimal("0.01"))

        super().save(*args, **kwargs)
        self.quote.recalculate_totals()

    def delete(self, *args, **kwargs):
        quote = self.quote
        super().delete(*args, **kwargs)
        quote.recalculate_totals()


def quote_document_upload_to(instance, filename):
    safe_quote_number = (instance.quote.quote_number or f"quote-{instance.quote_id}").replace("/", "-")
    return f"quote_pdfs/{safe_quote_number}/v{instance.version_number:03d}.pdf"


class QuoteDocument(models.Model):
    quote = models.ForeignKey(
        Quote,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    file = models.FileField(upload_to=quote_document_upload_to)
    version_number = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    file_size_bytes = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-version_number", "-created_at"]
        unique_together = ("quote", "version_number")

    def __str__(self):
        return f"{self.quote.quote_number} PDF v{self.version_number}"
