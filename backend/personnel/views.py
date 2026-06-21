from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework import status

from accounts_api.views import require_permission, serialize_user

from .models import PersonnelDocument

User = get_user_model()


def _document_url(document):
    return document.file.url if document.file else ""


def serialize_document(document):
    return {
        "id": document.id,
        "staff_user_id": document.staff_user_id,
        "staff_name": document.staff_user.get_full_name() or document.staff_user.username,
        "staff_username": document.staff_user.username,
        "category": document.category,
        "category_label": document.get_category_display(),
        "title": document.title,
        "status": document.status,
        "status_label": document.get_status_display(),
        "expiry_date": document.expiry_date.isoformat() if document.expiry_date else "",
        "notes": document.notes,
        "file_url": _document_url(document),
        "filename": document.filename(),
        "uploaded_by": document.uploaded_by.get_full_name() or document.uploaded_by.username if document.uploaded_by else "",
        "created_at": document.created_at.isoformat() if document.created_at else "",
        "updated_at": document.updated_at.isoformat() if document.updated_at else "",
    }


def _category_choices():
    return [{"value": value, "label": label} for value, label in PersonnelDocument.CATEGORY_CHOICES]


def _status_choices():
    return [{"value": value, "label": label} for value, label in PersonnelDocument.STATUS_CHOICES]


def _staff_rows():
    return [
        serialize_user(user)
        for user in User.objects.filter(is_staff=True)
        .prefetch_related("groups", "permission_overrides")
        .select_related("staff_profile")
        .order_by("first_name", "last_name", "username")
    ]


@api_view(["GET"])
def personnel_summary(request):
    _, error_response = require_permission(
        request,
        "staff.manage",
        "Only staff managers can view personnel files.",
    )
    if error_response:
        return error_response

    documents = PersonnelDocument.objects.select_related("staff_user", "uploaded_by")
    counts = dict(documents.values_list("status").annotate(total=Count("id")))

    return Response(
        {
            "success": True,
            "staff": _staff_rows(),
            "documents": [serialize_document(document) for document in documents[:250]],
            "categories": _category_choices(),
            "statuses": _status_choices(),
            "summary": {
                "total_documents": documents.count(),
                "needed": counts.get("needed", 0),
                "requested": counts.get("requested", 0),
                "received": counts.get("received", 0),
                "approved": counts.get("approved", 0),
                "expired": counts.get("expired", 0),
            },
        }
    )


@api_view(["GET", "POST"])
@parser_classes([MultiPartParser, FormParser])
def documents_collection(request):
    current_user, error_response = require_permission(
        request,
        "staff.manage",
        "Only staff managers can manage personnel documents.",
    )
    if error_response:
        return error_response

    if request.method == "GET":
        documents = PersonnelDocument.objects.select_related("staff_user", "uploaded_by")
        search = request.GET.get("search", "").strip()
        staff_user_id = request.GET.get("staff_user_id", "").strip()
        category = request.GET.get("category", "").strip()
        document_status = request.GET.get("status", "").strip()

        if search:
            documents = documents.filter(
                Q(title__icontains=search)
                | Q(notes__icontains=search)
                | Q(staff_user__username__icontains=search)
                | Q(staff_user__first_name__icontains=search)
                | Q(staff_user__last_name__icontains=search)
            )
        if staff_user_id:
            documents = documents.filter(staff_user_id=staff_user_id)
        if category and category != "all":
            documents = documents.filter(category=category)
        if document_status and document_status != "all":
            documents = documents.filter(status=document_status)

        return Response({"success": True, "documents": [serialize_document(document) for document in documents[:250]]})

    staff_user_id = request.data.get("staff_user_id")
    staff_user = User.objects.filter(pk=staff_user_id, is_staff=True).first()
    if not staff_user:
        return Response({"success": False, "message": "Choose a valid staff member."}, status=status.HTTP_400_BAD_REQUEST)

    title = str(request.data.get("title", "")).strip()
    if not title:
        return Response({"success": False, "message": "Document title is required."}, status=status.HTTP_400_BAD_REQUEST)

    document = PersonnelDocument.objects.create(
        staff_user=staff_user,
        uploaded_by=current_user,
        title=title,
        category=request.data.get("category") or "other",
        status=request.data.get("status") or "needed",
        expiry_date=request.data.get("expiry_date") or None,
        notes=request.data.get("notes", ""),
        file=request.FILES.get("file"),
    )

    return Response({"success": True, "document": serialize_document(document)}, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@parser_classes([MultiPartParser, FormParser])
def document_detail(request, document_id):
    current_user, error_response = require_permission(
        request,
        "staff.manage",
        "Only staff managers can manage personnel documents.",
    )
    if error_response:
        return error_response

    document = PersonnelDocument.objects.select_related("staff_user", "uploaded_by").filter(pk=document_id).first()
    if not document:
        return Response({"success": False, "message": "Personnel document not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        document.delete()
        return Response({"success": True})

    if "staff_user_id" in request.data:
        staff_user = User.objects.filter(pk=request.data.get("staff_user_id"), is_staff=True).first()
        if staff_user:
            document.staff_user = staff_user
    for field in ["title", "category", "status", "notes"]:
        if field in request.data:
            setattr(document, field, request.data.get(field, ""))
    if "expiry_date" in request.data:
        document.expiry_date = request.data.get("expiry_date") or None
    if request.FILES.get("file"):
        document.file = request.FILES["file"]
        document.uploaded_by = current_user
    document.save()

    return Response({"success": True, "document": serialize_document(document)})
