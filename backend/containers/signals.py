from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from services.models import Service

from .models import Container


@receiver(post_save, sender=Service)
def auto_assign_containers_for_new_service(sender, instance, created, **kwargs):
    if not created:
        return

    needed = int(getattr(instance, "bin_count", 0) or 0)
    if needed < 1:
        return

    containers = list(
        Container.objects.filter(
            status=Container.STATUS_INACTIVE,
            waste_stream=getattr(instance, "waste_type", ""),
            bin_size=getattr(instance, "bin_size", ""),
        ).order_by("created_at", "id")[:needed]
    )

    if not containers:
        return

    now = timezone.now()
    for container in containers:
        container.site = instance.site
        container.service = instance
        container.status = Container.STATUS_ASSIGNED
        container.assigned_at = now
        container.save()
