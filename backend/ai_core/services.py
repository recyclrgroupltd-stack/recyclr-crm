from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.utils import timezone

from .models import AIInteractionLog


DISABLED_MESSAGE = (
    "Recyclr AI is installed and wired for OpenAI, but it is disabled. "
    "Set RECYCLR_AI_ENABLED=true when you are ready to go live with AI."
)


def _money_setting(value):
    try:
        return str(Decimal(str(value or "0")))
    except InvalidOperation:
        return "0"


def ai_enabled():
    return bool(getattr(settings, "RECYCLR_AI_ENABLED", False))


def get_ai_status():
    enabled = ai_enabled()
    provider = getattr(settings, "RECYCLR_AI_PROVIDER", "openai") or "openai"
    model = getattr(settings, "RECYCLR_AI_MODEL", "") or "Not selected yet"
    return {
        "enabled": enabled,
        "mode": "live" if enabled else "disabled",
        "provider": provider,
        "model": model,
        "monthly_spend_limit_gbp": _money_setting(getattr(settings, "RECYCLR_AI_MONTHLY_SPEND_LIMIT_GBP", "0")),
        "capabilities": [
            "Answer staff questions using approved CRM context",
            "Spot operational issues before they become missed collections",
            "Help sales with lead follow-up, quote wording, and customer summaries",
            "Prepare route-planning intelligence for future bin trucks",
            "Support customer-service replies without exposing unrestricted database access",
        ],
        "guardrails": [
            "Disabled by default, so no OpenAI cost or data transfer until switched on",
            "Uses staff permissions before returning CRM context",
            "Logs every AI request with provider, user, context, and cost placeholders",
            "Keeps API keys in Render environment variables only",
            "Designed to send compact CRM summaries, not raw database dumps",
        ],
    }


def collect_readiness_insights():
    from containers.models import ContainerMaintenanceEvent, ContainerMovement
    from documents.models import SigningPack
    from jobs.models import Job
    from quotes.models import Quote
    from services.models import Service

    today = timezone.localdate()
    week_ahead = today + timedelta(days=7)

    pending_schedule = Service.objects.filter(status=Service.STATUS_PENDING_SCHEDULE).count()
    overdue_jobs = Job.objects.filter(collection_date__lt=today, status="scheduled").count()
    expiring_quotes = Quote.objects.filter(status__in=["draft", "sent"], valid_until__range=[today, week_ahead]).count()
    open_maintenance = ContainerMaintenanceEvent.objects.exclude(
        status__in=[ContainerMaintenanceEvent.STATUS_RESOLVED, ContainerMaintenanceEvent.STATUS_EOL]
    ).count()
    due_movements = ContainerMovement.objects.filter(
        status=ContainerMovement.STATUS_SCHEDULED,
        scheduled_date__lte=week_ahead,
    ).count()
    unsigned_packs = SigningPack.objects.filter(status__in=["ready", "sent", "viewed", "part_signed"]).count()

    return [
        {
            "severity": "high" if overdue_jobs else "ok",
            "title": "Overdue collection jobs",
            "count": overdue_jobs,
            "detail": "Scheduled jobs before today that still need an outcome.",
            "href": "/jobs",
        },
        {
            "severity": "medium" if pending_schedule else "ok",
            "title": "Services waiting for schedules",
            "count": pending_schedule,
            "detail": "Services that are not fully live because collection details are missing.",
            "href": "/services",
        },
        {
            "severity": "medium" if due_movements else "ok",
            "title": "Bin movements due soon",
            "count": due_movements,
            "detail": "Deliveries, collections, or replacements scheduled in the next seven days.",
            "href": "/containers/movements",
        },
        {
            "severity": "medium" if expiring_quotes else "ok",
            "title": "Quotes expiring this week",
            "count": expiring_quotes,
            "detail": "Draft or sent quotes with validity ending soon.",
            "href": "/quotes",
        },
        {
            "severity": "medium" if unsigned_packs else "ok",
            "title": "Signing packs awaiting action",
            "count": unsigned_packs,
            "detail": "Customer signing links not completed yet.",
            "href": "/contract-signing",
        },
        {
            "severity": "medium" if open_maintenance else "ok",
            "title": "Open container maintenance",
            "count": open_maintenance,
            "detail": "Container issues not yet resolved.",
            "href": "/containers/maintenance",
        },
    ]


def run_ai_assistant(*, user, prompt, context_type="", context_id=None, intent="general"):
    provider = getattr(settings, "RECYCLR_AI_PROVIDER", "openai") or "openai"
    model = getattr(settings, "RECYCLR_AI_MODEL", "") or ""
    prompt = (prompt or "").strip()

    if not ai_enabled():
        log = AIInteractionLog.objects.create(
            user=user,
            provider=provider,
            model=model,
            context_type=context_type or "",
            context_id=context_id,
            intent=intent or "general",
            prompt=prompt[:4000],
            response=DISABLED_MESSAGE,
            status=AIInteractionLog.STATUS_DISABLED,
        )
        return {
            "success": False,
            "status": "disabled",
            "message": DISABLED_MESSAGE,
            "interaction_id": log.id,
        }

    log = AIInteractionLog.objects.create(
        user=user,
        provider=provider,
        model=model,
        context_type=context_type or "",
        context_id=context_id,
        intent=intent or "general",
        prompt=prompt[:4000],
        status=AIInteractionLog.STATUS_ERROR,
        error_message="OpenAI live calling is not implemented in this build.",
    )
    return {
        "success": False,
        "status": "not_configured",
        "message": "AI is enabled, but the OpenAI live call adapter has not been switched on yet.",
        "interaction_id": log.id,
    }
