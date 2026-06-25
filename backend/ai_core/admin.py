from django.contrib import admin

from .models import AIInteractionLog


@admin.register(AIInteractionLog)
class AIInteractionLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "provider", "model", "intent", "context_type", "status")
    list_filter = ("provider", "status", "intent", "context_type")
    search_fields = ("prompt", "response", "error_message", "user__username")
    readonly_fields = ("created_at",)
