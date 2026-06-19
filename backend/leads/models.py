from decimal import Decimal

from django.conf import settings
from django.db import models

from pricing.models import PriceBookItem


class Lead(models.Model):
    STATUS_CHOICES = [
        ("new", "New"),
        ("contacted", "Contacted"),
        ("quote_sent", "Quote Sent"),
        ("won", "Won"),
        ("lost", "Lost"),
    ]

    SOURCE_CHOICES = [
        ("door", "Door Knock"),
        ("website", "Website"),
        ("referral", "Referral"),
        ("phone", "Phone"),
        ("other", "Other"),
    ]

    BIN_COUNT_CHOICES = [(i, str(i)) for i in range(0, 51)]
    COLLECTION_CHOICES = [(i, str(i)) for i in range(0, 51)]

    GENERAL_RECYCLING_BIN_SIZE_CHOICES = [
        ("240", "240L"),
        ("360", "360L"),
        ("660", "660L"),
        ("1100", "1100L"),
    ]

    GLASS_FOOD_BIN_SIZE_CHOICES = [
        ("240", "240L"),
    ]

    company_name = models.CharField(max_length=255)
    who_spoke_to = models.CharField(max_length=255, blank=True)
    contact_name = models.CharField(max_length=255, blank=True)

    phone = models.CharField(max_length=50, blank=True)
    secondary_phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    sic_code = models.CharField(max_length=20, blank=True)

    # OLD combined address fields kept temporarily for compatibility
    address = models.TextField(blank=True)
    postcode = models.CharField(max_length=20, blank=True)

    # NEW structured address fields
    address_line_1 = models.CharField(max_length=255, blank=True)
    address_line_2 = models.CharField(max_length=255, blank=True)
    town = models.CharField(max_length=100, blank=True)
    county = models.CharField(max_length=100, blank=True)

    lead_source = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES,
        default="other",
    )
    lead_source_other = models.CharField(max_length=255, blank=True)

    # General Waste
    general_waste_required = models.BooleanField(default=False)
    general_waste_bin_count = models.PositiveIntegerField(choices=BIN_COUNT_CHOICES, null=True, blank=True)
    general_waste_bin_size = models.CharField(max_length=10, choices=GENERAL_RECYCLING_BIN_SIZE_CHOICES, blank=True)
    general_waste_collections_per_week = models.PositiveIntegerField(choices=COLLECTION_CHOICES, null=True, blank=True)
    general_waste_lock_required = models.BooleanField(default=False)
    general_waste_metal_bin_required = models.BooleanField(default=False)
    general_waste_current_provider = models.CharField(max_length=255, blank=True)
    general_waste_current_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    general_waste_contract_end_date = models.DateField(null=True, blank=True)
    general_waste_is_broker = models.BooleanField(default=False)

    # Dry Mixed Recycling
    recycling_required = models.BooleanField(default=False)
    recycling_bin_count = models.PositiveIntegerField(choices=BIN_COUNT_CHOICES, null=True, blank=True)
    recycling_bin_size = models.CharField(max_length=10, choices=GENERAL_RECYCLING_BIN_SIZE_CHOICES, blank=True)
    recycling_collections_per_week = models.PositiveIntegerField(choices=COLLECTION_CHOICES, null=True, blank=True)
    recycling_lock_required = models.BooleanField(default=False)
    recycling_metal_bin_required = models.BooleanField(default=False)
    recycling_current_provider = models.CharField(max_length=255, blank=True)
    recycling_current_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    recycling_contract_end_date = models.DateField(null=True, blank=True)
    recycling_is_broker = models.BooleanField(default=False)

    # Glass
    glass_required = models.BooleanField(default=False)
    glass_bin_count = models.PositiveIntegerField(choices=BIN_COUNT_CHOICES, null=True, blank=True)
    glass_bin_size = models.CharField(max_length=10, choices=GLASS_FOOD_BIN_SIZE_CHOICES, blank=True, default="240")
    glass_collections_per_week = models.PositiveIntegerField(choices=COLLECTION_CHOICES, null=True, blank=True)
    glass_lock_required = models.BooleanField(default=False)
    glass_metal_bin_required = models.BooleanField(default=False)
    glass_current_provider = models.CharField(max_length=255, blank=True)
    glass_current_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    glass_contract_end_date = models.DateField(null=True, blank=True)
    glass_is_broker = models.BooleanField(default=False)

    # Food
    food_required = models.BooleanField(default=False)
    food_bin_count = models.PositiveIntegerField(choices=BIN_COUNT_CHOICES, null=True, blank=True)
    food_bin_size = models.CharField(max_length=10, choices=GLASS_FOOD_BIN_SIZE_CHOICES, blank=True, default="240")
    food_collections_per_week = models.PositiveIntegerField(choices=COLLECTION_CHOICES, null=True, blank=True)
    food_lock_required = models.BooleanField(default=False)
    food_metal_bin_required = models.BooleanField(default=False)
    food_current_provider = models.CharField(max_length=255, blank=True)
    food_current_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    food_contract_end_date = models.DateField(null=True, blank=True)
    food_is_broker = models.BooleanField(default=False)

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    follow_up_date = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="new",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_leads",
    )

    converted_customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_leads",
    )

    def __str__(self):
        return self.company_name

    def get_stream_monthly_value(self, waste_type, required, bin_count, bin_size, collections_per_week):
        if not required:
            return Decimal("0.00")
        if not bin_count or not bin_size or not collections_per_week:
            return Decimal("0.00")

        price_item = PriceBookItem.objects.filter(
            waste_type=waste_type,
            bin_size=bin_size,
            active=True,
        ).first()

        if not price_item:
            return Decimal("0.00")

        return (
            Decimal(bin_count)
            * price_item.price_per_lift
            * Decimal(collections_per_week)
            * Decimal("4.33")
        )

    @property
    def calculated_monthly_value(self):
        total = Decimal("0.00")

        total += self.get_stream_monthly_value(
            "general",
            self.general_waste_required,
            self.general_waste_bin_count,
            self.general_waste_bin_size,
            self.general_waste_collections_per_week,
        )

        total += self.get_stream_monthly_value(
            "recycling",
            self.recycling_required,
            self.recycling_bin_count,
            self.recycling_bin_size,
            self.recycling_collections_per_week,
        )

        total += self.get_stream_monthly_value(
            "glass",
            self.glass_required,
            self.glass_bin_count,
            self.glass_bin_size,
            self.glass_collections_per_week,
        )

        total += self.get_stream_monthly_value(
            "food",
            self.food_required,
            self.food_bin_count,
            self.food_bin_size,
            self.food_collections_per_week,
        )

        if self.pk:
            for requirement in self.extra_waste_requirements.all():
                total += self.get_stream_monthly_value(
                    requirement.waste_type,
                    True,
                    requirement.bin_count,
                    requirement.bin_size,
                    requirement.collections_per_week,
                )

        return total.quantize(Decimal("0.01"))

    @property
    def formatted_address(self):
        parts = [
            self.address_line_1,
            self.address_line_2,
            self.town,
            self.county,
            self.postcode,
        ]
        return ", ".join([part for part in parts if part])


class LeadWasteRequirement(models.Model):
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

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="extra_waste_requirements")
    waste_type = models.CharField(max_length=20, choices=WASTE_TYPE_CHOICES)
    bin_count = models.PositiveIntegerField(default=1)
    bin_size = models.CharField(max_length=10, choices=BIN_SIZE_CHOICES)
    collections_per_week = models.PositiveIntegerField(default=1)
    lock_required = models.BooleanField(default=False)
    metal_bin_required = models.BooleanField(default=False)
    current_provider = models.CharField(max_length=255, blank=True)
    current_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.lead.company_name} - {self.get_waste_type_display()} {self.bin_size}L"
