from django.urls import path

from .views import asset_detail, assets_list, locations, options


urlpatterns = [
    path("", assets_list, name="assets-list"),
    path("options/", options, name="assets-options"),
    path("locations/", locations, name="assets-locations"),
    path("<int:asset_id>/", asset_detail, name="asset-detail"),
]
