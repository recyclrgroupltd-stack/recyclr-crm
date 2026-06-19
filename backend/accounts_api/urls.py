from django.urls import path
from .views import (
    change_password_view,
    company_logo_view,
    company_details_view,
    generate_staff_mailbox_password_view,
    login_view,
    staff_profile_detail_view,
    staff_profile_me_view,
    staff_list_view,
    update_staff_profile_admin_view,
    update_staff_permission_override_view,
    update_staff_role_view,
)

urlpatterns = [
    path("login", login_view, name="api-login-no-slash"),
    path("login/", login_view, name="api-login"),
    path("change-password/", change_password_view, name="api-change-password"),
    path("company-details/", company_details_view, name="api-company-details"),
    path("company-logo/", company_logo_view, name="api-company-logo"),
    path("profile/me/", staff_profile_me_view, name="api-staff-profile-me"),
    path("profile/<int:user_id>/", staff_profile_detail_view, name="api-staff-profile-detail"),
    path("staff/", staff_list_view, name="api-staff-list"),
    path("staff/<int:user_id>/profile/", update_staff_profile_admin_view, name="api-staff-profile-admin-update"),
    path(
        "staff/<int:user_id>/mailbox/generate-password/",
        generate_staff_mailbox_password_view,
        name="api-staff-mailbox-generate-password",
    ),
    path("staff/<int:user_id>/role/", update_staff_role_view, name="api-staff-role-update"),
    path(
        "staff/<int:user_id>/permissions/override/",
        update_staff_permission_override_view,
        name="api-staff-permission-override-update",
    ),
]
