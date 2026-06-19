from django.urls import path

from .views import dashboard_overview, dashboard_stats

urlpatterns = [
    path("stats/", dashboard_stats, name="dashboard-stats"),
    path("overview/", dashboard_overview, name="dashboard-overview"),
]