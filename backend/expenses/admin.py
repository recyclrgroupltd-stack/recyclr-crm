from django.contrib import admin

from .models import ExpenseCategory, ExpenseClaim


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "active", "requires_receipt", "created_at")
    search_fields = ("name",)
    list_filter = ("active", "requires_receipt")


@admin.register(ExpenseClaim)
class ExpenseClaimAdmin(admin.ModelAdmin):
    list_display = ("submitted_by", "category", "expense_type", "amount", "status", "expense_date")
    search_fields = ("submitted_by__username", "merchant", "description")
    list_filter = ("status", "expense_type", "category")
