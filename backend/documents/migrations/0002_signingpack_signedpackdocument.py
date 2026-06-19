import django.db.models.deletion
import documents.models
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0007_customer_sic_code"),
        ("documents", "0001_initial"),
        ("quotes", "0005_quote_contract_start_date_alter_quote_address_line_1_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SigningPack",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(blank=True, max_length=80, unique=True)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("ready", "Ready to Send"), ("sent", "Sent"), ("viewed", "Viewed"), ("part_signed", "Part Signed"), ("signed", "Signed"), ("expired", "Expired"), ("cancelled", "Cancelled")], default="draft", max_length=20)),
                ("signer_name", models.CharField(blank=True, max_length=255)),
                ("signer_email", models.EmailField(blank=True, max_length=254)),
                ("message", models.TextField(blank=True)),
                ("acceptance_terms", models.BooleanField(default=False)),
                ("acceptance_authority", models.BooleanField(default=False)),
                ("acceptance_documents", models.BooleanField(default=False)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("viewed_at", models.DateTimeField(blank=True, null=True)),
                ("signed_at", models.DateTimeField(blank=True, null=True)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("cancelled_at", models.DateTimeField(blank=True, null=True)),
                ("signed_name", models.CharField(blank=True, max_length=255)),
                ("signed_email", models.EmailField(blank=True, max_length=254)),
                ("signed_ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("signed_user_agent", models.TextField(blank=True)),
                ("viewed_ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("viewed_user_agent", models.TextField(blank=True)),
                ("signature_image", models.ImageField(blank=True, null=True, upload_to=documents.models.signing_signature_upload_to)),
                ("audit_summary", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_signing_packs", to=settings.AUTH_USER_MODEL)),
                ("customer", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="signing_packs", to="customers.customer")),
                ("documents", models.ManyToManyField(blank=True, related_name="signing_packs", to="documents.generateddocument")),
                ("quote", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="signing_packs", to="quotes.quote")),
                ("site", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="signing_packs", to="customers.site")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="SignedPackDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("file", models.FileField(upload_to=documents.models.signed_document_upload_to)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("pack", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="signed_documents", to="documents.signingpack")),
                ("source_document", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="signed_pack_copies", to="documents.generateddocument")),
            ],
            options={"ordering": ["title", "id"]},
        ),
    ]
