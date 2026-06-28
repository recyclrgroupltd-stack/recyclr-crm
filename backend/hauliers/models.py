from datetime import timedelta
from decimal import Decimal, InvalidOperation
import uuid

from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone


def _to_decimal(value):
    if value in (None, ""):
        return Decimal("0.00")

    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")


class Haulier(models.Model):
    name = models.CharField(max_length=255, unique=True)
    contact_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    emergency_phone = models.CharField(max_length=50, blank=True)
    website = models.URLField(blank=True)
    address = models.TextField(blank=True)
    account_reference = models.CharField(max_length=100, blank=True)
    payment_terms_days = models.PositiveSmallIntegerField(default=30)
    waste_carrier_license = models.CharField(max_length=120, blank=True)
    environmental_permit = models.CharField(max_length=120, blank=True)
    insurance_expiry = models.DateField(null=True, blank=True)
    sla_notes = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class HaulierCoverage(models.Model):
    WASTE_TYPE_CHOICES = [
        ("general", "General Waste"),
        ("mixed_recycling", "Mixed Recycling"),
        ("cardboard", "Cardboard"),
        ("glass", "Glass"),
        ("food", "Food"),
        ("paper", "Paper"),
    ]

    SERVICE_TYPE_CHOICES = [
        ("scheduled", "Scheduled"),
        ("adhoc", "Ad hoc"),
        ("both", "Scheduled and ad hoc"),
    ]

    haulier = models.ForeignKey(
        Haulier,
        on_delete=models.CASCADE,
        related_name="coverage_entries",
    )
    waste_type = models.CharField(max_length=30, choices=WASTE_TYPE_CHOICES)
    postcode_area = models.CharField(max_length=80)
    collection_days = models.JSONField(default=list, blank=True)
    service_type = models.CharField(max_length=20, choices=SERVICE_TYPE_CHOICES, default="scheduled")
    lead_time_days = models.PositiveSmallIntegerField(default=2)
    minimum_lift_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fuel_surcharge_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    requires_po = models.BooleanField(default=False)
    booking_cutoff = models.CharField(max_length=80, blank=True)
    vehicle_notes = models.TextField(blank=True)
    restrictions = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["haulier__name", "postcode_area", "waste_type"]
        indexes = [
            models.Index(fields=["waste_type", "postcode_area"]),
            models.Index(fields=["haulier", "active"]),
        ]

    def __str__(self):
        return f"{self.haulier.name} - {self.get_waste_type_display()} - {self.postcode_area}"


class HaulierPortalUser(models.Model):
    haulier = models.ForeignKey(
        Haulier,
        on_delete=models.CASCADE,
        related_name="portal_users",
    )
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)

    password = models.CharField(max_length=255, blank=True)
    must_set_password = models.BooleanField(default=True)

    is_active = models.BooleanField(default=True)
    can_view_all_sites = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    password_reset_token = models.UUIDField(null=True, blank=True)
    password_reset_expires = models.DateTimeField(null=True, blank=True)

    last_login_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["haulier__name", "full_name", "email"]

    def __str__(self):
        return f"{self.full_name} ({self.haulier.name})"

    def set_password(self, raw_password: str):
        self.password = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        if not self.password:
            return False
        return check_password(raw_password, self.password)

    def create_password_token(self, hours: int = 24):
        self.password_reset_token = uuid.uuid4()
        self.password_reset_expires = timezone.now() + timedelta(hours=hours)
        self.save(update_fields=["password_reset_token", "password_reset_expires"])

    def token_valid(self, token) -> bool:
        if not self.password_reset_token or not self.password_reset_expires:
            return False

        return (
            str(self.password_reset_token) == str(token)
            and timezone.now() < self.password_reset_expires
        )


class HaulierPortalUserSiteAccess(models.Model):
    portal_user = models.ForeignKey(
        HaulierPortalUser,
        on_delete=models.CASCADE,
        related_name="site_access_entries",
    )
    site = models.ForeignKey(
        "customers.Site",
        on_delete=models.CASCADE,
        related_name="haulier_portal_access_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["site__site_name", "id"]
        unique_together = ("portal_user", "site")

    def __str__(self):
        return f"{self.portal_user.full_name} -> {self.site.site_name}"


class HaulierRate(models.Model):
    WASTE_TYPE_CHOICES = [
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

    haulier = models.ForeignKey(
        Haulier,
        on_delete=models.CASCADE,
        related_name="rates",
    )

    waste_type = models.CharField(max_length=20, choices=WASTE_TYPE_CHOICES)
    bin_size = models.CharField(max_length=10, choices=BIN_SIZE_CHOICES)

    price_per_lift = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    weight_limit_kg = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    excess_per_kg = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["haulier__name", "waste_type", "bin_size", "-id"]
        unique_together = ("haulier", "waste_type", "bin_size")

    def __str__(self):
        return f"{self.haulier.name} - {self.get_waste_type_display()} - {self.get_bin_size_display()}"

    def calculate_monthly_cost(self, bin_count=1, collections_per_week=1):
        safe_bin_count = _to_decimal(bin_count)
        safe_collections_per_week = _to_decimal(collections_per_week)
        safe_price_per_lift = _to_decimal(self.price_per_lift)

        return (
            safe_bin_count * safe_collections_per_week * Decimal("4.33") * safe_price_per_lift
        ).quantize(Decimal("0.01"))
