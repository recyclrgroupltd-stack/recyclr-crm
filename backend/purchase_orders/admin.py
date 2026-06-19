from django.contrib import admin

from .models import PurchaseOrder, PurchaseOrderLine, StaffNotification, Supplier


class PurchaseOrderLineInline(admin.TabularInline):
    model = PurchaseOrderLine
    extra = 1


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_name", "email", "phone", "active", "created_at")
    search_fields = ("name", "contact_name", "email", "phone")
    list_filter = ("active",)


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = (
        "po_number",
        "supplier",
        "order_date",
        "requested_by",
        "status",
        "approved_by",
        "approved_at",
        "received_by",
        "received_at",
        "created_at",
    )
    search_fields = (
        "po_number",
        "supplier__name",
        "requested_by",
        "notes",
        "approval_note",
        "supplier_reference",
        "received_note",
    )
    list_filter = ("status", "supplier", "order_date")
    inlines = [PurchaseOrderLineInline]


@admin.register(StaffNotification)
class StaffNotificationAdmin(admin.ModelAdmin):
    list_display = ("recipient", "notification_type", "title", "is_read", "created_at")
    search_fields = ("recipient__username", "title", "message")
    list_filter = ("notification_type", "is_read", "created_at")