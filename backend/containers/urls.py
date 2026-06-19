from django.urls import path

from .views import (
    assign_containers,
    container_detail,
    containers_list,
    create_container_batch,
    maintenance_list,
    options,
)

urlpatterns = [
    path("", containers_list, name="containers-list"),
    path("options/", options, name="containers-options"),
    path("batches/", create_container_batch, name="containers-create-batch"),
    path("assign/", assign_containers, name="containers-assign"),
    path("maintenance/", maintenance_list, name="containers-maintenance"),
    path("<int:container_id>/", container_detail, name="container-detail"),
]
