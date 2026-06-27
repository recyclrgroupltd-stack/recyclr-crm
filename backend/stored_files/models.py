from django.db import models


class StoredFile(models.Model):
    name = models.CharField(max_length=500, unique=True, db_index=True)
    content = models.BinaryField()
    content_type = models.CharField(max_length=120, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
