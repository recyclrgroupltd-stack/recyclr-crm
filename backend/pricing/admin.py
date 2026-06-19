from django.contrib import admin

from .models import PriceBookItem


@admin.register(PriceBookItem)
class PriceBookItemAdmin(admin.ModelAdmin):
    list_display = (
        "waste_type",
        "bin_size",
        "price_per_lift",
        "rental_per_day",
        "active",
    )
    list_filter = ("waste_type", "bin_size", "active")
    search_fields = ("waste_type", "bin_size", "notes")