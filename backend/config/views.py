from django.contrib.admin.models import LogEntry, ADDITION, CHANGE, DELETION
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.shortcuts import render


def health_view(request):
    return JsonResponse({"status": "ok", "service": "recyclr-crm-backend"})


@staff_member_required
def admin_actions_view(request):
    User = get_user_model()

    scope = request.GET.get("scope", "my")
    selected_user_id = request.GET.get("user_id", "")

    log_entries = LogEntry.objects.select_related("user", "content_type").order_by("-action_time")

    if selected_user_id:
        log_entries = log_entries.filter(user_id=selected_user_id)
    elif scope == "my":
        log_entries = log_entries.filter(user=request.user)

    users = User.objects.filter(is_staff=True).order_by("username")

    context = {
        "title": "Admin Actions",
        "log_entries": log_entries[:300],
        "users": users,
        "scope": scope,
        "selected_user_id": selected_user_id,
        "ADDITION": ADDITION,
        "CHANGE": CHANGE,
        "DELETION": DELETION,
    }

    return render(request, "admin/custom_actions.html", context)
