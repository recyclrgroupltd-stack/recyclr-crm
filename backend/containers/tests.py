import json

from django.test import Client, TestCase

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
        event = ContainerMaintenanceEvent.objects.get(container=self.container)
        self.assertEqual(event.status, ContainerMaintenanceEvent.STATUS_RESOLVED)
        self.assertEqual(event.notes, "Inspected and repaired.")
        self.assertEqual(event.reported_by, "Jay")
