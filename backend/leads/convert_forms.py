from django import forms


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


class LeadConvertForm(forms.Form):
    business_name = forms.CharField(max_length=255, label="Business name")
    trading_name = forms.CharField(max_length=255, required=False, label="Trading name")
    company_number = forms.CharField(max_length=50, required=False, label="Company number")
    vat_number = forms.CharField(max_length=50, required=False, label="VAT number")

    billing_address = forms.CharField(
        widget=forms.Textarea,
        required=False,
        label="Legacy billing address",
    )
    billing_address_line_1 = forms.CharField(
        max_length=255,
        required=False,
        label="Billing address line 1",
    )
    billing_address_line_2 = forms.CharField(
        max_length=255,
        required=False,
        label="Billing address line 2",
    )
    billing_town = forms.CharField(
        max_length=100,
        required=False,
        label="Billing town",
    )
    billing_county = forms.CharField(
        max_length=100,
        required=False,
        label="Billing county",
    )
    billing_postcode = forms.CharField(
        max_length=20,
        required=False,
        label="Billing postcode",
    )

    primary_contact_name = forms.CharField(max_length=255, required=False, label="Primary contact name")
    phone = forms.CharField(max_length=50, required=False, label="Phone")
    secondary_contact_name = forms.CharField(max_length=255, required=False, label="Secondary contact name")
    secondary_phone = forms.CharField(max_length=50, required=False, label="Secondary phone")
    email = forms.EmailField(required=False, label="Email")

    site_name = forms.CharField(max_length=255, label="Site name")
    site_address = forms.CharField(
        widget=forms.Textarea,
        required=False,
        label="Legacy site address",
    )
    site_address_line_1 = forms.CharField(
        max_length=255,
        required=False,
        label="Site address line 1",
    )
    site_address_line_2 = forms.CharField(
        max_length=255,
        required=False,
        label="Site address line 2",
    )
    site_town = forms.CharField(
        max_length=100,
        required=False,
        label="Site town",
    )
    site_county = forms.CharField(
        max_length=100,
        required=False,
        label="Site county",
    )
    site_postcode = forms.CharField(max_length=20, required=False, label="Site postcode")
    site_primary_contact_name = forms.CharField(max_length=255, required=False, label="Site primary contact name")
    site_phone = forms.CharField(max_length=50, required=False, label="Site phone")
    site_secondary_contact_name = forms.CharField(max_length=255, required=False, label="Site secondary contact name")
    site_secondary_phone = forms.CharField(max_length=50, required=False, label="Site secondary phone")
    site_email = forms.EmailField(required=False, label="Site email")

    general_waste_required = forms.BooleanField(required=False, label="Required")
    general_waste_bin_count = forms.ChoiceField(choices=BIN_COUNT_CHOICES, required=False, label="Bin count")
    general_waste_bin_size = forms.ChoiceField(choices=GENERAL_RECYCLING_BIN_SIZE_CHOICES, required=False, label="Bin size")
    general_waste_collections_per_week = forms.ChoiceField(choices=COLLECTION_CHOICES, required=False, label="Collections per week")
    general_waste_lock_required = forms.BooleanField(required=False, label="Lock required")
    general_waste_metal_bin_required = forms.BooleanField(required=False, label="Metal bin required")

    recycling_required = forms.BooleanField(required=False, label="Required")
    recycling_bin_count = forms.ChoiceField(choices=BIN_COUNT_CHOICES, required=False, label="Bin count")
    recycling_bin_size = forms.ChoiceField(choices=GENERAL_RECYCLING_BIN_SIZE_CHOICES, required=False, label="Bin size")
    recycling_collections_per_week = forms.ChoiceField(choices=COLLECTION_CHOICES, required=False, label="Collections per week")
    recycling_lock_required = forms.BooleanField(required=False, label="Lock required")
    recycling_metal_bin_required = forms.BooleanField(required=False, label="Metal bin required")

    glass_required = forms.BooleanField(required=False, label="Required")
    glass_bin_count = forms.ChoiceField(choices=BIN_COUNT_CHOICES, required=False, label="Bin count")
    glass_bin_size = forms.ChoiceField(choices=GLASS_FOOD_BIN_SIZE_CHOICES, required=False, label="Bin size", initial="240")
    glass_collections_per_week = forms.ChoiceField(choices=COLLECTION_CHOICES, required=False, label="Collections per week")
    glass_lock_required = forms.BooleanField(required=False, label="Lock required")
    glass_metal_bin_required = forms.BooleanField(required=False, label="Metal bin required")

    food_required = forms.BooleanField(required=False, label="Required")
    food_bin_count = forms.ChoiceField(choices=BIN_COUNT_CHOICES, required=False, label="Bin count")
    food_bin_size = forms.ChoiceField(choices=GLASS_FOOD_BIN_SIZE_CHOICES, required=False, label="Bin size", initial="240")
    food_collections_per_week = forms.ChoiceField(choices=COLLECTION_CHOICES, required=False, label="Collections per week")
    food_lock_required = forms.BooleanField(required=False, label="Lock required")
    food_metal_bin_required = forms.BooleanField(required=False, label="Metal bin required")

    notes = forms.CharField(widget=forms.Textarea, required=False, label="Notes")