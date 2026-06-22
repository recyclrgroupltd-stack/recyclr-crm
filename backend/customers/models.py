from django.conf import settings
from django.db import models
from django.utils import timezone


class Customer(models.Model):
    INVOICE_TERMS_CHOICES = [
        (7, "7 days"),
        (14, "14 days"),
        (30, "30 days"),
    ]

    customer_uid = models.CharField(max_length=20, unique=True, blank=True, null=True)
    business_name = models.CharField(max_length=255)
    contact_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    sic_code = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=20, default="active")
    account_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="managed_customers",
        null=True,
        blank=True,
    )
    notes = models.TextField(blank=True)

    address_line_1 = models.CharField(max_length=255, blank=True)
    address_line_2 = models.CharField(max_length=255, blank=True)
    town = models.CharField(max_length=100, blank=True)
    county = models.CharField(max_length=100, blank=True)
    postcode = models.CharField(max_length=20, blank=True)

    invoice_requires_po = models.BooleanField(default=False)
    invoice_payment_terms_days = models.PositiveSmallIntegerField(choices=INVOICE_TERMS_CHOICES, default=30)
    invoice_email = models.EmailField(blank=True)
    invoice_po_number = models.CharField(max_length=100, blank=True)
    auto_invoice_enabled = models.BooleanField(default=True)
    next_invoice_date = models.DateField(null=True, blank=True)
    last_invoiced_at = models.DateTimeField(null=True, blank=True)
    portal_enabled = models.BooleanField(default=False)
    portal_password_hash = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        needs_customer_uid = not self.customer_uid
        super().save(*args, **kwargs)
        if needs_customer_uid:
            self.customer_uid = f"CUST-{self.pk:06d}"
            Customer.objects.filter(pk=self.pk).update(customer_uid=self.customer_uid)

    def __str__(self):
        return self.business_name


class CustomerInvoice(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_PENDING_PO = "pending_po"
    STATUS_READY = "ready"
    STATUS_SENT = "sent"
    STATUS_PAID = "paid"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PENDING_PO, "Pending PO"),
        (STATUS_READY, "Ready to Send"),
        (STATUS_SENT, "Sent"),
        (STATUS_PAID, "Paid"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="invoices")
    invoice_number = models.CharField(max_length=30, unique=True, blank=True)
    issue_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField()
    period_start = models.DateField()
    period_end = models.DateField()
    po_required = models.BooleanField(default=False)
    po_number = models.CharField(max_length=100, blank=True)
    payment_terms_days = models.PositiveSmallIntegerField(default=30)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-issue_date", "-id"]

    def save(self, *args, **kwargs):
        needs_number = not self.invoice_number
        super().save(*args, **kwargs)
        if needs_number:
            self.invoice_number = f"INV-{self.pk:06d}"
            CustomerInvoice.objects.filter(pk=self.pk).update(invoice_number=self.invoice_number)

    def __str__(self):
        return f"{self.invoice_number or 'Invoice'} - {self.customer}"


class CustomerInvoiceLine(models.Model):
    invoice = models.ForeignKey(CustomerInvoice, on_delete=models.CASCADE, related_name="lines")
    service = models.ForeignKey(
        "services.Service",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoice_lines",
    )
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.description


class Site(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="sites")
    site_name = models.CharField(max_length=255)

    address_line_1 = models.CharField(max_length=255, blank=True)
    address_line_2 = models.CharField(max_length=255, blank=True)
    town = models.CharField(max_length=100, blank=True)
    county = models.CharField(max_length=100, blank=True)
    postcode = models.CharField(max_length=20, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.site_name


class CustomerNote(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="note_entries")
    note = models.TextField()
    created_by = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.customer} note by {self.created_by or 'Unknown'}"


class CustomerActivity(models.Model):
    ACTIVITY_TYPE_CHOICES = [
        ("system", "System"),
        ("note", "Note"),
        ("quote", "Quote"),
        ("service", "Service"),
        ("pdf", "PDF"),
        ("email", "Email"),
        ("collection", "Collection"),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="activity_entries")
    site = models.ForeignKey(
        Site,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_entries",
    )

    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPE_CHOICES, default="system")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.CharField(max_length=255, blank=True)

    related_quote_number = models.CharField(max_length=50, blank=True)
    related_service_id = models.PositiveIntegerField(null=True, blank=True)
    related_document_id = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.customer} - {self.activity_type} - {self.title}"


def create_customer_activity(
    *,
    customer,
    activity_type="system",
    title,
    description="",
    created_by="",
    site=None,
    related_quote_number="",
    related_service_id=None,
    related_document_id=None,
):
    return CustomerActivity.objects.create(
        customer=customer,
        site=site,
        activity_type=activity_type,
        title=title,
        description=description or "",
        created_by=created_by or "",
        related_quote_number=related_quote_number or "",
        related_service_id=related_service_id,
        related_document_id=related_document_id,
    )
