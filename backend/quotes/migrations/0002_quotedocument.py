from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("quotes", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="QuoteDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="")),
                ("version_number", models.PositiveIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("file_size_bytes", models.PositiveIntegerField(default=0)),
                ("notes", models.CharField(blank=True, max_length=255)),
                (
                    "quote",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="documents",
                        to="quotes.quote",
                    ),
                ),
            ],
            options={
                "ordering": ["-version_number", "-created_at"],
                "unique_together": {("quote", "version_number")},
            },
        ),
    ]