from django.contrib import admin

from .models import (
    Haulier,
    HaulierPortalUser,
    HaulierPortalUserSiteAccess,
    HaulierRate,
)


class HaulierPortalUserSiteAccessInline(admin.TabularInline):
    model = HaulierPortalUserSiteAccess
    extra = 0


@admin.register(Haulier)
class HaulierAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_name", "email", "phone", "active", "created_at")
    search_fields = ("name", "contact_name", "email", "phone")
    list_filter = ("active",)


@admin.register(HaulierPortalUser)
class HaulierPortalUserAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "email",
        "haulier",
        "is_active",
        "can_view_all_sites",
        "must_set_password",
        "last_login_at",
        "created_at",
    )
    search_fields = ("full_name", "email", "haulier__name")
    list_filter = ("is_active", "can_view_all_sites", "must_set_password", "haulier")
    inlines = [HaulierPortalUserSiteAccessInline]


@admin.register(HaulierPortalUserSiteAccess)
class HaulierPortalUserSiteAccessAdmin(admin.ModelAdmin):
    list_display = ("portal_user", "site", "created_at")
    search_fields = (
        "portal_user__full_name",
        "portal_user__email",
        "site__site_name",
        "site__customer__business_name",
    )
    list_filter = ("site__customer",)


@admin.register(HaulierRate)
class HaulierRateAdmin(admin.ModelAdmin):
    list_display = (
        "haulier",
        "waste_type",
        "bin_size",
        "price_per_lift",
        "weight_limit_kg",
        "excess_per_kg",
        "active",
    )
    search_fields = ("haulier__name", "waste_type", "bin_size")
    list_filter = ("active", "waste_type", "bin_size", "haulier")