from django.contrib import admin

from .models import Quote, QuoteDocument, QuoteLine


class QuoteLineInline(admin.TabularInline):
    model = QuoteLine
    extra = 0


class QuoteDocumentInline(admin.TabularInline):
    model = QuoteDocument
    extra = 0
    readonly_fields = ("version_number", "created_at", "file_size_bytes")


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = (
        "quote_number",
        "title",
        "status",
        "customer",
        "site",
        "total_per_month",
        "valid_until",
        "created_at",
    )
    search_fields = (
        "quote_number",
        "title",
        "customer__business_name",
        "site__site_name",
        "contact_name",
        "email",
    )
    list_filter = ("status", "created_at")
    inlines = [QuoteLineInline, QuoteDocumentInline]


@admin.register(QuoteLine)
class QuoteLineAdmin(admin.ModelAdmin):
    list_display = (
        "quote",
        "waste_type",
        "bin_size",
        "bin_count",
        "collections_per_week",
        "line_total_per_month",
    )
    list_filter = ("waste_type", "bin_size")


@admin.register(QuoteDocument)
class QuoteDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "quote",
        "version_number",
        "created_at",
        "file_size_bytes",
    )
    search_fields = ("quote__quote_number", "quote__title")
    list_filter = ("created_at",)