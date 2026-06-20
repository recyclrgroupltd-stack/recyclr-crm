import base64
import logging
import secrets
import string

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import Group
from django.core import signing
from django.db.models import Q
from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .company_branding import get_company_logo_data
from .models import CompanyDetails, StaffProfile, UserPermissionOverride
from .permissions import (
    PERMISSION_REGISTRY,
    apply_overrides_to_permissions,
    build_permissions_for_role,
    permission_categories,
)

User = get_user_model()
logger = logging.getLogger(__name__)
STAFF_AUTH_TOKEN_SALT = "recyclr-core-staff-auth"
STAFF_AUTH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12

ROLE_TO_GROUP = {
    "admin": "Admin",
    "manager": "Manager",
    "sales": "Sales",
    "operations": "Operations",
    "driver": "Driver",
    "finance": "Finance",
    "staff": "Staff",
}

ALL_ROLE_GROUPS = [
    "Admin",
    "Manager",
    "Sales",
    "Operations",
    "Driver",
    "Finance",
    "Staff",
    "Admin 1",
    "Admin 2",
    "Ops",
]


def normalise_staff_lookup(value):
    return "".join(char.lower() for char in str(value or "") if char.isalnum())


def staff_lookup_values(value):
    raw_value = str(value or "").strip()
    if not raw_value:
        return []

    values = [raw_value]
    if "@" in raw_value:
        values.append(raw_value.split("@", 1)[0])

    dotted_local_part = raw_value.replace(" ", ".")
    if dotted_local_part not in values:
        values.append(dotted_local_part)

    return [lookup for lookup in values if lookup]


def get_staff_role(user):
    if user.is_superuser:
        return "admin"

    group_names = {group.name.lower() for group in user.groups.all()}

    if "admin" in group_names or "admin 1" in group_names:
        return "admin"

    if "manager" in group_names or "admin 2" in group_names:
        return "manager"

    if "sales" in group_names:
        return "sales"

    if "ops" in group_names or "operations" in group_names:
        return "operations"

    if "driver" in group_names:
        return "driver"

    if "finance" in group_names:
        return "finance"

    return "staff"


def get_merged_permission_map_for_user(user):
    role = get_staff_role(user)
    base_permissions = build_permissions_for_role(role)
    overrides = list(user.permission_overrides.all())
    return apply_overrides_to_permissions(base_permissions, overrides)


def user_has_permission(user, permission_key: str) -> bool:
    if not user or not permission_key:
        return False
    return bool(get_merged_permission_map_for_user(user).get(permission_key, False))


def get_role_permissions(role):
    permission_map = build_permissions_for_role(role)
    return {
        "can_edit_leads": permission_map.get("leads.edit", False),
        "can_edit_customers": permission_map.get("customers.edit", False),
        "can_edit_sites": permission_map.get("sites.edit", False),
        "can_edit_services": permission_map.get("services.edit", False),
        "can_edit_pricing": permission_map.get("pricing.edit", False),
        "can_manage_users": permission_map.get("staff.manage", False),
        "can_edit_hauliers": permission_map.get("hauliers.edit", False),
        "can_view_expenses": permission_map.get("expenses.view", False),
        "can_approve_expenses": permission_map.get("expenses.approve", False),
        "permission_map": permission_map,
    }


def get_staff_profile(user):
    profile, _ = StaffProfile.objects.get_or_create(user=user)
    return profile


def serialize_staff_profile(profile):
    return {
        "company_email": profile.company_email,
        "company_phone": profile.company_phone,
        "job_title": profile.job_title,
        "auto_assign_customers": profile.auto_assign_customers,
        "mailbox_enabled": profile.mailbox_enabled,
        "mailbox_password": profile.mailbox_password,
        "mailbox_has_password": bool(profile.mailbox_password),
        "about_me": profile.about_me,
        "photo_data": profile.photo_data,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


def derived_company_email(username):
    local_part = str(username or "").strip().lower().replace(" ", ".")
    local_part = "".join(char for char in local_part if char.isalnum() or char in {".", "-", "_"})
    local_part = ".".join(part for part in local_part.split(".") if part)
    domain = (CompanyDetails.get_solo().company_email_domain or "recyclrgroup.co.uk").strip().lower().replace("@", "")
    return f"{local_part}@{domain}" if local_part else ""


def generate_mailbox_password(length=18):
    alphabet = string.ascii_letters + string.digits + "!@#$%&*?"
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(char.islower() for char in password)
            and any(char.isupper() for char in password)
            and any(char.isdigit() for char in password)
            and any(char in "!@#$%&*?" for char in password)
        ):
            return password


