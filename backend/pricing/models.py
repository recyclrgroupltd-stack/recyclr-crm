from decimal import Decimal

from django.db import models


class PriceBookItem(models.Model):
    WASTE_TYPE_CHOICES = [
        ("general", "General Waste"),
        ("recycling", "Dry Mixed Recycling"),
        ("glass", "Glass"),
        ("food", "Food"),
    ]

    BIN_SIZE_CHOICES = [
        ("240", "240L"),
        ("360", "360L"),
        ("660", "660L"),
        ("1100", "1100L"),
    ]

    waste_type = models.CharField(max_length=20, choices=WASTE_TYPE_CHOICES)
    bin_size = models.CharField(max_length=10, choices=BIN_SIZE_CHOICES)
    price_per_lift = models.DecimalField(max_digits=10, decimal_places=2)
    rental_per_day = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.25"),
    )
    supplier_price_per_lift = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    supplier_rental_per_day = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    delivery_charge = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    minimum_monthly_charge = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    target_margin_percent = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("30.00"))
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["waste_type", "bin_size"]
        unique_together = ("waste_type", "bin_size")

    def __str__(self):
        return f"{self.get_waste_type_display()} - {self.get_bin_size_display()}"

    def monthly_customer_total(self, bin_count=1, collections_per_week=1):
        collection = Decimal(bin_count) * Decimal(collections_per_week) * Decimal("4.33") * self.price_per_lift
        rental = Decimal(bin_count) * Decimal("30") * self.rental_per_day
        total = collection + rental
        if self.minimum_monthly_charge and total < self.minimum_monthly_charge:
            total = self.minimum_monthly_charge
        return total.quantize(Decimal("0.01"))

    def monthly_supplier_cost(self, bin_count=1, collections_per_week=1):
        collection = Decimal(bin_count) * Decimal(collections_per_week) * Decimal("4.33") * self.supplier_price_per_lift
        rental = Decimal(bin_count) * Decimal("30") * self.supplier_rental_per_day
        return (collection + rental).quantize(Decimal("0.01"))

    def monthly_margin(self, bin_count=1, collections_per_week=1):
        return (
            self.monthly_customer_total(bin_count, collections_per_week)
            - self.monthly_supplier_cost(bin_count, collections_per_week)
        ).quantize(Decimal("0.01"))

    def monthly_margin_percent(self, bin_count=1, collections_per_week=1):
        revenue = self.monthly_customer_total(bin_count, collections_per_week)
        if revenue <= 0:
            return Decimal("0.00")
        return ((self.monthly_margin(bin_count, collections_per_week) / revenue) * Decimal("100")).quantize(Decimal("0.01"))
