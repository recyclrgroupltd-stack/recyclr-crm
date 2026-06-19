from django.urls import path

from .views import collections_for_customer, create_test_collection_data

urlpatterns = [
    path("customer/<int:customer_id>/", collections_for_customer, name="collections-for-customer"),
    path("customer/<int:customer_id>/create-test-data/", create_test_collection_data, name="create-test-collection-data"),
]