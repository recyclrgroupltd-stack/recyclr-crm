import os
from pathlib import Path

import dj_database_url
from corsheaders.defaults import default_headers
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-secret-key")


def env_bool(name, default):
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


DEBUG = env_bool("DJANGO_DEBUG", "True")

_allowed_hosts = os.getenv(
    "DJANGO_ALLOWED_HOSTS",
    "127.0.0.1,localhost,recyclr-crm-backend.onrender.com",
).split(",")
ALLOWED_HOSTS = [host.strip() for host in _allowed_hosts if host.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "rest_framework",
    "corsheaders",

    "customers",
    "leads",
    "pricing",
    "services",
    "quotes",
    "accounts_api",
    "dashboard_api",
    "leads_api",
    "pricing_api",
    "operations",
    "hauliers",
    "reporting",
    "communications",
    "purchase_orders",
    "expenses",
    "jobs",
    "documents",
    "staff_chat",
    "staff_calendar",
    "containers.apps.ContainersConfig",
    "crm_email.apps.CrmEmailConfig",
]

MIDDLEWARE = [
    "config.hosted_cors.HostedCorsMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR / "config" / "templates",
            BASE_DIR / "leads" / "templates",
            BASE_DIR / "services" / "templates",
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASE_URL = os.getenv("DATABASE_URL", "")

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=env_bool("DATABASE_SSL_REQUIRE", "True"),
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-gb"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "Europe/London")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [
    BASE_DIR / "static",
]
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOW_ALL_ORIGINS = env_bool("DJANGO_CORS_ALLOW_ALL_ORIGINS", "True")
CORS_ALLOW_CREDENTIALS = True
CORS_URLS_REGEX = r"^.*$"
CORS_PREFLIGHT_MAX_AGE = 86400

_allowed_origins = os.getenv(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    "http://127.0.0.1:3000,http://localhost:3000,https://recyclr-crm.vercel.app",
).split(",")
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _allowed_origins if origin.strip()]
for origin in [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "https://recyclr-crm.vercel.app",
]:
    if origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(origin)

_allowed_origin_regexes = os.getenv(
    "DJANGO_CORS_ALLOWED_ORIGIN_REGEXES",
    r"^https://.*\.vercel\.app$",
).split(",")
CORS_ALLOWED_ORIGIN_REGEXES = [
    origin.strip() for origin in _allowed_origin_regexes if origin.strip()
]
for origin_regex in [r"^https://.*\.vercel\.app$"]:
    if origin_regex not in CORS_ALLOWED_ORIGIN_REGEXES:
        CORS_ALLOWED_ORIGIN_REGEXES.append(origin_regex)

CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "https://recyclr-crm.vercel.app",
    "https://*.vercel.app",
]

CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-staff-username",
]

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ]
}

EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", "True")
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", "False")
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", 20))

DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "Recyclr <info@recyclrgroup.co.uk>")
SERVER_EMAIL = os.getenv("SERVER_EMAIL", DEFAULT_FROM_EMAIL)

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000")

CRM_EMAIL_DOMAIN = os.getenv("CRM_EMAIL_DOMAIN", "recyclrgroup.co.uk")
CRM_EMAIL_IMAP_HOST = os.getenv("CRM_EMAIL_IMAP_HOST", "imap.zoho.eu")
CRM_EMAIL_IMAP_PORT = int(os.getenv("CRM_EMAIL_IMAP_PORT", 993))
CRM_EMAIL_SMTP_HOST = os.getenv("CRM_EMAIL_SMTP_HOST", "smtp.zoho.eu")
CRM_EMAIL_SMTP_PORT = int(os.getenv("CRM_EMAIL_SMTP_PORT", 587))
