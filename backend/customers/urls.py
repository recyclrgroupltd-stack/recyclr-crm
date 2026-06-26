from django.urls import path

from .views import (
    customer_detail,
    customer_account_manager_update,
    customer_setup_approve,
    customer_invoice_generate,
    customer_invoices_list,
    customer_notes_create,
    customer_overview,
    customer_portal_bootstrap,
    customer_portal_dashboard,
    customer_portal_document_download,
    customer_portal_invoice_po,
    customer_portal_login,
    customer_portal_request,
    customer_portal_signed_document_download,
    customers_list,
    site_detail,
    sites_list,
)

urlpatterns = [
    path("", customers_list, name="customers-list"),
    path("portal/bootstrap/", customer_portal_bootstrap, name="customer-portal-bootstrap"),
    path("portal/login/", customer_portal_login, name="customer-portal-login"),
    path("portal/dashboard/", customer_portal_dashboard, name="customer-portal-dashboard"),
    path("portal/request/", customer_portal_request, name="customer-portal-request"),
    path("portal/invoice-po/", customer_portal_invoice_po, name="customer-portal-invoice-po"),
    path("portal/documents/<int:document_id>/download/", customer_portal_document_download, name="customer-portal-document-download"),
    path("portal/signed-documents/<int:document_id>/download/", customer_portal_signed_document_download, name="customer-portal-signed-document-download"),
    path("<int:customer_id>/", customer_detail, name="customer-detail"),
    path("<int:customer_id>/overview/", customer_overview, name="customer-overview"),
    path("<int:customer_id>/account-manager/", customer_account_manager_update, name="customer-account-manager-update"),
    path("<int:customer_id>/approve-setup/", customer_setup_approve, name="customer-setup-approve"),
    path("<int:customer_id>/invoices/", customer_invoices_list, name="customer-invoices-list"),
    path("<int:customer_id>/invoices/generate/", customer_invoice_generate, name="customer-invoice-generate"),
    path("<int:customer_id>/notes/create/", customer_notes_create, name="customer-notes-create"),

    path("sites/", sites_list, name="sites-list"),
    path("sites/<int:site_id>/", site_detail, name="site-detail"),
]
