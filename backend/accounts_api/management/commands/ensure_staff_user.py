import re

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError

from accounts_api.models import CompanyDetails, StaffProfile
from accounts_api.permissions import ROLE_DEFAULT_PERMISSIONS, normalise_role


ROLE_TO_GROUP = {
    "admin": "Admin",
    "manager": "Manager",
    "sales": "Sales",
    "operations": "Operations",
    "driver": "Driver",
    "finance": "Finance",
    "staff": "Staff",
}
ALL_ROLE_GROUPS = list(ROLE_TO_GROUP.values()) + ["Admin 1", "Admin 2", "Ops"]


def build_company_email(username):
    try:
        domain = CompanyDetails.get_solo().company_email_domain or "recyclrgroup.co.uk"
    except Exception:
        domain = "recyclrgroup.co.uk"

    local_part = username.strip().lower().replace(" ", ".")
    local_part = re.sub(r"[^a-z0-9._-]+", ".", local_part)
    local_part = re.sub(r"\.+", ".", local_part).strip(".") or "staff"
    return f"{local_part}@{domain}"


class Command(BaseCommand):
    help = "Create or update a CRM staff user, useful for the first hosted admin account."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True)
        parser.add_argument("--password", required=True)
        parser.add_argument("--email", default="")
        parser.add_argument("--first-name", default="")
        parser.add_argument("--last-name", default="")
        parser.add_argument("--role", default="admin")
        parser.add_argument("--superuser", action="store_true")
        parser.add_argument("--mailbox-password", default="")
        parser.add_argument("--job-title", default="")
        parser.add_argument("--phone", default="")

    def handle(self, *args, **options):
        username = (options["username"] or "").strip()
        password = options["password"] or ""
        role = normalise_role(options["role"]).lower()

        if not username:
            raise CommandError("--username cannot be blank.")
        if not password:
            raise CommandError("--password cannot be blank.")
        if role not in ROLE_TO_GROUP or role not in ROLE_DEFAULT_PERMISSIONS:
            raise CommandError(
                f"Unknown role '{options['role']}'. Use one of: {', '.join(ROLE_TO_GROUP)}."
            )

        email = (options["email"] or "").strip() or build_company_email(username)
        User = get_user_model()
        user, created = User.objects.get_or_create(username=username)

        user.set_password(password)
        user.email = email
        if options["first_name"]:
            user.first_name = options["first_name"].strip()
        if options["last_name"]:
            user.last_name = options["last_name"].strip()
        user.is_active = True
        user.is_staff = True
        user.is_superuser = bool(options["superuser"] or role == "admin")
        user.save()

        role_groups = Group.objects.filter(name__in=ALL_ROLE_GROUPS)
        if role_groups:
            user.groups.remove(*role_groups)
        group, _ = Group.objects.get_or_create(name=ROLE_TO_GROUP[role])
        user.groups.add(group)

        profile, _ = StaffProfile.objects.get_or_create(user=user)
        profile.company_email = email
        if options["phone"]:
            profile.company_phone = options["phone"].strip()
        if options["job_title"]:
            profile.job_title = options["job_title"].strip()
        if options["mailbox_password"]:
            profile.mailbox_password = options["mailbox_password"]
            profile.mailbox_enabled = True
        profile.save()

        action = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{action} staff user '{username}'."))
        self.stdout.write(f"Email: {email}")
        self.stdout.write(f"Role: {role}")
        self.stdout.write(f"Superuser: {'yes' if user.is_superuser else 'no'}")
