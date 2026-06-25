from django.contrib import admin

from .models import Container, ContainerBatch, ContainerMaintenanceEvent, ContainerMovement


@admin.register(ContainerBatch)
class ContainerBatchAdmin(admin.ModelAdmin):
    list_display = ("id", "bin_size", "waste_stream", "quantity", "supplier", "delivery_date", "created_at")
    search_fields = ("supplier", "notes")
    list_filter = ("bin_size", "waste_stream", "delivery_date")


@admin.register(Container)
class ContainerAdmin(admin.ModelAdmin):
    list_display = ("container_uid", "bin_size", "waste_stream", "status", "site", "service", "updated_at")
    search_fields = ("container_uid", "notes", "site__site_name", "site__customer__business_name")
    list_filter = ("status", "bin_size", "waste_stream")


@admin.register(ContainerMaintenanceEvent)
class ContainerMaintenanceEventAdmin(admin.ModelAdmin):
    list_display = ("container", "title", "status", "reported_by", "created_at", "resolved_at")
    search_fields = ("container__container_uid", "title", "notes", "reported_by")
    list_filter = ("status", "created_at")


@admin.register(ContainerMovement)
class ContainerMovementAdmin(admin.ModelAdmin):
    list_display = ("movement_type", "status", "scheduled_date", "customer", "site", "container", "billable_to_customer", "billed_at")
    search_fields = ("customer__business_name", "site__site_name", "container__container_uid", "reason", "charge_reason")
    list_filter = ("movement_type", "status", "scheduled_date", "billable_to_customer", "billed_at")
