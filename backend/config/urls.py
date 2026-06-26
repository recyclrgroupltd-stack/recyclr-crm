from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from .views import admin_actions_view, health_view

urlpatterns = [
    path("api/health/", health_view, name="api-health"),
    path("admin/actions/", admin.site.admin_view(admin_actions_view), name="admin-actions"),
    path("admin/", admin.site.urls),

    path("api/auth/", include("accounts_api.urls")),
    path("api/dashboard/", include("dashboard_api.urls")),

    path("api/customers/", include("customers.urls")),
    path("api/pricing/", include("pricing_api.urls")),
    path("api/quotes/", include("quotes.urls")),
    path("api/services/", include("services.urls")),
    path("api/collections/", include("operations.urls")),
    path("api/hauliers/", include("hauliers.urls")),
    path("api/reporting/", include("reporting.urls")),
    path("api/communications/", include("communications.urls")),
    path("api/purchase-orders/", include("purchase_orders.urls")),
    path("api/expenses/", include("expenses.urls")),
    path("api/jobs/", include("jobs.urls")),
    path("api/staff-chat/", include("staff_chat.urls")),
    path("api/staff-calendar/", include("staff_calendar.urls")),
    path("api/containers/", include("containers.urls")),
    path("api/email/", include("crm_email.urls")),
    path("api/personnel/", include("personnel.urls")),
    path("api/ai/", include("ai_core.urls")),
    path("api/assets/", include("assets.urls")),
    path("api/", include("leads_api.urls")),
    path("api/documents/", include("documents.urls")),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
