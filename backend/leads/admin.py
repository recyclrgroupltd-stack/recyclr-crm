from django.contrib import admin, messages
from django.shortcuts import get_object_or_404, render, redirect
from django.urls import path, reverse
from django.utils.html import format_html

from customers.models import Customer, Site
from .convert_forms import LeadConvertForm
from .forms import LeadAdminForm
from .models import Lead


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    form = LeadAdminForm

    list_display = (
        "company_name",
        "who_spoke_to",
        "contact_name",
        "phone",
        "secondary_phone",
        "email",
        "lead_source",
        "status",
        "formatted_calculated_monthly_value",
        "follow_up_date",
        "created_by",
        "created_at",
    )

    search_fields = (
        "company_name",
        "who_spoke_to",
        "contact_name",
        "phone",
        "secondary_phone",
        "email",
        "postcode",
        "town",
        "county",
        "address_line_1",
    )

    list_filter = (
        "status",
        "lead_source",
        "created_at",
        "follow_up_date",
        "general_waste_required",
        "recycling_required",
        "glass_required",
        "food_required",
        "town",
        "county",
    )

    readonly_fields = (
        "created_at",
        "created_by",
        "converted_customer",
        "calculated_monthly_value_display",
        "convert_lead_button",
    )

    fieldsets = (
        ("Lead Details", {
            "fields": (
                "company_name",
                "who_spoke_to",
                "contact_name",
                "phone",
                "secondary_phone",
                "email",
                "lead_source",
                "lead_source_other",
            )
        }),
        ("Location", {
            "fields": (
                "address_line_1",
                "address_line_2",
                "town",
                "county",
                "postcode",
            )
        }),
        ("Legacy Address", {
            "classes": ("collapse",),
            "fields": (
                "address",
            )
        }),
        ("General Waste", {
            "fields": (
                "general_waste_required",
                "general_waste_bin_count",
                "general_waste_bin_size",
                "general_waste_collections_per_week",
                "general_waste_lock_required",
                "general_waste_metal_bin_required",
            )
        }),
        ("Dry Mixed Recycling", {
            "fields": (
                "recycling_required",
                "recycling_bin_count",
                "recycling_bin_size",
                "recycling_collections_per_week",
                "recycling_lock_required",
                "recycling_metal_bin_required",
            )
        }),
        ("Glass", {
            "fields": (
                "glass_required",
                "glass_bin_count",
                "glass_bin_size",
                "glass_collections_per_week",
                "glass_lock_required",
                "glass_metal_bin_required",
            )
        }),
        ("Food", {
            "fields": (
                "food_required",
                "food_bin_count",
                "food_bin_size",
                "food_collections_per_week",
                "food_lock_required",
                "food_metal_bin_required",
            )
        }),
        ("Follow Up & Status", {
            "fields": (
                "calculated_monthly_value_display",
                "follow_up_date",
                "status",
                "notes",
            )
        }),
        ("Convert", {
            "fields": (
                "convert_lead_button",
                "converted_customer",
            )
        }),
        ("System", {
            "fields": (
                "created_by",
                "created_at",
            )
        }),
    )

    def formatted_calculated_monthly_value(self, obj):
        return f"£{obj.calculated_monthly_value:,.2f}"

    formatted_calculated_monthly_value.short_description = "Estimated Monthly Value"

    def calculated_monthly_value_display(self, obj):
        return f"£{obj.calculated_monthly_value:,.2f}"

    calculated_monthly_value_display.short_description = "Calculated Monthly Value"

    def convert_lead_button(self, obj):
        if not obj or not obj.pk:
            return "Save the lead first before converting."

        if obj.converted_customer:
            url = reverse("admin:customers_customer_change", args=[obj.converted_customer.pk])
            return format_html(
                '<a class="button" href="{}">Open Converted Customer</a>',
                url
            )

        url = reverse("admin:lead-convert", args=[obj.pk])
        return format_html('<a class="button" href="{}">Convert Lead</a>', url)

    convert_lead_button.short_description = "Convert Lead"

    def save_model(self, request, obj, form, change):
        if not obj.created_by:
            obj.created_by = request.user

        if not obj.address and obj.formatted_address:
            obj.address = obj.formatted_address

        super().save_model(request, obj, form, change)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "<int:lead_id>/convert/",
                self.admin_site.admin_view(self.convert_lead_view),
                name="lead-convert",
            ),
        ]
        return custom_urls + urls

    def convert_lead_view(self, request, lead_id):
        lead = get_object_or_404(Lead, pk=lead_id)

        if lead.converted_customer:
            messages.warning(
                request,
                f"This lead has already been converted to customer '{lead.converted_customer.business_name}'."
            )
            return redirect("admin:customers_customer_change", lead.converted_customer.pk)

        if request.method == "POST":
            form = LeadConvertForm(request.POST)
            if form.is_valid():
                customer = Customer.objects.create(
                    business_name=form.cleaned_data["business_name"],
                    trading_name=form.cleaned_data["trading_name"],
                    company_number=form.cleaned_data["company_number"],
                    vat_number=form.cleaned_data["vat_number"],
                    billing_address=form.cleaned_data["billing_address"],
                    billing_postcode=form.cleaned_data["billing_postcode"],
                    billing_address_line_1=form.cleaned_data["billing_address_line_1"],
                    billing_address_line_2=form.cleaned_data["billing_address_line_2"],
                    billing_town=form.cleaned_data["billing_town"],
                    billing_county=form.cleaned_data["billing_county"],
                    primary_contact_name=form.cleaned_data["primary_contact_name"],
                    phone=form.cleaned_data["phone"],
                    secondary_contact_name=form.cleaned_data["secondary_contact_name"],
                    secondary_phone=form.cleaned_data["secondary_phone"],
                    email=form.cleaned_data["email"],
                    notes=form.cleaned_data["notes"],
                    created_by=request.user,
                )

                Site.objects.create(
                    customer=customer,
                    site_name=form.cleaned_data["site_name"],
                    address=form.cleaned_data["site_address"],
                    postcode=form.cleaned_data["site_postcode"],
                    address_line_1=form.cleaned_data["site_address_line_1"],
                    address_line_2=form.cleaned_data["site_address_line_2"],
                    town=form.cleaned_data["site_town"],
                    county=form.cleaned_data["site_county"],
                    primary_contact_name=form.cleaned_data["site_primary_contact_name"],
                    phone=form.cleaned_data["site_phone"],
                    secondary_contact_name=form.cleaned_data["site_secondary_contact_name"],
                    secondary_phone=form.cleaned_data["site_secondary_phone"],
                    email=form.cleaned_data["site_email"],
                    notes=form.cleaned_data["notes"],
                )

                lead.status = "won"
                lead.converted_customer = customer
                lead.save()

                messages.success(request, f"Lead converted successfully to customer '{customer.business_name}'.")
                return redirect("admin:customers_customer_change", customer.pk)

        else:
            form = LeadConvertForm(initial={
                "business_name": lead.company_name,
                "billing_address": lead.address,
                "billing_postcode": lead.postcode,
                "billing_address_line_1": lead.address_line_1,
                "billing_address_line_2": lead.address_line_2,
                "billing_town": lead.town,
                "billing_county": lead.county,
                "primary_contact_name": lead.contact_name,
                "phone": lead.phone,
                "secondary_phone": lead.secondary_phone,
                "email": lead.email,
                "site_name": lead.company_name,
                "site_address": lead.address,
                "site_postcode": lead.postcode,
                "site_address_line_1": lead.address_line_1,
                "site_address_line_2": lead.address_line_2,
                "site_town": lead.town,
                "site_county": lead.county,
                "site_primary_contact_name": lead.contact_name,
                "site_phone": lead.phone,
                "site_secondary_phone": lead.secondary_phone,
                "site_email": lead.email,
                "notes": lead.notes,
                "general_waste_required": lead.general_waste_required,
                "general_waste_bin_count": lead.general_waste_bin_count,
                "general_waste_bin_size": lead.general_waste_bin_size,
                "general_waste_collections_per_week": lead.general_waste_collections_per_week,
                "general_waste_lock_required": lead.general_waste_lock_required,
                "general_waste_metal_bin_required": lead.general_waste_metal_bin_required,
                "recycling_required": lead.recycling_required,
                "recycling_bin_count": lead.recycling_bin_count,
                "recycling_bin_size": lead.recycling_bin_size,
                "recycling_collections_per_week": lead.recycling_collections_per_week,
                "recycling_lock_required": lead.recycling_lock_required,
                "recycling_metal_bin_required": lead.recycling_metal_bin_required,
                "glass_required": lead.glass_required,
                "glass_bin_count": lead.glass_bin_count,
                "glass_bin_size": lead.glass_bin_size,
                "glass_collections_per_week": lead.glass_collections_per_week,
                "glass_lock_required": lead.glass_lock_required,
                "glass_metal_bin_required": lead.glass_metal_bin_required,
                "food_required": lead.food_required,
                "food_bin_count": lead.food_bin_count,
                "food_bin_size": lead.food_bin_size,
                "food_collections_per_week": lead.food_collections_per_week,
                "food_lock_required": lead.food_lock_required,
                "food_metal_bin_required": lead.food_metal_bin_required,
            })

        context = {
            **self.admin_site.each_context(request),
            "title": f"Convert Lead: {lead.company_name}",
            "lead": lead,
            "form": form,
        }

        return render(request, "admin/leads/convert_lead.html", context)

    class Media:
        js = ("leads/js/lead_admin.js",)