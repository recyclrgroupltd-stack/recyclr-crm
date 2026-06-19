from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("services", "0005_alter_service_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="service",
            name="notes",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="service",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="service",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending_schedule", "Pending Schedule"),
                    ("active", "Active"),
                    ("paused", "Paused"),
                    ("ended", "Ended"),
                ],
                default="pending_schedule",
                max_length=30,
            ),
        ),
        migrations.AlterModelOptions(
            name="service",
            options={"ordering": ["-id"]},
        ),
    ]
