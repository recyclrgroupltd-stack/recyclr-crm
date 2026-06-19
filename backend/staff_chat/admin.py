from django.contrib import admin

from .models import StaffConversation, StaffConversationParticipant, StaffMessage


class StaffConversationParticipantInline(admin.TabularInline):
    model = StaffConversationParticipant
    extra = 0


class StaffMessageInline(admin.TabularInline):
    model = StaffMessage
    extra = 0
    readonly_fields = ("sender", "body", "created_at")


@admin.register(StaffConversation)
class StaffConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "is_group", "is_everyone", "is_pinned", "created_by", "updated_at")
    list_filter = ("is_group", "is_everyone", "is_pinned")
    search_fields = ("title", "conversation_participants__user__username")
    inlines = [StaffConversationParticipantInline, StaffMessageInline]


@admin.register(StaffMessage)
class StaffMessageAdmin(admin.ModelAdmin):
    list_display = ("conversation", "sender", "created_at")
    search_fields = ("body", "sender__username")
    filter_horizontal = ("mentions",)
