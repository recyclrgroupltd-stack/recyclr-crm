from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from accounts_api.views import require_authenticated_staff_user
from purchase_orders.notifications import create_mention_notifications

from .models import StaffCalendarEvent, StaffCalendarRequest

User = get_user_model()


def _parse_dt(value):
    if not value:
        return None
    parsed = parse_datetime(str(value))
    if parsed and timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _user_data(user):
    return {
        "id": user.id,
        "username": user.username,
        "name": user.get_full_name() or user.username,
    }


def _event_data(event):
    return {
        "id": event.id,
        "owner_id": event.owner_id,
        "created_by": _user_data(event.created_by) if event.created_by else None,
        "title": event.title,
        "description": event.description,
        "location": event.location,
        "start_at": event.start_at.isoformat() if event.start_at else "",
        "end_at": event.end_at.isoformat() if event.end_at else "",
        "all_day": event.all_day,
        "created_at": event.created_at.isoformat() if event.created_at else "",
        "updated_at": event.updated_at.isoformat() if event.updated_at else "",
    }


def _request_data(calendar_request):
    return {
        "id": calendar_request.id,
        "target_user": _user_data(calendar_request.target_user),
        "requested_by": _user_data(calendar_request.requested_by),
        "title": calendar_request.title,
        "description": calendar_request.description,
        "location": calendar_request.location,
        "start_at": calendar_request.start_at.isoformat() if calendar_request.start_at else "",
        "end_at": calendar_request.end_at.isoformat() if calendar_request.end_at else "",
        "all_day": calendar_request.all_day,
        "status": calendar_request.status,
        "response_note": calendar_request.response_note,
        "created_at": calendar_request.created_at.isoformat() if calendar_request.created_at else "",
        "decided_at": calendar_request.decided_at.isoformat() if calendar_request.decided_at else "",
    }


def _clean_event_payload(payload):
    title = str(payload.get("title") or "").strip()
    description = str(payload.get("description") or "").strip()
    location = str(payload.get("location") or "").strip()
    start_at = _parse_dt(payload.get("start_at"))
    end_at = _parse_dt(payload.get("end_at"))
    all_day = bool(payload.get("all_day", False))

    if not title:
        return None, Response({"success": False, "message": "Add a calendar title."}, status=status.HTTP_400_BAD_REQUEST)
    if not start_at or not end_at:
        return None, Response({"success": False, "message": "Choose a start and end date/time."}, status=status.HTTP_400_BAD_REQUEST)
    if end_at <= start_at:
        return None, Response({"success": False, "message": "End time must be after start time."}, status=status.HTTP_400_BAD_REQUEST)

    return {
        "title": title,
        "description": description,
        "location": location,
        "start_at": start_at,
        "end_at": end_at,
        "all_day": all_day,
    }, None


def _get_staff_user(user_id):
    return User.objects.filter(pk=user_id, is_staff=True, is_active=True).first()


def _event_target_url(event):
    date_value = event.start_at.date().isoformat() if event.start_at else ""
    return f"/staff/{event.owner_id}?calendar=1&event={event.id}&date={date_value}"


def _notify_calendar_mentions(event, actor):
    create_mention_notifications(
        actor=actor,
        text=event.description,
        title=f"You were mentioned in a calendar event by {actor.username if actor else 'Staff'}",
        message=f"{event.title} - {event.description[:200]}",
        target_url=_event_target_url(event),
        source_type="calendar_event",
        source_id=event.id,
    )


@api_view(["GET"])
def summary(request):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    pending_count = StaffCalendarRequest.objects.filter(
        target_user=user,
        status=StaffCalendarRequest.STATUS_PENDING,
    ).count()
    return Response({"success": True, "pending_request_count": pending_count})


