from django.contrib import admin

from .models import Asset, AssetEvent


class AssetEventInline(admin.TabularInline):
    model = AssetEvent
    extra = 0
    readonly_fields = ["created_at"]


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ["asset_uid", "name", "category", "status", "location", "assigned_to"]
    list_filter = ["category", "status"]
    search_fields = ["asset_uid", "name", "serial_number", "location", "supplier"]
    inlines = [AssetEventInline]


@admin.register(AssetEvent)
class AssetEventAdmin(admin.ModelAdmin):
    list_display = ["asset", "title", "created_by", "created_at"]
    search_fields = ["asset__asset_uid", "asset__name", "title", "notes"]
