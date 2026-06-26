import json
from datetime import date
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase

from accounts_api.models import StaffProfile
from accounts_api.views import create_staff_auth_token
from containers.models import ContainerMovement
from pricing.models import PriceBookItem
from services.models import Service

from .models import Customer
from .views import _build_invoice_for_customer


User = get_user_model()


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


class CustomerInvoiceFlowTests(TestCase):
    def setUp(self):
        PriceBookItem.objects.create(
            waste_type="general",
            bin_size="240",
            price_per_lift=Decimal("10.00"),
            rental_per_day=Decimal("0.00"),
        )
        self.customer = Customer.objects.create(
            business_name="Oak Street Cafe",
            contact_name="Aisha Khan",
            email="accounts@oakstreet.example",
            invoice_requires_po=True,
            invoice_payment_terms_days=14,
            invoice_cycle_start_date=date(2026, 7, 1),
            next_invoice_date=date(2026, 7, 15),
        )
        self.site = self.customer.sites.create(site_name="Oak Street Cafe")
        Service.objects.create(
            customer=self.customer,
            site=self.site,
            waste_type="general",
            bin_size="240",
            bin_count=1,
            collections_per_week=1,
            status=Service.STATUS_ACTIVE,
            schedule_start_date=date(2026, 7, 1),
            collection_days=["monday"],
        )

    def test_po_required_blocks_invoice_until_po_supplied(self):
        invoice, reason = _build_invoice_for_customer(self.customer, issue_date=date(2026, 7, 15))

        self.assertIsNone(invoice)
        self.assertIn("PO number is required", reason)

        self.customer.invoice_po_number = "PO-777"
        self.customer.save(update_fields=["invoice_po_number"])

        invoice, reason = _build_invoice_for_customer(self.customer, issue_date=date(2026, 7, 15))

        self.assertIsNotNone(invoice)
        self.assertEqual(reason, "")
        self.assertEqual(invoice.po_number, "PO-777")
        self.assertEqual(invoice.period_start, date(2026, 7, 1))
        self.assertEqual(invoice.period_end, date(2026, 7, 15))

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.invoice_po_number, "")
        self.assertEqual(self.customer.next_invoice_date, date(2026, 7, 29))


class CustomerSetupApprovalTests(TestCase):
    def setUp(self):
        PriceBookItem.objects.create(
            waste_type="general",
            bin_size="240",
            price_per_lift=Decimal("10.00"),
            rental_per_day=Decimal("0.00"),
        )
        self.manager = User.objects.create_user(username="Manager.One", password="Pass12345", is_staff=True)
        StaffProfile.objects.create(user=self.manager)
        self.manager.groups.add(Group.objects.create(name="Manager"))
        self.customer = Customer.objects.create(
            business_name="Aylestone Bakery",
            contact_name="Sam Harper",
            email="accounts@aylestonebakery.example",
            status="setup_approval",
            account_manager=self.manager,
        )
        self.site = self.customer.sites.create(site_name="Aylestone Bakery")
        self.service = Service.objects.create(
            customer=self.customer,
            site=self.site,
            waste_type="general",
            bin_size="240",
            bin_count=2,
            collections_per_week=1,
            status=Service.STATUS_PENDING_SCHEDULE,
            schedule_start_date=date(2026, 7, 10),
        )

    def test_account_manager_approval_schedules_delivery_movement(self):
        response = self.client.post(
            f"/api/customers/{self.customer.id}/approve-setup/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {create_staff_auth_token(self.manager)}",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["delivery_movements_created"], 1)

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.status, "onboarding")

        movement = ContainerMovement.objects.get(service=self.service)
        self.assertEqual(movement.movement_type, ContainerMovement.TYPE_DELIVERY)
        self.assertEqual(movement.quantity, 2)
        self.assertEqual(movement.scheduled_date, date(2026, 7, 8))
