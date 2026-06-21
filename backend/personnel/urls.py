from django.urls import path

from . import views

urlpatterns = [
    path("", views.personnel_summary, name="personnel-summary"),
    path("documents/", views.documents_collection, name="personnel-documents"),
    path("documents/<int:document_id>/", views.document_detail, name="personnel-document-detail"),
]
