from django.conf import settings
from django.db import models


class MailFolder(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mail_folders")
    name = models.CharField(max_length=100)
    imap_name = models.CharField(max_length=150)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("user", "name")

    def __str__(self):
        return f"{self.user.username} - {self.name}"


class MailRule(models.Model):
    FIELD_CHOICES = [
        ("from", "From"),
        ("to", "To"),
        ("subject", "Subject"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mail_rules")
    name = models.CharField(max_length=120)
    field = models.CharField(max_length=20, choices=FIELD_CHOICES, default="from")
    contains = models.CharField(max_length=200)
    target_folder = models.CharField(max_length=150)
    mark_read = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.user.username} - {self.name}"
