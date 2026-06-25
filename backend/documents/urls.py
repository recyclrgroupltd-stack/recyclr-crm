from django.urls import path

from .views import (
    generated_document_download,
    get_customer_documents,
    public_signing_pack,
    public_signing_pack_submit,
    signed_document_download,
    signing_pack_cancel,
    signing_pack_create,
    signing_pack_list,
    signing_pack_send,
)

urlpatterns = [
    path("customer/<int:customer_id>/", get_customer_documents, name="get_customer_documents"),
    path("generated-documents/<int:document_id>/download/", generated_document_download, name="generated_document_download"),
    path("signing-packs/", signing_pack_list, name="signing_pack_list"),
    path("signing-packs/create/", signing_pack_create, name="signing_pack_create"),
    path("signing-packs/<int:pack_id>/send/", signing_pack_send, name="signing_pack_send"),
    path("signing-packs/<int:pack_id>/cancel/", signing_pack_cancel, name="signing_pack_cancel"),
    path("signing-packs/public/<str:token>/", public_signing_pack, name="public_signing_pack"),
    path("signing-packs/public/<str:token>/submit/", public_signing_pack_submit, name="public_signing_pack_submit"),
    path("signing-packs/signed-documents/<int:document_id>/download/", signed_document_download, name="signed_document_download"),
]
