from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("hauliers", "0003_portal_users"),
        ("jobs", "0002_job_failure_workflow"),
    ]

    operations = [
        migrations.AddField(
            model_name="job",
            name="status_updated_by_email",
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name="job",
            name="status_updated_source",
            field=models.CharField(
                blank=True,
                choices=[("staff", "Staff"), ("haulier_portal", "Haulier Portal")],
                max_length=30,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="job",
            name="status_updated_by_portal_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="updated_jobs",
                to="hauliers.haulierportaluser",
            ),
        ),
    ]