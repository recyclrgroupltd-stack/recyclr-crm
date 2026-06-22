import json

from django.contrib.auth.hashers import make_password
from django.test import TestCase

from .models import Customer


class CustomerPortalLoginTests(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(
            business_name="Acme Waste",
            contact_name="Alex Customer",
            email="alex@example.com",
            portal_enabled=True,
            portal_password_hash=make_password("PortalPass123"),
        )

    def test_customer_can_login_with_email_and_password(self):
        response = self.client.post(
            "/api/customers/portal/login/",
            data=json.dumps({"email": "alex@example.com", "password": "PortalPass123"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertIn("token", payload)
        self.assertEqual(payload["customer"]["business_name"], "Acme Waste")

    def test_customer_cannot_login_with_old_customer_id_only_flow(self):
        response = self.client.post(
            "/api/customers/portal/login/",
            data=json.dumps({"customer_uid": self.customer.customer_uid, "email": "alex@example.com"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])

    def test_disabled_customer_portal_cannot_login(self):
        self.customer.portal_enabled = False
        self.customer.save(update_fields=["portal_enabled"])

        response = self.client.post(
            "/api/customers/portal/login/",
            data=json.dumps({"email": "alex@example.com", "password": "PortalPass123"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])
