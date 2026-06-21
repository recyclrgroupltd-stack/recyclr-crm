import os
from urllib.parse import urlparse

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

_django_application = get_wsgi_application()

_ALLOWED_HOSTED_ORIGINS = {
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "https://recyclr-crm.vercel.app",
}


def _is_allowed_origin(origin):
    if not origin:
        return False
    if origin in _ALLOWED_HOSTED_ORIGINS:
        return True
    host = urlparse(origin).hostname or ""
    return host.endswith(".vercel.app") or host.endswith(".onrender.com")


def _cors_headers(origin):
    return [
        ("Access-Control-Allow-Origin", origin),
        ("Access-Control-Allow-Credentials", "true"),
        ("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS"),
        (
            "Access-Control-Allow-Headers",
            "accept, authorization, content-type, user-agent, x-csrftoken, "
            "x-requested-with, x-staff-token, x-staff-username",
        ),
        ("Access-Control-Expose-Headers", "X-Recyclr-Cors"),
        ("X-Recyclr-Cors", "wsgi"),
        ("Vary", "Origin"),
        ("Access-Control-Max-Age", "86400"),
    ]


def application(environ, start_response):
    origin = environ.get("HTTP_ORIGIN")
    origin_allowed = _is_allowed_origin(origin)

    if environ.get("REQUEST_METHOD") == "OPTIONS" and origin_allowed:
        start_response("200 OK", _cors_headers(origin))
        return [b""]

    def cors_start_response(status, headers, exc_info=None):
        if origin_allowed:
            existing = {name.lower() for name, _ in headers}
            headers.extend(
                (name, value)
                for name, value in _cors_headers(origin)
                if name.lower() not in existing
            )
        return start_response(status, headers, exc_info)

    return _django_application(environ, cors_start_response)
