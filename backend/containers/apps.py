from django.apps import AppConfig


class ContainersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "containers"

    def ready(self):
        from . import signals  # noqa: F401
