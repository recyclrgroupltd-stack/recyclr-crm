from django.urls import path

from . import views

urlpatterns = [
    path("summary/", views.summary, name="staff-calendar-summary"),
    path("staff/<int:staff_id>/events/", views.staff_events, name="staff-calendar-events"),
    path("staff/<int:staff_id>/requests/", views.create_request, name="staff-calendar-create-request"),
    path("events/<int:event_id>/", views.event_detail, name="staff-calendar-event-detail"),
    path("requests/", views.requests_list, name="staff-calendar-requests"),
    path("requests/<int:request_id>/accept/", views.accept_request, name="staff-calendar-accept"),
    path("requests/<int:request_id>/decline/", views.decline_request, name="staff-calendar-decline"),
]
