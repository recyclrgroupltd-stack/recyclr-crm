from django.contrib import admin

from .models import Customer, CustomerInvoice, CustomerInvoiceLine, CustomerNote, Site


class CustomerInvoiceLineInline(admin.TabularInline):
    model = CustomerInvoiceLine
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customer_uid",
        "business_name",
        "contact_name",
        "email",
        "phone",
        "town",
        "county",
        "postcode",
        "status",
        "invoice_requires_po",
        "invoice_payment_terms_days",
        "auto_invoice_enabled",
        "next_invoice_date",
        "created_at",
    )
    list_filter = (
        "town",
        "county",
        "status",
        "invoice_requires_po",
        "invoice_payment_terms_days",
        "auto_invoice_enabled",
        "created_at",
    )
    search_fields = (
        "customer_uid",
        "business_name",
        "contact_name",
        "email",
        "phone",
        "town",
        "county",
        "postcode",
    )
    readonly_fields = (
        "customer_uid",
        "created_at",
        "updated_at",
    )


@admin.register(CustomerInvoice)
class CustomerInvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_number",
        "customer",
        "issue_date",
        "due_date",
        "payment_terms_days",
        "po_required",
        "po_number",
        "subtotal",
        "vat_amount",
        "total",
        "status",
    )
    list_filter = (
        "status",
        "po_required",
        "payment_terms_days",
        "issue_date",
        "due_date",
    )
    search_fields = (
        "invoice_number",
        "customer__business_name",
        "customer__customer_uid",
        "po_number",
    )
    readonly_fields = ("invoice_number", "created_at", "updated_at", "sent_at")
    inlines = (CustomerInvoiceLineInline,)


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "site_name",
        "customer",
        "town",
        "county",
        "postcode",
        "created_at",
    )
    list_filter = (
        "town",
        "county",
        "created_at",
    )
    search_fields = (
        "site_name",
        "customer__business_name",
        "address_line_1",
        "address_line_2",
        "town",
        "county",
        "postcode",
    )
    readonly_fields = (
        "created_at",
    )


@admin.register(CustomerNote)
class CustomerNoteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customer",
        "created_by",
        "created_at",
    )
    list_filter = (
        "created_at",
        "created_by",
    )
    search_fields = (
        "customer__business_name",
        "created_by",
        "note",
    )
    readonly_fields = (
        "created_at",
    )
