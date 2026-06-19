from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("jobs", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="job",
            name="failure_notes",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="job",
            name="evidence_image",
            field=models.ImageField(blank=True, null=True, upload_to="job_evidence/"),
        ),
        migrations.AddField(
            model_name="job",
            name="rescheduled_to",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="job",
            name="status_updated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="job",
            name="status_updated_by",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]