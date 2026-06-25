from django.urls import path

from . import views

urlpatterns = [
    path("status/", views.ai_status_view, name="ai-status"),
    path("assist/", views.ai_assist_view, name="ai-assist"),
    path("logs/", views.ai_logs_view, name="ai-logs"),
]