def serialize_user(user):
    role = get_staff_role(user)
    merged_permission_map = get_merged_permission_map_for_user(user)
    profile = get_staff_profile(user)

    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "display_name": user.get_full_name() or user.username,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "is_active": user.is_active,
        "role": role,
        "permissions": {
            "can_edit_leads": merged_permission_map.get("leads.edit", False),
            "can_edit_customers": merged_permission_map.get("customers.edit", False),
            "can_edit_sites": merged_permission_map.get("sites.edit", False),
            "can_edit_services": merged_permission_map.get("services.edit", False),
            "can_edit_pricing": merged_permission_map.get("pricing.edit", False),
            "can_manage_users": merged_permission_map.get("staff.manage", False),
            "can_edit_hauliers": merged_permission_map.get("hauliers.edit", False),
            "can_view_expenses": merged_permission_map.get("expenses.view", False),
            "can_approve_expenses": merged_permission_map.get("expenses.approve", False),
            "permission_map": merged_permission_map,
        },
        "overrides": [
            {
                "permission_key": override.permission_key,
                "is_allowed": override.is_allowed,
            }
            for override in user.permission_overrides.all()
        ],
        "profile": serialize_staff_profile(profile),
    }


def serialize_user_minimal(user):
    role = get_staff_role(user)
    permissions = get_role_permissions(role)

    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "display_name": user.get_full_name() or user.username,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "is_active": user.is_active,
        "role": role,
        "permissions": permissions,
        "overrides": [],
        "profile": {
            "company_email": derived_company_email(user.username),
            "company_phone": "",
            "job_title": "",
            "auto_assign_customers": False,
            "mailbox_enabled": False,
            "mailbox_password": "",
            "mailbox_has_password": False,
            "about_me": "",
            "photo_data": "",
            "updated_at": None,
        },
    }


def get_request_user_from_username(username):
    if not username:
        return None

    lookup_values = staff_lookup_values(username)
    exact_query = Q()
    for lookup_value in lookup_values:
        exact_query |= Q(username__iexact=lookup_value)
        exact_query |= Q(email__iexact=lookup_value)
        exact_query |= Q(staff_profile__company_email__iexact=lookup_value)

    if exact_query:
        user = (
            User.objects.filter(exact_query, is_staff=True)
            .prefetch_related("groups", "permission_overrides")
            .order_by("-is_superuser", "id")
            .first()
        )
        if user:
            return user

    normalized_lookups = {normalise_staff_lookup(value) for value in lookup_values}
    normalized_lookups.discard("")

    if not normalized_lookups:
        return None

    staff_users = (
        User.objects.filter(is_staff=True)
        .select_related("staff_profile")
        .prefetch_related("groups", "permission_overrides")
        .order_by("-is_superuser", "id")
    )

    for user in staff_users:
        candidate_values = [
            user.username,
            user.email,
            getattr(getattr(user, "staff_profile", None), "company_email", ""),
        ]
        for candidate_value in candidate_values:
            if normalise_staff_lookup(candidate_value) in normalized_lookups:
                return user
            if "@" in str(candidate_value):
                candidate_local_part = str(candidate_value).split("@", 1)[0]
                if normalise_staff_lookup(candidate_local_part) in normalized_lookups:
                    return user

    return None


def create_staff_auth_token(user):
    return signing.dumps({"user_id": user.pk}, salt=STAFF_AUTH_TOKEN_SALT, compress=True)


def get_request_user_from_token(token):
    if not token:
        return None

    try:
        payload = signing.loads(token, salt=STAFF_AUTH_TOKEN_SALT, max_age=STAFF_AUTH_TOKEN_MAX_AGE_SECONDS)
    except signing.BadSignature:
        return None

    user_id = payload.get("user_id")
    if not user_id:
        return None

    try:
        return (
            User.objects.filter(pk=user_id, is_staff=True, is_active=True)
            .prefetch_related("groups", "permission_overrides")
            .get()
        )
    except User.DoesNotExist:
        return None


def get_request_user_from_request(request):
    auth_header = request.headers.get("Authorization", "").strip()
    token = request.headers.get("X-Staff-Token", "").strip()
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()

    token_user = get_request_user_from_token(token)
    if token_user:
        return token_user

    if not settings.DEBUG:
        return None

    username = request.headers.get("X-Staff-Username", "").strip()
    return get_request_user_from_username(username)


