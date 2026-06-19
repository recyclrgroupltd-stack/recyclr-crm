from django.urls import path
from .views import send_email, customer_emails, send_staff_email

urlpatterns = [
    path("send/", send_email),
    path("staff/send/", send_staff_email),
    path("customer/<int:customer_id>/", customer_emails),
]
