from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from .models import StaffProfile


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
        self.assertTrue(existing_user.check_password("OldPassword123@"))
        self.assertEqual(existing_user.staff_profile.job_title, "Founder")

    def test_command_can_intentionally_reset_existing_password(self):
        User = get_user_model()
        existing_user = User.objects.create_user(
            username="Jay.Gallagher",
            email="jay.gallagher@recyclrgroup.co.uk",
            password="OldPassword123@",
        )

        call_command(
            "ensure_staff_user",
            username="Jay.Gallagher",
            password="Password123@",
            email="jay.gallagher@recyclrgroup.co.uk",
            role="admin",
            superuser=True,
            reset_password=True,
        )

        existing_user.refresh_from_db()
        self.assertTrue(existing_user.check_password("Password123@"))


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

    def test_admin_can_deactivate_staff_user(self):
        target_user = get_user_model().objects.create_user(
            username="Admin",
            email="admin@recyclrgroup.co.uk",
            password="AdminPass123@",
            is_staff=True,
            is_active=True,
        )

        response = self.client.post(
            f"/api/auth/staff/{target_user.id}/active/",
            {"is_active": False},
            format="json",
            HTTP_X_STAFF_USERNAME="Jay.Gallagher",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        target_user.refresh_from_db()
        self.assertFalse(target_user.is_active)

    def test_admin_can_reset_staff_password(self):
        target_user = get_user_model().objects.create_user(
            username="Alex.Driver",
            email="alex.driver@recyclrgroup.co.uk",
            password="OldPass123@",
            is_staff=True,
            is_active=True,
        )

        response = self.client.post(
            f"/api/auth/staff/{target_user.id}/password/",
            {"password": "NewPass123@"},
            format="json",
            HTTP_X_STAFF_USERNAME="Jay.Gallagher",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        target_user.refresh_from_db()
        self.assertTrue(target_user.check_password("NewPass123@"))

    def test_admin_can_reset_own_staff_password_from_staff_screen(self):
        response = self.client.post(
            f"/api/auth/staff/{self.admin.id}/password/",
            {"password": "NewOwnerPass123@"},
            format="json",
            HTTP_X_STAFF_USERNAME="Jay.Gallagher",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password("NewOwnerPass123@"))

    def test_admin_can_delete_staff_user(self):
        target_user = get_user_model().objects.create_user(
            username="Temp.Admin",
            email="temp.admin@recyclrgroup.co.uk",
            password="TempPass123@",
            is_staff=True,
            is_active=True,
        )

        response = self.client.delete(
            f"/api/auth/staff/{target_user.id}/delete/",
            HTTP_X_STAFF_USERNAME="Jay.Gallagher",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        target_user.refresh_from_db()
        self.assertFalse(target_user.is_staff)
        self.assertFalse(target_user.is_active)
        self.assertFalse(target_user.is_superuser)
        self.assertTrue(target_user.username.startswith(f"deleted-{target_user.id}-"))

        list_response = self.client.get(
            "/api/auth/staff/",
            HTTP_X_STAFF_USERNAME="Jay.Gallagher",
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertNotIn(target_user.id, [user["id"] for user in list_response.data["staff"]])
