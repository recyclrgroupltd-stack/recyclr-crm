from django.urls import path

from .views import (
    forgot_password,
    haulier_detail,
    haulier_rate_detail,
    haulier_rates_list,
    hauliers_list,
    portal_jobs,
    portal_login,
    portal_update_job,
    portal_user_detail,
    portal_user_resend_setup,
    portal_users_list,
    set_password,
)

urlpatterns = [
    path("", hauliers_list, name="hauliers-list"),
    path("<int:haulier_id>/", haulier_detail, name="haulier-detail"),
    path("rates/", haulier_rates_list, name="haulier-rates-list"),
    path("rates/<int:rate_id>/", haulier_rate_detail, name="haulier-rate-detail"),

    path("portal/users/", portal_users_list, name="portal-users-list"),
    path("portal/users/<int:user_id>/", portal_user_detail, name="portal-user-detail"),
    path("portal/users/<int:user_id>/resend-setup/", portal_user_resend_setup, name="portal-user-resend-setup"),

    path("portal/login/", portal_login, name="portal-login"),
    path("portal/jobs/", portal_jobs, name="portal-jobs"),
    path("portal/jobs/<int:job_id>/update/", portal_update_job, name="portal-update-job"),
    path("portal/forgot-password/", forgot_password, name="portal-forgot-password"),
    path("portal/set-password/<uuid:token>/", set_password, name="portal-set-password"),
]