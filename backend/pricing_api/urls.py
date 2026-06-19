from django.urls import path
from . import views

urlpatterns = [
    path("", views.pricing_list),
    path("create/", views.pricing_create),
    path("<int:item_id>/update/", views.pricing_update),
    path("<int:item_id>/delete/", views.pricing_delete),
]