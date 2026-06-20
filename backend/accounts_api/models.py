from django.conf import settings
from django.db import models
from django.utils import timezone


class UserPermissionOverride(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="permission_overrides",
    )
    permission_key = models.CharField(max_length=100)
    is_allowed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "permission_key")
        ordering = ["permission_key"]

    def __str__(self):
        state = "allow" if self.is_allowed else "deny"
        return f"{self.user.username} - {self.permission_key} ({state})"


class StaffSession(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_sessions",
    )
    token = models.CharField(max_length=128, unique=True)
    device_name = models.CharField(max_length=200, blank=True)
    user_agent = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    replaced_by_device_name = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_seen_at"]

    def __str__(self):
        state = "active" if self.is_active else "ended"
        return f"{self.user.username} on {self.device_name or 'Unknown device'} ({state})"


class StaffProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_profile",
    )
    company_email = models.EmailField(blank=True)
    company_phone = models.CharField(max_length=50, blank=True)
    job_title = models.CharField(max_length=150, blank=True)
    auto_assign_customers = models.BooleanField(default=True)
    mailbox_enabled = models.BooleanField(default=False)
    mailbox_password = models.CharField(max_length=255, blank=True)
    about_me = models.TextField(blank=True)
    photo_data = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__username"]

    def __str__(self):
        return f"{self.user.username} profile"


class CompanyDetails(models.Model):
    singleton_key = models.PositiveSmallIntegerField(default=1, unique=True, editable=False)

    company_name = models.CharField(max_length=200, default="Recyclr Group Ltd")
    company_number = models.CharField(max_length=100, blank=True)

    registered_address_line_1 = models.CharField(max_length=255, blank=True)
    registered_address_line_2 = models.CharField(max_length=255, blank=True)
    registered_town = models.CharField(max_length=150, blank=True)
    registered_county = models.CharField(max_length=150, blank=True)
    registered_postcode = models.CharField(max_length=30, blank=True)
    registered_country = models.CharField(max_length=100, blank=True, default="England")

    trading_address_line_1 = models.CharField(max_length=255, blank=True)
    trading_address_line_2 = models.CharField(max_length=255, blank=True)
    trading_town = models.CharField(max_length=150, blank=True)
    trading_county = models.CharField(max_length=150, blank=True)
    trading_postcode = models.CharField(max_length=30, blank=True)
    trading_country = models.CharField(max_length=100, blank=True, default="England")

    website = models.CharField(max_length=255, blank=True)
    main_email = models.EmailField(blank=True)
    legal_documents_email = models.EmailField(blank=True)
    phone_number = models.CharField(max_length=50, blank=True)
    waste_broker_registration = models.CharField(max_length=150, blank=True)

    legal_signatory_name = models.CharField(max_length=150, blank=True)
    legal_signatory_title = models.CharField(max_length=150, blank=True)
    legal_signature_data = models.TextField(blank=True)

    company_logo_data = models.TextField(blank=True)
    company_email_domain = models.CharField(max_length=150, blank=True, default="recyclrgroup.co.uk")
    default_quote_validity_days = models.PositiveIntegerField(default=14)
    signing_pack_expiry_days = models.PositiveIntegerField(default=30)
    default_target_margin_percent = models.DecimalField(max_digits=6, decimal_places=2, default=30)
    sales_offer_margin_1_percent = models.DecimalField(max_digits=6, decimal_places=2, default=35)
    sales_offer_margin_2_percent = models.DecimalField(max_digits=6, decimal_places=2, default=30)
    sales_offer_margin_3_percent = models.DecimalField(max_digits=6, decimal_places=2, default=25)
    mileage_rate = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=20)
    container_qr_label_width_mm = models.DecimalField(max_digits=6, decimal_places=2, default=50)
    container_qr_label_height_mm = models.DecimalField(max_digits=6, decimal_places=2, default=50)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Company Details"
        verbose_name_plural = "Company Details"

    def save(self, *args, **kwargs):
        self.singleton_key = 1

        if not self.trading_address_line_1:
            self.trading_address_line_1 = self.registered_address_line_1
        if not self.trading_address_line_2:
            self.trading_address_line_2 = self.registered_address_line_2
        if not self.trading_town:
            self.trading_town = self.registered_town
        if not self.trading_county:
            self.trading_county = self.registered_county
        if not self.trading_postcode:
            self.trading_postcode = self.registered_postcode
        if not self.trading_country:
            self.trading_country = self.registered_country or "England"

        super().save(*args, **kwargs)

    def __str__(self):
        return self.company_name or "Company Details"

    @property
    def registered_office(self):
        return "\n".join(
            [
                part
                for part in [
                    self.registered_address_line_1,
                    self.registered_address_line_2,
                    self.registered_town,
                    self.registered_county,
                    self.registered_postcode,
                    self.registered_country,
                ]
                if part
            ]
        )

    @property
    def trading_address(self):
        return "\n".join(
            [
                part
                for part in [
                    self.trading_address_line_1,
                    self.trading_address_line_2,
                    self.trading_town,
                    self.trading_county,
                    self.trading_postcode,
                    self.trading_country,
                ]
                if part
            ]
        )

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(
            singleton_key=1,
            defaults={
                "company_name": "Recyclr Group Ltd",
                "main_email": "info@recyclrgroup.co.uk",
                "legal_documents_email": "info@recyclrgroup.co.uk",
                "phone_number": "07365 997093",
                "website": "www.recyclrgroup.co.uk",
                "company_email_domain": "recyclrgroup.co.uk",
                "legal_signatory_name": "Jamie Gallagher",
                "registered_country": "England",
                "trading_country": "England",
            },
        )
        return obj
