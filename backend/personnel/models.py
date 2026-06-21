from django.conf import settings
from django.db import models


def personnel_document_upload_to(instance, filename):
    return f"personnel/{instance.staff_user_id}/{filename}"


class PersonnelDocument(models.Model):
    CATEGORY_CHOICES = [
        ("contract", "Employment Contract"),
        ("right_to_work", "Right to Work"),
        ("id", "ID / Proof of Address"),
        ("handbook", "Handbook / Policy Sign-off"),
        ("training", "Training Record"),
        ("licence", "Licence / Certificate"),
        ("disciplinary", "Disciplinary / HR Note"),
        ("other", "Other"),
    ]

    STATUS_CHOICES = [
        ("needed", "Needed"),
        ("requested", "Requested"),
        ("received", "Received"),
        ("approved", "Approved"),
        ("expired", "Expired"),
    ]

    staff_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="personnel_documents",
    )
    category = models.CharField(max_length=40, choices=CATEGORY_CHOICES, default="other")
    title = models.CharField(max_length=180)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="needed")
    expiry_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    file = models.FileField(upload_to=personnel_document_upload_to, null=True, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_personnel_documents",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["staff_user__first_name", "staff_user__last_name", "staff_user__username", "category", "title"]

    def __str__(self):
        return f"{self.staff_user} - {self.title}"

    def filename(self):
        return self.file.name.split("/")[-1] if self.file else ""
