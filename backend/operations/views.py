from django.http import JsonResponse
from django.shortcuts import get_object_or_404

from customers.models import Customer
from jobs.models import Job


def collections_for_customer(request, customer_id):
    if request.method != "GET":
        return JsonResponse({"success": False, "message": "Method not allowed."}, status=405)

    customer = get_object_or_404(Customer, pk=customer_id)

    jobs = (
        Job.objects.filter(customer=customer)
        .select_related("site", "service")
        .order_by("-collection_date", "-id")
    )

    data = []
    for job in jobs:
        data.append(
            {
                "id": job.id,
                "site_name": job.site.site_name if job.site else "-",
                "waste_type": job.waste_type,
                "date_time": job.collection_date.isoformat() if job.collection_date else "",
                "status": job.status,
                "reason": job.failure_reason or "",
                "notes": job.notes or "",
                "service_id": job.service.id if job.service else None,
            }
        )

    return JsonResponse(data, safe=False)


def create_test_collection_data(request, customer_id):
    return JsonResponse(
        {
            "success": False,
            "message": "Test collection data has been retired. Collections now come from real jobs.",
        },
        status=400,
    )