from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from accounts_api.views import require_permission

from .models import AIInteractionLog
from .services import collect_readiness_insights, get_ai_status, run_ai_assistant


@api_view(["GET"])
def ai_status_view(request):
    _, error_response = require_permission(request, "ai.view", "You do not have permission to view Recyclr AI.")
    if error_response:
        return error_response

    return Response(
        {
            "success": True,
            "ai": get_ai_status(),
            "insights": collect_readiness_insights(),
        }
    )


@api_view(["POST"])
def ai_assist_view(request):
    user, error_response = require_permission(request, "ai.use", "You do not have permission to use Recyclr AI.")
    if error_response:
        return error_response

    prompt = str(request.data.get("prompt") or "").strip()
    if not prompt:
        return Response(
            {"success": False, "message": "Prompt is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    context_id = request.data.get("context_id")
    try:
        context_id = int(context_id) if context_id not in (None, "") else None
    except (TypeError, ValueError):
        context_id = None

    result = run_ai_assistant(
        user=user,
        prompt=prompt,
        context_type=str(request.data.get("context_type") or ""),
        context_id=context_id,
        intent=str(request.data.get("intent") or "general"),
    )
    response_status = status.HTTP_200_OK if result.get("success") else status.HTTP_403_FORBIDDEN
    return Response(result, status=response_status)


@api_view(["GET"])
def ai_logs_view(request):
    _, error_response = require_permission(request, "ai.view", "You do not have permission to view Recyclr AI logs.")
    if error_response:
        return error_response

    logs = AIInteractionLog.objects.select_related("user")[:50]
    return Response(
        {
            "success": True,
            "logs": [
                {
                    "id": log.id,
                    "created_at": log.created_at.isoformat(),
                    "user": log.user.username if log.user_id else "",
                    "provider": log.provider,
                    "model": log.model,
                    "context_type": log.context_type,
                    "context_id": log.context_id,
                    "intent": log.intent,
                    "status": log.status,
                    "estimated_cost_gbp": str(log.estimated_cost_gbp),
                }
                for log in logs
            ],
        }
    )
