from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts_api", "0003_companydetails_split_addresses"),
    ]

    operations = [
        migrations.AddField(
            model_name="companydetails",
            name="company_logo_data",
            field=models.TextField(blank=True),
        ),
    ]
