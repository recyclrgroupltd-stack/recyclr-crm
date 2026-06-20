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
        self.assertTrue(existing_user.check_password("Password123@"))
        self.assertEqual(existing_user.staff_profile.job_title, "Founder")
