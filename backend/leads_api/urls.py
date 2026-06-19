from django.urls import path

from .views import (
    customer_detail,
    customers_list,
    lead_detail,
    lead_quote_preview,
    leads_list,
    service_create,
    service_create_options,
    service_detail,
    services_list,
    site_detail,
    sites_list,
)

urlpatterns = [
    path("leads/", leads_list),
    path("leads/<int:lead_id>/quote-preview/", lead_quote_preview),
    path("leads/<int:lead_id>/", lead_detail),

    path("customers/", customers_list),
    path("customers/<int:customer_id>/", customer_detail),

    path("sites/", sites_list),
    path("sites/<int:site_id>/", site_detail),

    path("services/", services_list),
    path("services/create/options/", service_create_options),
    path("services/create/", service_create),
    path("services/<int:service_id>/", service_detail),
]
