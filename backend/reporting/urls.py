from django.urls import path

from .views import report_builder_options, run_report

urlpatterns = [
    path("options/", report_builder_options, name="report-builder-options"),
    path("run/", run_report, name="run-report"),
]