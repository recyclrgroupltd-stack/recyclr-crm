from django.contrib import admin

from .models import GeneratedDocument, SignedPackDocument, SigningPack


@admin.register(GeneratedDocument)
class GeneratedDocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "document_type", "customer", "quote", "status", "created_at")
    list_filter = ("document_type", "status", "created_at")
    search_fields = ("title", "customer__business_name", "quote__quote_number")


class SignedPackDocumentInline(admin.TabularInline):
    model = SignedPackDocument
    extra = 0
    readonly_fields = ("title", "file", "created_at")


@admin.register(SigningPack)
class SigningPackAdmin(admin.ModelAdmin):
    list_display = ("quote", "customer", "signer_email", "status", "sent_at", "viewed_at", "signed_at")
    list_filter = ("status", "created_at", "sent_at", "signed_at")
    search_fields = ("quote__quote_number", "customer__business_name", "signer_email", "signed_email")
    filter_horizontal = ("documents",)
    inlines = [SignedPackDocumentInline]
