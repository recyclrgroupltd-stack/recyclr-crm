import json

from django.test import Client, TestCase

from customers.models import Customer, create_customer_activity

from .models import Container, ContainerMaintenanceEvent


class ContainerLifecycleTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.container = Container.objects.create(
            bin_size="240",
            waste_stream="general",
            status=Container.STATUS_EOL,
        )

    def post_container(self, payload):
        return self.client.post(
            f"/api/containers/{self.container.id}/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_STAFF_USERNAME="Jay",
        )

    def test_eol_container_serializes_as_eol_location(self):
        response = self.client.get(f"/api/containers/{self.container.id}/")

        self.assertEqual(response.status_code, 200)
        data = response.json()["container"]
        self.assertEqual(data["status"], Container.STATUS_EOL)
        self.assertEqual(data["location_label"], "EOL")
        self.assertEqual(data["location_detail"], "End of life")

    def test_eol_container_requires_reason_before_reactivation(self):
        response = self.post_container({"status": Container.STATUS_INACTIVE})

        self.assertEqual(response.status_code, 400)
        self.assertIn("reason", response.json()["message"].lower())
        self.container.refresh_from_db()
        self.assertEqual(self.container.status, Container.STATUS_EOL)

    def test_eol_reactivation_reason_is_saved_to_history(self):
        response = self.post_container(
            {
                "status": Container.STATUS_INACTIVE,
                "eol_reactivation_reason": "Inspected and repaired.",
            }
        )

        self.assertEqual(response.status_code, 200)
        self.container.refresh_from_db()
        self.assertEqual(self.container.status, Container.STATUS_INACTIVE)
        self.assertIsNone(self.container.eol_at)
        event = ContainerMaintenanceEvent.objects.get(container=self.container)
        self.assertEqual(event.status, ContainerMaintenanceEvent.STATUS_RESOLVED)
        self.assertEqual(event.notes, "Inspected and repaired.")
        self.assertEqual(event.reported_by, "Jay")
        data = response.json()["container"]
        self.assertEqual(data["eol_at"], "")
        self.assertEqual(data["history"][0]["notes"], "Inspected and repaired.")

    def test_global_change_log_includes_container_and_customer_activity(self):
        ContainerMaintenanceEvent.objects.create(
            container=self.container,
            status=ContainerMaintenanceEvent.STATUS_EOL,
            title="Marked EOL",
            notes="Cracked body.",
            reported_by="Jay",
        )
        customer = Customer.objects.create(business_name="Acme Ltd")
        create_customer_activity(
            customer=customer,
            activity_type="note",
            title="Customer note added",
            description="Called about extra bins.",
            created_by="Ian",
        )

        response = self.client.get("/api/containers/change-log/")

        self.assertEqual(response.status_code, 200)
        rows = response.json()["rows"]
        self.assertTrue(any(row["source"] == "container" and row["description"] == "Cracked body." for row in rows))
        self.assertTrue(any(row["source"] == "customer" and row["object_label"] == "Acme Ltd" for row in rows))

    def test_movements_list_returns_json_when_empty(self):
        response = self.client.get("/api/containers/movements/", HTTP_X_STAFF_USERNAME="Jay")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["rows"], [])
        self.assertIn("movement_types", data)
        self.assertIn("movement_statuses", data)
