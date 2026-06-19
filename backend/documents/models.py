from django.db import models
from django.utils import timezone
import secrets


class GeneratedDocument(models.Model):
    DOCUMENT_TYPE_CHOICES = [
        ("service_agreement", "Service Agreement"),
        ("service_schedule", "Service Schedule"),
        ("duty_of_care", "Duty of Care / Waste Transfer Note"),
    ]

    STATUS_CHOICES = [
        ("generated", "Generated"),
        ("sent", "Sent"),
        ("signed", "Signed"),
    ]

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.CASCADE,
        related_name="generated_documents",
    )
    site = models.ForeignKey(
        "customers.Site",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_documents",
    )
    quote = models.ForeignKey(
        "quotes.Quote",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_documents",
    )

    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to="generated_documents/")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="generated")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def filename(self):
        return self.file.name.split("/")[-1] if self.file else ""

    def __str__(self):
        customer_name = getattr(self.customer, "business_name", None) or str(self.customer)
        return f"{customer_name} - {self.get_document_type_display()}"


def signing_signature_upload_to(instance, filename):
    return f"signing_packs/{instance.token}/signature/{filename}"


def signed_document_upload_to(instance, filename):
    return f"signing_packs/{instance.pack.token}/signed/{filename}"


class SigningPack(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("ready", "Ready to Send"),
        ("sent", "Sent"),
        ("viewed", "Viewed"),
        ("part_signed", "Part Signed"),
        ("signed", "Signed"),
        ("expired", "Expired"),
        ("cancelled", "Cancelled"),
    ]

    quote = models.ForeignKey(
        "quotes.Quote",
        on_delete=models.CASCADE,
        related_name="signing_packs",
    )
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.CASCADE,
        related_name="signing_packs",
    )
    site = models.ForeignKey(
        "customers.Site",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="signing_packs",
    )
    documents = models.ManyToManyField(GeneratedDocument, related_name="signing_packs", blank=True)

    token = models.CharField(max_length=80, unique=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    signer_name = models.CharField(max_length=255, blank=True)
    signer_email = models.EmailField(blank=True)
    message = models.TextField(blank=True)

    acceptance_terms = models.BooleanField(default=False)
    acceptance_authority = models.BooleanField(default=False)
    acceptance_documents = models.BooleanField(default=False)

    sent_at = models.DateTimeField(null=True, blank=True)
    viewed_at = models.DateTimeField(null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    signed_name = models.CharField(max_length=255, blank=True)
    signed_email = models.EmailField(blank=True)
    signed_ip_address = models.GenericIPAddressField(null=True, blank=True)
    signed_user_agent = models.TextField(blank=True)
    viewed_ip_address = models.GenericIPAddressField(null=True, blank=True)
    viewed_user_agent = models.TextField(blank=True)
    signature_image = models.ImageField(upload_to=signing_signature_upload_to, null=True, blank=True)
    audit_summary = models.JSONField(default=dict, blank=True)

    created_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_signing_packs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        if not self.expires_at:
            try:
                from accounts_api.models import CompanyDetails

                expiry_days = int(CompanyDetails.get_solo().signing_pack_expiry_days or 30)
            except Exception:
                expiry_days = 30
            self.expires_at = timezone.now() + timezone.timedelta(days=max(1, expiry_days))
        super().save(*args, **kwargs)

    def is_expired(self):
        return bool(self.expires_at and timezone.now() > self.expires_at)

    def __str__(self):
        return f"{self.quote.quote_number} signing pack for {self.customer}"


class SignedPackDocument(models.Model):
    pack = models.ForeignKey(SigningPack, on_delete=models.CASCADE, related_name="signed_documents")
    source_document = models.ForeignKey(
        GeneratedDocument,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="signed_pack_copies",
    )
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to=signed_document_upload_to)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title", "id"]

    def filename(self):
        return self.file.name.split("/")[-1] if self.file else ""

    def __str__(self):
        return f"Signed {self.title} - {self.pack_id}"
