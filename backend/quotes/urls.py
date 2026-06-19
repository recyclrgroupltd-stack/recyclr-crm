from django.urls import path

from .views import (
    accept_quote,
    convert_quote,
    quote_create_from_lead,
    quote_detail,
    quote_document_download,
    quote_documents_list,
    quote_documents_search,
    quote_pdf,
    quote_price_lookup,
    quote_send,
    quotes_list,
)

urlpatterns = [
    path("", quotes_list, name="quotes-list"),
    path("price-lookup/", quote_price_lookup, name="quote-price-lookup"),
    path("<int:quote_id>/", quote_detail, name="quote-detail"),
    path("<int:quote_id>/convert/", convert_quote, name="quote-convert"),
    path("<int:quote_id>/send/", quote_send, name="quote-send"),
    path("<int:quote_id>/accept/", accept_quote, name="quote-accept"),
    path("<int:quote_id>/pdf/", quote_pdf, name="quote-pdf"),
    path("<int:quote_id>/documents/", quote_documents_list, name="quote-documents-list"),
    path("documents/search/", quote_documents_search, name="quote-documents-search"),
    path("documents/<int:document_id>/download/", quote_document_download, name="quote-document-download"),
    path("from-lead/<int:lead_id>/", quote_create_from_lead, name="quote-create-from-lead"),
]
