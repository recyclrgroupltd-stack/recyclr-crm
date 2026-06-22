from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.db import migrations
from django.utils import timezone


TEST_EMAIL = "portal.test@recyclrgroup.co.uk"
TEST_PASSWORD = "RecyclrTest2026!"


def create_portal_test_customer(apps, schema_editor):
    Customer = apps.get_model("customers", "Customer")
    Site = apps.get_model("customers", "Site")
    Service = apps.get_model("services", "Service")
    Job = apps.get_model("jobs", "Job")

    customer, _ = Customer.objects.update_or_create(
        email=TEST_EMAIL,
        defaults={
            "business_name": "Recyclr Portal Test Customer",
            "contact_name": "Portal Tester",
            "phone": "07511 050688",
            "status": "active",
            "notes": "Live test customer for checking the customer portal.",
            "address_line_1": "Test Customer Yard",
            "town": "Birmingham",
            "county": "West Midlands",
            "postcode": "B1 1AA",
            "portal_enabled": True,
            "portal_password_hash": make_password(TEST_PASSWORD),
            "invoice_email": TEST_EMAIL,
            "invoice_payment_terms_days": 30,
            "auto_invoice_enabled": False,
        },
    )

    site, _ = Site.objects.update_or_create(
        customer=customer,
        site_name="Portal Test Site",
        defaults={
            "address_line_1": "Unit 1 Test Trading Estate",
            "town": "Birmingham",
            "county": "West Midlands",
            "postcode": "B1 1AA",
        },
    )

    service, _ = Service.objects.update_or_create(
        customer=customer,
        site=site,
        waste_type="general",
        bin_size="240",
        defaults={
            "bin_count": 2,
            "collections_per_week": 1,
            "status": "active",
            "schedule_type": "weekly",
            "collection_days": ["monday"],
            "schedule_start_date": timezone.localdate(),
            "notes": "Demo service for live portal testing.",
        },
    )

    Job.objects.update_or_create(
        service=service,
        customer=customer,
        site=site,
        collection_date=timezone.localdate() + timedelta(days=7),
        defaults={
            "waste_type": "general",
            "bin_size": "240",
            "bin_quantity": 2,
            "status": "scheduled",
            "notes": "Demo upcoming collection for customer portal testing.",
        },
    )


def remove_portal_test_customer(apps, schema_editor):
    Customer = apps.get_model("customers", "Customer")
    Customer.objects.filter(email=TEST_EMAIL).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0011_customer_portal_login"),
        ("services", "0007_alter_service_updated_at"),
        ("jobs", "0003_job_portal_audit_fields"),
    ]

    operations = [
        migrations.RunPython(create_portal_test_customer, remove_portal_test_customer),
    ]
