from urllib.parse import urlparse

from django.http import HttpResponse


ALLOWED_HOSTED_ORIGINS = {
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "https://recyclr-crm.vercel.app",
    "https://recyclrgroup.co.uk",
    "https://www.recyclrgroup.co.uk",
}


def _is_allowed_origin(origin):
    if not origin:
        return False
    if origin in ALLOWED_HOSTED_ORIGINS:
        return True

    host = urlparse(origin).hostname or ""
    return (
        host.endswith(".vercel.app")
        or host.endswith(".onrender.com")
        or host in {"recyclrgroup.co.uk", "www.recyclrgroup.co.uk"}
    )


class HostedCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin")
        origin_allowed = _is_allowed_origin(origin)

        if request.method == "OPTIONS" and origin_allowed:
            response = HttpResponse(status=200)
        else:
            response = self.get_response(request)

        if origin_allowed:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            )
            response["Access-Control-Allow-Headers"] = (
                "accept, authorization, content-type, user-agent, x-csrftoken, "
                "x-requested-with, x-staff-token, x-staff-username"
            )
            response["Access-Control-Expose-Headers"] = "X-Recyclr-Cors"
            response["X-Recyclr-Cors"] = "middleware"
            response["Access-Control-Max-Age"] = "86400"
            vary = response.get("Vary")
            if vary:
                if "Origin" not in [item.strip() for item in vary.split(",")]:
                    response["Vary"] = f"{vary}, Origin"
            else:
                response["Vary"] = "Origin"

        return response
