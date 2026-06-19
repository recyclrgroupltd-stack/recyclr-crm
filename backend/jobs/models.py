from django.db import models
from customers.models import Customer, Site
from services.models import Service


class Job(models.Model):
    STATUS_CHOICES = [
        ("scheduled", "Scheduled"),
        ("collected", "Collected"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]

    FAILURE_REASONS = [
        ("blocked_access", "Blocked Access"),
        ("not_presented", "Bin Not Presented"),
        ("contaminated", "Contaminated"),
        ("overweight", "Overweight"),
        ("closed", "Site Closed"),
        ("other", "Other"),
    ]

    STATUS_SOURCE_CHOICES = [
        ("staff", "Staff"),
        ("haulier_portal", "Haulier Portal"),
    ]

    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="jobs")
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    site = models.ForeignKey(Site, on_delete=models.CASCADE)

    collection_date = models.DateField()

    waste_type = models.CharField(max_length=100)
    bin_size = models.CharField(max_length=50)
    bin_quantity = models.IntegerField()

    haulier = models.CharField(max_length=255, blank=True, null=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="scheduled")
    failure_reason = models.CharField(max_length=50, choices=FAILURE_REASONS, blank=True, null=True)
    failure_notes = models.TextField(blank=True, null=True)
    evidence_image = models.ImageField(upload_to="job_evidence/", blank=True, null=True)
    rescheduled_to = models.DateField(blank=True, null=True)

    notes = models.TextField(blank=True, null=True)

    status_updated_by = models.CharField(max_length=255, blank=True, null=True)
    status_updated_by_email = models.EmailField(blank=True, null=True)
    status_updated_source = models.CharField(
        max_length=30,
        choices=STATUS_SOURCE_CHOICES,
        blank=True,
        null=True,
    )
    status_updated_by_portal_user = models.ForeignKey(
        "hauliers.HaulierPortalUser",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="updated_jobs",
    )
    status_updated_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.customer} - {self.collection_date} - {self.waste_type}"