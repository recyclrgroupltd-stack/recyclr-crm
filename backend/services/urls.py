from django.urls import path

from .views import service_detail, services_list, services_setup_options

urlpatterns = [
    path("", services_list, name="services-list"),
    path("setup-options/", services_setup_options, name="services-setup-options"),
    path("<int:service_id>/", service_detail, name="service-detail"),
]