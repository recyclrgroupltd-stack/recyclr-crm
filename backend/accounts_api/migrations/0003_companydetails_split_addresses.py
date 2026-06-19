from django.db import migrations, models


def migrate_company_addresses(apps, schema_editor):
    CompanyDetails = apps.get_model("accounts_api", "CompanyDetails")
    for details in CompanyDetails.objects.all():
        registered = (getattr(details, "registered_office", "") or "").splitlines()
        trading = (getattr(details, "trading_address", "") or "").splitlines()

        if registered:
            details.registered_address_line_1 = registered[0] if len(registered) > 0 else ""
            details.registered_address_line_2 = registered[1] if len(registered) > 1 else ""
            details.registered_town = registered[2] if len(registered) > 2 else ""
            details.registered_county = registered[3] if len(registered) > 3 else ""
            details.registered_postcode = registered[4] if len(registered) > 4 else ""
            details.registered_country = registered[5] if len(registered) > 5 else details.registered_country

        if trading:
            details.trading_address_line_1 = trading[0] if len(trading) > 0 else ""
            details.trading_address_line_2 = trading[1] if len(trading) > 1 else ""
            details.trading_town = trading[2] if len(trading) > 2 else ""
            details.trading_county = trading[3] if len(trading) > 3 else ""
            details.trading_postcode = trading[4] if len(trading) > 4 else ""
            details.trading_country = trading[5] if len(trading) > 5 else details.trading_country

        details.save()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts_api", "0002_companydetails"),
    ]

    operations = [
        migrations.AddField(
            model_name="companydetails",
            name="registered_address_line_1",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="registered_address_line_2",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="registered_town",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="registered_county",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="registered_postcode",
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="registered_country",
            field=models.CharField(blank=True, default="England", max_length=100),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="trading_address_line_1",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="trading_address_line_2",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="trading_town",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="trading_county",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="trading_postcode",
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="trading_country",
            field=models.CharField(blank=True, default="England", max_length=100),
        ),
        migrations.RunPython(migrate_company_addresses, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="companydetails",
            name="registered_office",
        ),
        migrations.RemoveField(
            model_name="companydetails",
            name="trading_address",
        ),
    ]
