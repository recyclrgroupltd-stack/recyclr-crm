from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts_api", "0012_companydetails_company_email_domain_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="companydetails",
            name="sales_offer_margin_1_percent",
            field=models.DecimalField(decimal_places=2, default=35, max_digits=6),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="sales_offer_margin_2_percent",
            field=models.DecimalField(decimal_places=2, default=30, max_digits=6),
        ),
        migrations.AddField(
            model_name="companydetails",
            name="sales_offer_margin_3_percent",
            field=models.DecimalField(decimal_places=2, default=25, max_digits=6),
        ),
    ]
