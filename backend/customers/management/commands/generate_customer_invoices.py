from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from customers.models import Customer
from customers.views import _build_invoice_for_customer


class Command(BaseCommand):
    help = "Generate due customer invoices for active customers with automatic invoicing enabled."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show which customers would be invoiced without creating invoices.",
        )

    def handle(self, *args, **options):
        today = timezone.localdate()
        dry_run = options["dry_run"]
        customers = (
            Customer.objects.filter(auto_invoice_enabled=True, status="active")
            .filter(Q(next_invoice_date__isnull=True) | Q(next_invoice_date__lte=today))
            .order_by("business_name", "id")
        )

        generated = 0
        skipped = 0
        for customer in customers:
            if dry_run:
                self.stdout.write(f"Due: {customer.customer_uid or customer.id} - {customer.business_name}")
                continue

            invoice, reason = _build_invoice_for_customer(customer, issue_date=today)
            if invoice:
                generated += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Generated {invoice.invoice_number} for {customer.business_name} ({invoice.status})"
                    )
                )
            else:
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(f"Skipped {customer.business_name}: {reason or 'not invoiceable'}")
                )

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"{customers.count()} customers are due for invoicing."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Generated {generated} invoices. Skipped {skipped}."))
