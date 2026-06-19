from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('customers', '0004_customer_billing_address_line_1_and_more'),
        ('leads', '0009_lead_address_line_1_lead_address_line_2_lead_county_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Quote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quote_number', models.CharField(blank=True, max_length=30, unique=True)),
                ('title', models.CharField(blank=True, max_length=255)),
                ('contact_name', models.CharField(blank=True, max_length=255)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('sent', 'Sent'), ('accepted', 'Accepted'), ('declined', 'Declined'), ('expired', 'Expired')], default='draft', max_length=20)),
                ('valid_until', models.DateField(blank=True, null=True)),
                ('subtotal_per_month', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('bin_rental_per_month', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('total_per_month', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('notes', models.TextField(blank=True)),
                ('internal_notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('customer', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='quotes', to='customers.customer')),
                ('lead', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='quotes', to='leads.lead')),
                ('site', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='quotes', to='customers.site')),
            ],
            options={
                'ordering': ['-id'],
            },
        ),
        migrations.CreateModel(
            name='QuoteLine',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('waste_type', models.CharField(choices=[('general', 'General Waste'), ('mixed_recycling', 'Mixed Recycling'), ('glass', 'Glass'), ('food', 'Food')], max_length=20)),
                ('bin_size', models.CharField(choices=[('240', '240L'), ('360', '360L'), ('660', '660L'), ('1100', '1100L')], max_length=10)),
                ('bin_count', models.PositiveIntegerField(default=1)),
                ('collections_per_week', models.PositiveIntegerField(default=1)),
                ('price_per_lift', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('rental_per_day', models.DecimalField(decimal_places=2, default=Decimal('0.25'), max_digits=10)),
                ('collection_charge_per_month', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('bin_rental_per_month', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('line_total_per_month', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('quote', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lines', to='quotes.quote')),
            ],
            options={
                'ordering': ['sort_order', 'id'],
            },
        ),
    ]