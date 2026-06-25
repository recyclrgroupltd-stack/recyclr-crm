from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

from pricing.models import PriceBookItem


class Service(models.Model):
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

    STATUS_PENDING_SCHEDULE = "pending_schedule"
    STATUS_ACTIVE = "active"
    STATUS_PAUSED = "paused"
    STATUS_ENDED = "ended"

    STATUS_CHOICES = [
        (STATUS_PENDING_SCHEDULE, "Pending Schedule"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_PAUSED, "Paused"),
        (STATUS_ENDED, "Ended"),
    ]

    SCHEDULE_TYPE_CHOICES = [
        ("weekly", "Weekly"),
        ("fortnightly", "Fortnightly"),
        ("on_request", "On Request"),
    ]

    COLLECTION_DAY_CHOICES = [
        ("monday", "Monday"),
        ("tuesday", "Tuesday"),
        ("wednesday", "Wednesday"),
        ("thursday", "Thursday"),
        ("friday", "Friday"),
        ("saturday", "Saturday"),
        ("sunday", "Sunday"),
    ]

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.CASCADE,
        related_name="services",
    )

    site = models.ForeignKey(
        "customers.Site",
        on_delete=models.CASCADE,
        related_name="services",
    )

    haulier = models.ForeignKey(
        "hauliers.Haulier",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="services",
    )

    waste_type = models.CharField(max_length=20, choices=WASTE_TYPE_CHOICES)
    bin_size = models.CharField(max_length=10, choices=BIN_SIZE_CHOICES)

    bin_count = models.PositiveIntegerField(default=1)
    collections_per_week = models.PositiveIntegerField(default=1)

    lock_required = models.BooleanField(default=False)
    metal_bin_required = models.BooleanField(default=False)

    price_per_lift = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monthly_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING_SCHEDULE,
    )

    schedule_type = models.CharField(
        max_length=20,
        choices=SCHEDULE_TYPE_CHOICES,
        default="weekly",
    )

    collection_days = models.JSONField(default=list, blank=True)
    schedule_start_date = models.DateField(null=True, blank=True)

    notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-id"]

    def clean(self):
        if self.waste_type in ["food", "glass"] and self.bin_size != "240":
            raise ValidationError(
                "Food and Glass waste streams can only use 240L bins."
            )

        if self.metal_bin_required:
            allowed = (
                self.waste_type in ["general", "mixed_recycling"]
                and self.bin_size in ["660", "1100"]
            )

            if not allowed:
                raise ValidationError(
                    "Metal bins are only available for General Waste or Mixed Recycling in 660L or 1100L sizes."
                )

        valid_days = {choice[0] for choice in self.COLLECTION_DAY_CHOICES}

        if self.collection_days is None:
            self.collection_days = []

        if not isinstance(self.collection_days, list):
            raise ValidationError("Collection days must be a list.")

        normalised_days = []
        for day in self.collection_days:
            day_value = str(day).strip().lower()
            if day_value not in valid_days:
                raise ValidationError(f"'{day}' is not a valid collection day.")
            if day_value not in normalised_days:
                normalised_days.append(day_value)

        self.collection_days = normalised_days

        if self.schedule_type == "on_request":
            self.collection_days = []

        if self.schedule_type in ["weekly", "fortnightly"]:
            max_days = max(int(self.collections_per_week or 0), 0)
            if max_days and len(self.collection_days) > max_days:
                raise ValidationError(
                    f"This service is sold as {max_days}/week, so you can only select {max_days} collection day(s)."
                )

        needs_schedule_details = self.status == self.STATUS_ACTIVE and self.schedule_type in ["weekly", "fortnightly"]

        if needs_schedule_details and not self.collection_days:
            raise ValidationError(
                "At least one collection day is required before an active weekly or fortnightly service can be saved."
            )

        if needs_schedule_details:
            required_days = max(int(self.collections_per_week or 0), 0)
            if required_days and len(self.collection_days) != required_days:
                raise ValidationError(
                    f"This service is sold as {required_days}/week, so an active service must have exactly {required_days} collection day(s) selected."
                )

        if needs_schedule_details and not self.schedule_start_date:
            raise ValidationError(
                "Schedule start date is required before an active weekly or fortnightly service can be saved."
            )

    def get_pricebook_waste_type(self):
        if self.waste_type == "mixed_recycling":
            return "recycling"
        return self.waste_type

    def calculate_price(self):
        price_item = PriceBookItem.objects.filter(
            waste_type=self.get_pricebook_waste_type(),
            bin_size=self.bin_size,
            active=True,
        ).first()

        if not price_item:
            return Decimal("0.00")

        return price_item.price_per_lift

    def calculate_monthly_value(self):
        if not self.bin_count or not self.collections_per_week:
            return Decimal("0.00")

        price = self.calculate_price()

        return (
            Decimal(self.bin_count)
            * price
            * Decimal(self.collections_per_week)
            * Decimal("4.33")
        ).quantize(Decimal("0.01"))

    def get_collection_days_display_list(self):
        lookup = dict(self.COLLECTION_DAY_CHOICES)
        return [lookup.get(day, day.title()) for day in (self.collection_days or [])]

    def save(self, *args, **kwargs):
        self.full_clean()
        self.price_per_lift = self.calculate_price()
        self.monthly_value = self.calculate_monthly_value()

        super().save(*args, **kwargs)

        try:
            from jobs.utils import generate_jobs_for_service

            generate_jobs_for_service(self)
        except Exception:
            pass

        try:
            from containers.models import ensure_collection_movement_for_service, ensure_delivery_movement_for_service

            ensure_delivery_movement_for_service(self)
            ensure_collection_movement_for_service(self)
        except Exception:
            pass

    def __str__(self):
        return f"{self.customer.business_name} - {self.get_waste_type_display()} - {self.get_bin_size_display()}"