@api_view(["GET", "POST"])
def staff_events(request, staff_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    target_user = _get_staff_user(staff_id)
    if not target_user:
        return Response({"success": False, "message": "Staff user not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        events = StaffCalendarEvent.objects.filter(owner=target_user).select_related("owner", "created_by")
        start = _parse_dt(request.query_params.get("start"))
        end = _parse_dt(request.query_params.get("end"))
        if start:
            events = events.filter(end_at__gte=start)
        if end:
            events = events.filter(start_at__lte=end)
        return Response(
            {
                "success": True,
                "staff": _user_data(target_user),
                "can_edit": user.id == target_user.id,
                "events": [_event_data(event) for event in events],
            }
        )

    if user.id != target_user.id:
        return Response(
            {"success": False, "message": "You can only add events to your own calendar. Send a request instead."},
            status=status.HTTP_403_FORBIDDEN,
        )

    payload, error = _clean_event_payload(request.data if isinstance(request.data, dict) else {})
    if error:
        return error

    event = StaffCalendarEvent.objects.create(owner=target_user, created_by=user, **payload)
    _notify_calendar_mentions(event, user)
    return Response({"success": True, "message": "Calendar event added.", "event": _event_data(event)})


@api_view(["PATCH", "DELETE"])
def event_detail(request, event_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    event = StaffCalendarEvent.objects.filter(pk=event_id).select_related("owner", "created_by").first()
    if not event:
        return Response({"success": False, "message": "Calendar event not found."}, status=status.HTTP_404_NOT_FOUND)
    if event.owner_id != user.id:
        return Response({"success": False, "message": "You can only edit your own calendar."}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "DELETE":
        event.delete()
        return Response({"success": True, "message": "Calendar event deleted."})

    payload, error = _clean_event_payload(request.data if isinstance(request.data, dict) else {})
    if error:
        return error

    for key, value in payload.items():
        setattr(event, key, value)
    event.save()
    _notify_calendar_mentions(event, user)
    return Response({"success": True, "message": "Calendar event updated.", "event": _event_data(event)})


@api_view(["POST"])
def create_request(request, staff_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    target_user = _get_staff_user(staff_id)
    if not target_user:
        return Response({"success": False, "message": "Staff user not found."}, status=status.HTTP_404_NOT_FOUND)

    payload, error = _clean_event_payload(request.data if isinstance(request.data, dict) else {})
    if error:
        return error

    if user.id == target_user.id:
        event = StaffCalendarEvent.objects.create(owner=target_user, created_by=user, **payload)
        _notify_calendar_mentions(event, user)
        return Response({"success": True, "message": "Added to your calendar.", "event": _event_data(event)})

    calendar_request = StaffCalendarRequest.objects.create(
        target_user=target_user,
        requested_by=user,
        **payload,
    )
    return Response(
        {
            "success": True,
            "message": f"Calendar request sent to {target_user.username}.",
            "request": _request_data(calendar_request),
        }
    )


@api_view(["GET"])
def requests_list(request):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    request_status = request.query_params.get("status", "").strip()
    direction = request.query_params.get("direction", "received").strip()
    queryset = StaffCalendarRequest.objects.select_related("target_user", "requested_by")
    queryset = queryset.filter(requested_by=user) if direction == "sent" else queryset.filter(target_user=user)
    if request_status:
        queryset = queryset.filter(status=request_status)
    return Response({"success": True, "requests": [_request_data(item) for item in queryset[:100]]})


@api_view(["POST"])
def accept_request(request, request_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    calendar_request = StaffCalendarRequest.objects.filter(pk=request_id, target_user=user).first()
    if not calendar_request:
        return Response({"success": False, "message": "Calendar request not found."}, status=status.HTTP_404_NOT_FOUND)
    if calendar_request.status != StaffCalendarRequest.STATUS_PENDING:
        return Response({"success": False, "message": "This request has already been dealt with."}, status=status.HTTP_400_BAD_REQUEST)

    event = StaffCalendarEvent.objects.create(
        owner=user,
        created_by=calendar_request.requested_by,
        request=calendar_request,
        title=calendar_request.title,
        description=calendar_request.description,
        location=calendar_request.location,
        start_at=calendar_request.start_at,
        end_at=calendar_request.end_at,
        all_day=calendar_request.all_day,
    )
    _notify_calendar_mentions(event, calendar_request.requested_by)
    calendar_request.status = StaffCalendarRequest.STATUS_ACCEPTED
    calendar_request.response_note = str(request.data.get("response_note") or "").strip()
    calendar_request.decided_at = timezone.now()
    calendar_request.save(update_fields=["status", "response_note", "decided_at"])
    return Response(
        {
            "success": True,
            "message": "Request accepted and added to your calendar.",
            "request": _request_data(calendar_request),
            "event": _event_data(event),
        }
    )


@api_view(["POST"])
def decline_request(request, request_id):
    user, error_response = require_authenticated_staff_user(request)
    if error_response:
        return error_response

    calendar_request = StaffCalendarRequest.objects.filter(pk=request_id, target_user=user).first()
    if not calendar_request:
        return Response({"success": False, "message": "Calendar request not found."}, status=status.HTTP_404_NOT_FOUND)
    if calendar_request.status != StaffCalendarRequest.STATUS_PENDING:
        return Response({"success": False, "message": "This request has already been dealt with."}, status=status.HTTP_400_BAD_REQUEST)

    calendar_request.status = StaffCalendarRequest.STATUS_DECLINED
    calendar_request.response_note = str(request.data.get("response_note") or "").strip()
    calendar_request.decided_at = timezone.now()
    calendar_request.save(update_fields=["status", "response_note", "decided_at"])
    return Response({"success": True, "message": "Request declined.", "request": _request_data(calendar_request)})