def permission_denied_response(message: str, status_code: int = 403):
    return Response({"success": False, "message": message}, status=status_code)


def require_authenticated_staff_user(request):
    user = get_request_user_from_request(request)

    if not user:
        return None, permission_denied_response("Please sign in again.", status.HTTP_401_UNAUTHORIZED)

    return user, None


def require_permission(request, permission_key: str, denied_message: str | None = None):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return None, error_response

    if not user_has_permission(user, permission_key):
        return None, permission_denied_response(
            denied_message or f"You do not have permission to use {permission_key}.",
            status.HTTP_403_FORBIDDEN,
        )

    return user, None


def require_admin(request):
    user, error_response = require_permission(
        request,
        "staff.manage",
        "Only Admin can manage staff permissions.",
    )
    if error_response:
        return None, error_response
    return user, None


@api_view(["POST"])
def login_view(request):
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")

    staff_user = get_request_user_from_username(username)
    auth_username = staff_user.username if staff_user else username
    user = authenticate(username=auth_username, password=password)

    if user is None:
        return Response(
            {"success": False, "message": "Invalid username or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_staff:
        return Response(
            {"success": False, "message": "You do not have staff access."},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        user = User.objects.prefetch_related("groups", "permission_overrides").get(pk=user.pk)
        user_data = serialize_user(user)
    except Exception:
        logger.exception("Could not build full login payload for user %s", user.pk)
        user_data = serialize_user_minimal(user)

    return Response(
        {
            "success": True,
            "message": "Login successful.",
            "token": create_staff_auth_token(user),
            "username": user_data["username"],
            "role": user_data["role"],
            "permissions": user_data["permissions"],
            "user": user_data,
        }
    )


@api_view(["POST"])
def change_password_view(request):
    username = request.data.get("username", "").strip()
    current_password = request.data.get("current_password", "")
    new_password = request.data.get("new_password", "")
    confirm_password = request.data.get("confirm_password", "")

    if not username:
        return Response(
            {"success": False, "message": "Username is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not current_password:
        return Response(
            {"success": False, "message": "Current password is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not new_password:
        return Response(
            {"success": False, "message": "New password is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(new_password) < 8:
        return Response(
            {"success": False, "message": "New password must be at least 8 characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if new_password != confirm_password:
        return Response(
            {"success": False, "message": "New passwords do not match."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(username=username, password=current_password)

    if user is None:
        return Response(
            {"success": False, "message": "Current password is incorrect."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_staff:
        return Response(
            {"success": False, "message": "You do not have staff access."},
            status=status.HTTP_403_FORBIDDEN,
        )

    user.set_password(new_password)
    user.save()

    return Response({"success": True, "message": "Password changed successfully."})


@api_view(["GET"])
def staff_list_view(request):
    _, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    users = (
        User.objects.filter(is_staff=True)
        .prefetch_related("groups", "permission_overrides")
        .order_by("username")
    )

    return Response(
        {
            "success": True,
            "staff": [serialize_user(user) for user in users],
            "permission_categories": permission_categories(),
        }
    )


@api_view(["POST"])
def create_staff_user_view(request):
    _, error_response = require_admin(request)
    if error_response:
        return error_response

    payload = request.data if isinstance(request.data, dict) else {}
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    role = str(payload.get("role") or "staff").strip().lower()
    email = str(payload.get("email") or "").strip()
    first_name = str(payload.get("first_name") or "").strip()
    last_name = str(payload.get("last_name") or "").strip()
    company_phone = str(payload.get("company_phone") or "").strip()
    job_title = str(payload.get("job_title") or "").strip()
    auto_assign_customers = bool(payload.get("auto_assign_customers", True))

    valid_roles = {"admin", "manager", "sales", "operations", "driver", "finance", "staff"}
    if not username:
        return Response(
            {"success": False, "message": "Username is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not password:
        return Response(
            {"success": False, "message": "Temporary password is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(password) < 8:
        return Response(
            {"success": False, "message": "Temporary password must be at least 8 characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if role not in valid_roles:
        return Response(
            {"success": False, "message": "Invalid role selected."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if User.objects.filter(username__iexact=username).exists():
        return Response(
            {"success": False, "message": "A staff user with that username already exists."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if email and User.objects.filter(email__iexact=email).exists():
        return Response(
            {"success": False, "message": "A user with that email already exists."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.create_user(
        username=username,
        password=password,
        email=email or derived_company_email(username),
        first_name=first_name,
        last_name=last_name,
        is_staff=True,
        is_active=True,
        is_superuser=False,
    )

    group, _ = Group.objects.get_or_create(name=ROLE_TO_GROUP[role])
    user.groups.add(group)

    profile = get_staff_profile(user)
    profile.company_email = email or derived_company_email(username)
    profile.company_phone = company_phone
    profile.job_title = job_title
    profile.auto_assign_customers = auto_assign_customers
    profile.save(
        update_fields=[
            "company_email",
            "company_phone",
            "job_title",
            "auto_assign_customers",
            "updated_at",
        ]
    )

    user = User.objects.prefetch_related("groups", "permission_overrides").get(pk=user.pk)
    return Response(
        {
            "success": True,
            "message": f"Staff user created for {user.username}.",
            "user": serialize_user(user),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PATCH"])
def staff_profile_me_view(request):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    profile = get_staff_profile(user)

    if request.method == "GET":
        return Response({"success": True, "user": serialize_user(user)})

    payload = request.data if isinstance(request.data, dict) else {}

    profile.about_me = str(payload.get("about_me", profile.about_me) or "").strip()
    profile.photo_data = str(payload.get("photo_data", profile.photo_data) or "").strip()
    profile.save(update_fields=["about_me", "photo_data", "updated_at"])

    return Response(
        {
            "success": True,
            "message": "Profile saved successfully.",
            "user": serialize_user(user),
        }
    )


@api_view(["GET"])
def staff_profile_detail_view(request, user_id):
    _, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    try:
        target_user = User.objects.prefetch_related("groups", "permission_overrides").get(pk=user_id, is_staff=True)
    except User.DoesNotExist:
        return Response(
            {"success": False, "message": "Staff user not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response({"success": True, "user": serialize_user(target_user)})


@api_view(["PATCH"])
def update_staff_profile_admin_view(request, user_id):
    _, error_response = require_admin(request)
    if error_response:
        return error_response

    try:
        target_user = User.objects.prefetch_related("groups", "permission_overrides").get(pk=user_id, is_staff=True)
    except User.DoesNotExist:
        return Response(
            {"success": False, "message": "Staff user not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    payload = request.data if isinstance(request.data, dict) else {}
    profile = get_staff_profile(target_user)

    if "first_name" in payload:
        target_user.first_name = str(payload.get("first_name") or "").strip()
    if "last_name" in payload:
        target_user.last_name = str(payload.get("last_name") or "").strip()
    if "first_name" in payload or "last_name" in payload:
        target_user.save(update_fields=["first_name", "last_name"])

    profile.company_email = str(
        payload.get("company_email", profile.company_email) or derived_company_email(target_user.username)
    ).strip()
    profile.company_phone = str(payload.get("company_phone", profile.company_phone) or "").strip()
    profile.job_title = str(payload.get("job_title", profile.job_title) or "").strip()
    if "auto_assign_customers" in payload:
        profile.auto_assign_customers = bool(payload.get("auto_assign_customers"))
    if "mailbox_enabled" in payload:
        profile.mailbox_enabled = bool(payload.get("mailbox_enabled"))
    if "mailbox_password" in payload:
        next_mailbox_password = str(payload.get("mailbox_password") or "").strip()
        if next_mailbox_password:
            profile.mailbox_password = next_mailbox_password
    profile.save(
        update_fields=[
            "company_email",
            "company_phone",
            "job_title",
            "auto_assign_customers",
            "mailbox_enabled",
            "mailbox_password",
            "updated_at",
        ]
    )

    return Response(
        {
            "success": True,
            "message": f"Profile details updated for {target_user.username}.",
            "user": serialize_user(target_user),
        }
    )


@api_view(["POST"])
def generate_staff_mailbox_password_view(request, user_id):
    _, error_response = require_admin(request)
    if error_response:
        return error_response

    try:
        target_user = User.objects.prefetch_related("groups", "permission_overrides").get(pk=user_id, is_staff=True)
    except User.DoesNotExist:
        return Response(
            {"success": False, "message": "Staff user not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    profile = get_staff_profile(target_user)
    profile.company_email = profile.company_email or derived_company_email(target_user.username)
    profile.mailbox_password = generate_mailbox_password()
    profile.mailbox_enabled = True
    profile.save(update_fields=["company_email", "mailbox_password", "mailbox_enabled", "updated_at"])

    return Response(
        {
            "success": True,
            "message": f"Mailbox password generated for {target_user.username}.",
            "user": serialize_user(target_user),
            "mailbox_password": profile.mailbox_password,
        }
    )


@api_view(["POST"])
def update_staff_role_view(request, user_id):
    acting_user, error_response = require_admin(request)
    if error_response:
        return error_response

    new_role = request.data.get("role", "").strip()

    valid_roles = {"admin", "manager", "sales", "operations", "driver", "finance", "staff"}
    if new_role not in valid_roles:
        return Response(
            {"success": False, "message": "Invalid role selected."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        target_user = User.objects.prefetch_related("groups", "permission_overrides").get(pk=user_id, is_staff=True)
    except User.DoesNotExist:
        return Response(
            {"success": False, "message": "Staff user not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if target_user.id == acting_user.id and new_role != "admin":
        return Response(
            {"success": False, "message": "Admin cannot remove their own Admin access from this page."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    groups_to_remove = Group.objects.filter(name__in=ALL_ROLE_GROUPS)
    target_user.groups.remove(*groups_to_remove)

    if new_role in ROLE_TO_GROUP:
        group_name = ROLE_TO_GROUP[new_role]
        group, _ = Group.objects.get_or_create(name=group_name)
        target_user.groups.add(group)

    target_user.save()
    target_user = User.objects.prefetch_related("groups", "permission_overrides").get(pk=target_user.pk)

    return Response(
        {
            "success": True,
            "message": f"Role updated successfully for {target_user.username}.",
            "user": serialize_user(target_user),
        }
    )


@api_view(["POST"])
def update_staff_active_view(request, user_id):
    acting_user, error_response = require_admin(request)
    if error_response:
        return error_response

    is_active = bool(request.data.get("is_active", True))

    try:
        target_user = User.objects.prefetch_related("groups", "permission_overrides").get(pk=user_id, is_staff=True)
    except User.DoesNotExist:
        return Response(
            {"success": False, "message": "Staff user not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if target_user.id == acting_user.id and not is_active:
        return Response(
            {"success": False, "message": "You cannot deactivate your own account while signed in."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    target_user.is_active = is_active
    target_user.save(update_fields=["is_active"])
    target_user = User.objects.prefetch_related("groups", "permission_overrides").get(pk=target_user.pk)

    return Response(
        {
            "success": True,
            "message": f"{target_user.username} is now {'active' if is_active else 'inactive'}.",
            "user": serialize_user(target_user),
        }
    )


@api_view(["POST"])
def reset_staff_password_view(request, user_id):
    acting_user, error_response = require_admin(request)
    if error_response:
        return error_response

    payload = request.data if isinstance(request.data, dict) else {}
    new_password = str(payload.get("password") or "")

    if len(new_password) < 4:
        return Response(
            {"success": False, "message": "Password must be at least 4 characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        target_user = User.objects.prefetch_related("groups", "permission_overrides").get(pk=user_id, is_staff=True)
    except User.DoesNotExist:
        return Response(
            {"success": False, "message": "Staff user not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    target_user.set_password(new_password)
    target_user.save(update_fields=["password"])

    return Response(
        {
            "success": True,
            "message": f"Password reset for {target_user.username}.",
            "user": serialize_user(target_user),
        }
    )


@api_view(["DELETE"])
def delete_staff_user_view(request, user_id):
    acting_user, error_response = require_admin(request)
    if error_response:
        return error_response

    try:
        target_user = User.objects.get(pk=user_id, is_staff=True)
    except User.DoesNotExist:
        return Response(
            {"success": False, "message": "Staff user not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if target_user.id == acting_user.id:
        return Response(
            {"success": False, "message": "You cannot delete your own account while signed in."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    username = target_user.username
    role_groups = list(Group.objects.filter(name__in=ALL_ROLE_GROUPS))
    if role_groups:
        target_user.groups.remove(*role_groups)

    deleted_prefix = f"deleted-{target_user.id}-"
    username_max_length = User._meta.get_field("username").max_length
    target_user.username = f"{deleted_prefix}{username}"[:username_max_length]
    target_user.email = ""
    target_user.is_active = False
    target_user.is_staff = False
    target_user.is_superuser = False
    target_user.save(update_fields=["username", "email", "is_active", "is_staff", "is_superuser"])

    return Response(
        {
            "success": True,
            "message": f"Removed staff login for {username}.",
            "deleted_user_id": user_id,
        }
    )


@api_view(["POST"])
def update_staff_permission_override_view(request, user_id):
    _, error_response = require_admin(request)
    if error_response:
        return error_response

    permission_key = request.data.get("permission_key", "").strip()
    mode = request.data.get("mode", "").strip()

    if permission_key not in PERMISSION_REGISTRY:
        return Response(
            {"success": False, "message": "Invalid permission key."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if mode not in {"default", "allow", "deny"}:
        return Response(
            {"success": False, "message": "Invalid permission mode."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        target_user = User.objects.prefetch_related("groups", "permission_overrides").get(pk=user_id, is_staff=True)
    except User.DoesNotExist:
        return Response(
            {"success": False, "message": "Staff user not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if mode == "default":
        UserPermissionOverride.objects.filter(
            user=target_user,
            permission_key=permission_key,
        ).delete()
    else:
        UserPermissionOverride.objects.update_or_create(
            user=target_user,
            permission_key=permission_key,
            defaults={"is_allowed": mode == "allow"},
        )

    target_user = User.objects.prefetch_related("groups", "permission_overrides").get(pk=target_user.pk)

    return Response(
        {
            "success": True,
            "message": f"Permission override updated for {target_user.username}.",
            "user": serialize_user(target_user),
        }
    )


def serialize_company_details(details: CompanyDetails):
    return {
        "company_name": details.company_name,
        "company_number": details.company_number,
        "waste_broker_registration": details.waste_broker_registration,
        "main_email": details.main_email,
        "legal_documents_email": details.legal_documents_email,
        "phone_number": details.phone_number,
        "website": details.website,
        "company_logo_data": details.company_logo_data,
        "company_email_domain": details.company_email_domain,
        "default_quote_validity_days": details.default_quote_validity_days,
        "signing_pack_expiry_days": details.signing_pack_expiry_days,
        "default_target_margin_percent": float(details.default_target_margin_percent or 30),
        "sales_offer_margin_1_percent": float(details.sales_offer_margin_1_percent or 35),
        "sales_offer_margin_2_percent": float(details.sales_offer_margin_2_percent or 30),
        "sales_offer_margin_3_percent": float(details.sales_offer_margin_3_percent or 25),
        "registered_address_line_1": details.registered_address_line_1,
        "registered_address_line_2": details.registered_address_line_2,
        "registered_town": details.registered_town,
        "registered_county": details.registered_county,
        "registered_postcode": details.registered_postcode,
        "registered_country": details.registered_country,
        "trading_address_line_1": details.trading_address_line_1,
        "trading_address_line_2": details.trading_address_line_2,
        "trading_town": details.trading_town,
        "trading_county": details.trading_county,
        "trading_postcode": details.trading_postcode,
        "trading_country": details.trading_country,
        "same_as_registered_office": (
            details.trading_address_line_1 == details.registered_address_line_1
            and details.trading_address_line_2 == details.registered_address_line_2
            and details.trading_town == details.registered_town
            and details.trading_county == details.registered_county
            and details.trading_postcode == details.registered_postcode
            and details.trading_country == details.registered_country
        ),
        "legal_signatory_name": details.legal_signatory_name,
        "legal_signatory_title": details.legal_signatory_title,
        "legal_signature_data": details.legal_signature_data,
        "mileage_rate": float(details.mileage_rate or 0),
        "vat_rate": float(details.vat_rate or 0),
        "container_qr_label_width_mm": float(details.container_qr_label_width_mm or 50),
        "container_qr_label_height_mm": float(details.container_qr_label_height_mm or 50),
        "registered_office": details.registered_office,
        "trading_address": details.trading_address,
        "updated_at": details.updated_at.isoformat() if details.updated_at else None,
    }


def company_logo_view(request):
    logo = get_company_logo_data()
    if not logo or "," not in logo:
        return HttpResponse(status=404)

    header, encoded = logo.split(",", 1)
    content_type = "image/png"
    if header.startswith("data:") and ";" in header:
        content_type = header[5:].split(";", 1)[0] or content_type

    try:
        image_bytes = base64.b64decode(encoded)
    except (TypeError, ValueError):
        return HttpResponse(status=404)

    response = HttpResponse(image_bytes, content_type=content_type)
    response["Cache-Control"] = "public, max-age=300"
    return response


@api_view(["GET", "PUT"])
def company_details_view(request):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    details = CompanyDetails.get_solo()

    if request.method == "GET":
        return Response({"success": True, "company_details": serialize_company_details(details)})

    payload = request.data
    if not isinstance(payload, dict):
        return Response(
            {"success": False, "message": "Invalid request body."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def clean(value, fallback=""):
        if value is None:
            return fallback
        return str(value).strip()

    def positive_int(value, fallback):
        try:
            return max(1, int(value))
        except (TypeError, ValueError):
            return fallback

    details.company_name = clean(payload.get("company_name"), details.company_name or "")
    details.company_number = clean(payload.get("company_number"), details.company_number)
    details.waste_broker_registration = clean(payload.get("waste_broker_registration"), details.waste_broker_registration)
    details.main_email = clean(payload.get("main_email"), details.main_email)
    details.legal_documents_email = clean(payload.get("legal_documents_email"), details.legal_documents_email)
    details.phone_number = clean(payload.get("phone_number"), details.phone_number)
    details.website = clean(payload.get("website"), details.website)
    details.company_logo_data = clean(payload.get("company_logo_data"), details.company_logo_data)
    details.company_email_domain = (
        clean(payload.get("company_email_domain"), details.company_email_domain or "recyclrgroup.co.uk")
        .lower()
        .replace("@", "")
    )
    details.default_quote_validity_days = positive_int(
        payload.get("default_quote_validity_days"),
        details.default_quote_validity_days or 14,
    )
    details.signing_pack_expiry_days = positive_int(
        payload.get("signing_pack_expiry_days"),
        details.signing_pack_expiry_days or 30,
    )
    details.default_target_margin_percent = payload.get("default_target_margin_percent") or 30
    details.sales_offer_margin_1_percent = payload.get("sales_offer_margin_1_percent") or 35
    details.sales_offer_margin_2_percent = payload.get("sales_offer_margin_2_percent") or 30
    details.sales_offer_margin_3_percent = payload.get("sales_offer_margin_3_percent") or 25
    details.mileage_rate = payload.get("mileage_rate") or 0
    details.vat_rate = payload.get("vat_rate") or 0
    details.container_qr_label_width_mm = payload.get("container_qr_label_width_mm") or 50
    details.container_qr_label_height_mm = payload.get("container_qr_label_height_mm") or 50

    details.registered_address_line_1 = clean(payload.get("registered_address_line_1"), details.registered_address_line_1)
    details.registered_address_line_2 = clean(payload.get("registered_address_line_2"), details.registered_address_line_2)
    details.registered_town = clean(payload.get("registered_town"), details.registered_town)
    details.registered_county = clean(payload.get("registered_county"), details.registered_county)
    details.registered_postcode = clean(payload.get("registered_postcode"), details.registered_postcode)
    details.registered_country = clean(payload.get("registered_country"), details.registered_country or "England")

    same_as_registered = bool(payload.get("same_as_registered_office", False))
    if same_as_registered:
        details.trading_address_line_1 = details.registered_address_line_1
        details.trading_address_line_2 = details.registered_address_line_2
        details.trading_town = details.registered_town
        details.trading_county = details.registered_county
        details.trading_postcode = details.registered_postcode
        details.trading_country = details.registered_country
    else:
        details.trading_address_line_1 = clean(payload.get("trading_address_line_1"), details.trading_address_line_1)
        details.trading_address_line_2 = clean(payload.get("trading_address_line_2"), details.trading_address_line_2)
        details.trading_town = clean(payload.get("trading_town"), details.trading_town)
        details.trading_county = clean(payload.get("trading_county"), details.trading_county)
        details.trading_postcode = clean(payload.get("trading_postcode"), details.trading_postcode)
        details.trading_country = clean(payload.get("trading_country"), details.trading_country or "England")

    details.legal_signatory_name = clean(payload.get("legal_signatory_name"), details.legal_signatory_name)
    details.legal_signatory_title = clean(payload.get("legal_signatory_title"), details.legal_signatory_title)
    details.legal_signature_data = clean(payload.get("legal_signature_data"), details.legal_signature_data)
    details.save()

    return Response(
        {
            "success": True,
            "message": "Company details saved successfully.",
            "company_details": serialize_company_details(details),
        }
    )
