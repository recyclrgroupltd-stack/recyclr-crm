from django.urls import path

from .views import (
    notification_detail,
    notifications_list,
    notifications_mark_all_read,
    purchase_order_detail,
    purchase_orders_list,
    supplier_detail,
    suppliers_list,
)

urlpatterns = [
    path("suppliers/", suppliers_list, name="po-suppliers-list"),
    path("suppliers/<int:supplier_id>/", supplier_detail, name="po-supplier-detail"),

    path("notifications/", notifications_list, name="po-notifications-list"),
    path("notifications/mark-all-read/", notifications_mark_all_read, name="po-notifications-mark-all-read"),
    path("notifications/<int:notification_id>/read/", notification_detail, name="po-notification-detail"),

    path("", purchase_orders_list, name="purchase-orders-list"),
    path("<int:purchase_order_id>/", purchase_order_detail, name="purchase-order-detail"),
]