from django.contrib import admin
from pricing.models import PriceBookItem
from customers.models import Customer, Site
from .models import Service


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = (
        "customer",
        "site",
        "waste_type",
        "bin_size",
        "bin_count",
        "collections_per_week",
        "formatted_price_per_lift",
        "formatted_monthly_value",
        "status",
        "created_at",
    )

    readonly_fields = (
        "price_per_lift",
        "monthly_value",
        "created_at",
    )

    search_fields = (
        "customer__business_name",
        "site__site_name",
    )

    list_filter = (
        "waste_type",
        "bin_size",
        "status",
    )

    fieldsets = (
        ("Service Details", {
            "fields": (
                "customer",
                "site",
                "waste_type",
                "bin_size",
                "bin_count",
                "collections_per_week",
                "lock_required",
                "metal_bin_required",
                "status",
            )
        }),
        ("Calculated Values", {
            "fields": (
                "price_per_lift",
                "monthly_value",
                "created_at",
            )
        }),
    )

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)

        site_queryset = Site.objects.none()

        if obj and obj.customer_id:
            site_queryset = Site.objects.filter(customer=obj.customer).order_by("site_name")
        else:
            customer_id = request.POST.get("customer") or request.GET.get("customer")
            if customer_id:
                try:
                    customer = Customer.objects.get(pk=customer_id)
                    site_queryset = Site.objects.filter(customer=customer).order_by("site_name")
                except Customer.DoesNotExist:
                    site_queryset = Site.objects.none()

        form.base_fields["site"].queryset = site_queryset
        return form

    def formatted_price_per_lift(self, obj):
        return f"£{obj.price_per_lift:,.2f}"

    formatted_price_per_lift.short_description = "Price Per Lift"

    def formatted_monthly_value(self, obj):
        return f"£{obj.monthly_value:,.2f}"

    formatted_monthly_value.short_description = "Monthly Value"

    def render_change_form(self, request, context, *args, **kwargs):
        price_map = {}

        for item in PriceBookItem.objects.filter(active=True):
            key = f"{item.waste_type}|{item.bin_size}"
            price_map[key] = float(item.price_per_lift)

            if item.waste_type == "recycling":
                mixed_key = f"mixed_recycling|{item.bin_size}"
                price_map[mixed_key] = float(item.price_per_lift)

        site_map = {}
        for site in Site.objects.select_related("customer").all().order_by("site_name"):
            customer_id = str(site.customer_id)
            site_map.setdefault(customer_id, []).append({
                "id": site.id,
                "name": str(site),
            })

        context["price_map"] = price_map
        context["site_map"] = site_map
        return super().render_change_form(request, context, *args, **kwargs)

    class Media:
        js = ("services/js/service_admin.js",)