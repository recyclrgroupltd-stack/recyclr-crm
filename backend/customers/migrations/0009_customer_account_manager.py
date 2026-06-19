from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("customers", "0008_customer_customer_uid"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="account_manager",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="managed_customers",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
