from django.urls import path

from .views import customer_jobs, generate_jobs_now, jobs_list, update_job_status

urlpatterns = [
    path("", jobs_list),
    path("generate/", generate_jobs_now),
    path("customer/<int:customer_id>/", customer_jobs),
    path("<int:job_id>/update/", update_job_status),
]