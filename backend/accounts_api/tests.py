from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from .models import StaffProfile, StaffSession


class StaffLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="Jay.Gallagher",
            email="jay.gallagher@recyclrgroup.co.uk",
            password="Password123@",
            is_staff=True,
        )
        StaffProfile.objects.create(
            user=self.user,
            company_email="jay.gallagher@recyclrgroup.co.uk",
            job_title="Founder",
        )

    def post_login(self, username):
        return self.client.post(
            "/api/auth/login/",
            {"username": username, "password": "Password123@"},
            format="json",
        )

    def test_login_accepts_case_insensitive_username(self):
        response = self.post_login("jay.gallagher")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["username"], "Jay.Gallagher")

    def test_login_accepts_company_email(self):
        response = self.post_login("jay.gallagher@recyclrgroup.co.uk")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["username"], "Jay.Gallagher")

    def test_login_accepts_normalised_local_part(self):
        response = self.post_login("Jay Gallagher")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["username"], "Jay.Gallagher")

    def test_second_device_login_requires_confirmation(self):
        first_response = self.client.post(
            "/api/auth/login/",
            {
                "username": "Jay.Gallagher",
                "password": "Password123@",
                "device_name": "Chrome on desktop",
            },
            format="json",
        )
        self.assertEqual(first_response.status_code, 200)

        second_response = self.client.post(
            "/api/auth/login/",
            {
                "username": "Jay.Gallagher",
                "password": "Password123@",
                "device_name": "Tablet",
            },
            format="json",
        )

        self.assertEqual(second_response.status_code, 409)
        self.assertEqual(second_response.data["code"], "active_session_exists")
        self.assertEqual(second_response.data["active_device_name"], "Chrome on desktop")

    def test_forced_login_replaces_existing_session(self):
        first_response = self.client.post(
            "/api/auth/login/",
            {
                "username": "Jay.Gallagher",
                "password": "Password123@",
                "device_name": "Chrome on desktop",
            },
            format="json",
        )
        old_token = first_response.data["token"]

        forced_response = self.client.post(
            "/api/auth/login/",
            {
                "username": "Jay.Gallagher",
                "password": "Password123@",
                "device_name": "Tablet",
                "force_login": True,
            },
            format="json",
        )

        self.assertEqual(forced_response.status_code, 200)
        self.assertNotEqual(forced_response.data["token"], old_token)
        self.assertEqual(StaffSession.objects.filter(user=self.user, is_active=True).count(), 1)

        replaced_response = self.client.get(
            "/api/auth/staff/",
            HTTP_X_STAFF_USERNAME="Jay.Gallagher",
            HTTP_X_STAFF_SESSION_TOKEN=old_token,
        )

        self.assertEqual(replaced_response.status_code, 401)
        self.assertEqual(replaced_response.data["code"], "session_replaced")
        self.assertIn("Tablet", replaced_response.data["message"])

    def test_logout_ends_staff_session(self):
        login_response = self.client.post(
            "/api/auth/login/",
            {
                "username": "Jay.Gallagher",
                "password": "Password123@",
                "device_name": "Chrome on desktop",
            },
            format="json",
        )
        token = login_response.data["token"]

        logout_response = self.client.post(
            "/api/auth/logout/",
            HTTP_X_STAFF_SESSION_TOKEN=token,
        )

        self.assertEqual(logout_response.status_code, 200)
        self.assertFalse(StaffSession.objects.get(token=token).is_active)

    def test_session_endpoint_upgrades_legacy_local_session(self):
        response = self.client.post(
            "/api/auth/session/",
            HTTP_X_STAFF_USERNAME="Jay.Gallagher",
            HTTP_X_STAFF_SESSION_TOKEN="staff-session-active",
            HTTP_X_STAFF_DEVICE_NAME="Chrome on desktop",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertNotEqual(response.data["token"], "staff-session-active")
        self.assertEqual(response.data["device_name"], "Chrome on desktop")
        self.assertEqual(StaffSession.objects.filter(user=self.user, is_active=True).count(), 1)


class EnsureStaffUserTests(TestCase):
    def test_command_updates_matching_existing_user_instead_of_creating_duplicate(self):
        User = get_user_model()
        existing_user = User.objects.create_user(
            username="jaygallagher",
            email="jay.gallagher@recyclrgroup.co.uk",
            password="OldPassword123@",
        )

        call_command(
            "ensure_staff_user",
            username="Jay.Gallagher",
            password="Password123@",
            email="jay.gallagher@recyclrgroup.co.uk",
            first_name="Jay",
            last_name="Gallagher",
            job_title="Founder",
            role="admin",
            superuser=True,
        )

        self.assertEqual(User.objects.count(), 1)
        existing_user.refresh_from_db()
        self.assertEqual(existing_user.username, "Jay.Gallagher")
        self.assertEqual(existing_user.email, "jay.gallagher@recyclrgroup.co.uk")
        self.assertTrue(existing_user.is_staff)
        self.assertTrue(existing_user.is_superuser)
        self.assertTrue(existing_user.check_password("Password123@"))
        self.assertEqual(existing_user.staff_profile.job_title, "Founder")


class CreateStaffUserTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = get_user_model().objects.create_superuser(
            username="Jay.Gallagher",
            email="jay.gallagher@recyclrgroup.co.uk",
            password="Password123@",
            is_staff=True,
        )

    def test_admin_can_create_staff_user(self):
        response = self.client.post(
            "/api/auth/staff/create/",
            {
                "username": "Alex.Driver",
                "password": "TempPass123@",
                "email": "alex.driver@recyclrgroup.co.uk",
                "first_name": "Alex",
                "last_name": "Driver",
                "role": "driver",
                "job_title": "Driver",
                "company_phone": "07000000000",
            },
            format="json",
            HTTP_X_STAFF_USERNAME="Jay.Gallagher",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["success"])

        created_user = get_user_model().objects.get(username="Alex.Driver")
        self.assertTrue(created_user.is_staff)
        self.assertFalse(created_user.is_superuser)
        self.assertTrue(created_user.check_password("TempPass123@"))
        self.assertEqual(created_user.staff_profile.job_title, "Driver")
