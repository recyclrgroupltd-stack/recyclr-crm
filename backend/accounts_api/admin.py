from django.contrib import admin

from .models import UserPermissionOverride


@admin.register(UserPermissionOverride)
class UserPermissionOverrideAdmin(admin.ModelAdmin):
    list_display = ("user", "permission_key", "is_allowed", "updated_at")
    list_filter = ("is_allowed", "permission_key")
    search_fields = ("user__username", "permission_key")