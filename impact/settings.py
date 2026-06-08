"""
Django settings for the IMPACT educational platform.

Secrets are read from environment variables (optionally a .env file) and must
never be committed. See .env.example for the expected keys.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from a .env file if present.
load_dotenv(BASE_DIR / ".env")


def env_bool(key, default=False):
    value = os.environ.get(key)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-5wyhc^5)bk=nb238hb4r99-*k&d2dk9h$oz!4x80%(h_#02_us",
)

DEBUG = env_bool("DJANGO_DEBUG", True)

SUPPORT_CONTACT_NAME = os.environ.get("SUPPORT_CONTACT_NAME", "Wello")

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get(
        "DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,impact.aiesec.org.eg"
    ).split(",")
    if h.strip()
]
# Coolify/Docker healthchecks probe 127.0.0.1 from inside the container.
for _internal_host in ("127.0.0.1", "localhost"):
    if _internal_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_internal_host)

CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "DJANGO_CSRF_TRUSTED_ORIGINS", "https://impact.aiesec.org.eg"
    ).split(",")
    if o.strip()
]


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "accounts",
    "lms",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "impact.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "impact.context_processors.site_support",
            ],
        },
    },
]

WSGI_APPLICATION = "impact.wsgi.application"


# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# PostgreSQL (Coolify / DigitalOcean managed DB)
if os.environ.get("POSTGRES_DB"):
    _pg_options = {}
    _sslmode = os.environ.get("POSTGRES_SSLMODE", "").strip()
    if _sslmode:
        _pg_options["sslmode"] = _sslmode
    DATABASES["default"] = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["POSTGRES_DB"],
        "USER": os.environ.get("POSTGRES_USER", ""),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": int(os.environ.get("POSTGRES_CONN_MAX_AGE", "60")),
        "OPTIONS": _pg_options,
    }


AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTH_USER_MODEL = "accounts.User"

LOGIN_URL = "accounts:login"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"


# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Cairo"
USE_I18N = True
USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"
_STATIC_EXTRA = [
    ("fonts", BASE_DIR / "fonts"),
    ("AiE", BASE_DIR / "AiE"),
    ("Academy", BASE_DIR / "Academy"),
    ("aspects", BASE_DIR / "aspects"),
    ("image", BASE_DIR / "image"),
]
_STATIC_APP_DIR = BASE_DIR / "static"
STATICFILES_DIRS = [
    entry
    for entry in ([_STATIC_APP_DIR] if _STATIC_APP_DIR.exists() else [])
    + [path for _name, path in _STATIC_EXTRA if path.exists()]
]
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # Non-manifest storage: tolerant of the legacy asset set (some referenced
    # files are missing in this copy) and avoids strict url() resolution.
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

# Media (uploaded thumbnails, etc.)
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ---------------------------------------------------------------------------
# EXPA OAuth defaults.
#
# These are fallbacks only. The authoritative values live in the
# accounts.ExpaOAuthConfig row (editable in the admin). Secrets should be set
# via environment variables and never committed.
# ---------------------------------------------------------------------------
EXPA_OAUTH = {
    "AUTH_URL": os.environ.get("EXPA_AUTH_URL", "https://auth.aiesec.org/oauth/authorize"),
    "TOKEN_URL": os.environ.get("EXPA_TOKEN_URL", "https://auth.aiesec.org/oauth/token"),
    "PEOPLE_ME_URL": os.environ.get(
        "EXPA_PEOPLE_ME_URL", "https://gis-api.aiesec.org/v2/current_person"
    ),
    "CLIENT_ID": os.environ.get("EXPA_CLIENT_ID", ""),
    "CLIENT_SECRET": os.environ.get("EXPA_CLIENT_SECRET", ""),
    "REDIRECT_URI": os.environ.get("EXPA_REDIRECT_URI", "https://impact.aiesec.org.eg/"),
    # Comma separated list of entity names that are allowed to log in.
    "ALLOWED_ENTITIES": [
        e.strip().lower()
        for e in os.environ.get("EXPA_ALLOWED_ENTITIES", "egypt").split(",")
        if e.strip()
    ],
    "REQUIRE_ACTIVE_MEMBER": env_bool("EXPA_REQUIRE_ACTIVE_MEMBER", True),
}

# EDM-style member roster: login only if EXPA id is in MemberRoster (after sync_expa_members).
EXPA_USE_MEMBER_ROSTER = env_bool("EXPA_USE_MEMBER_ROSTER", True)
EXPA_SYNC_ACCESS_TOKEN = os.environ.get("EXPA_SYNC_ACCESS_TOKEN", "")
EXPA_SYNC_GRAPHQL_URL = os.environ.get(
    "EXPA_SYNC_GRAPHQL_URL", "https://gis-api.aiesec.org/graphql"
)
EXPA_SYNC_OFFICE_ID = os.environ.get("EXPA_SYNC_OFFICE_ID", "")
EXPA_SYNC_DATE_FROM = os.environ.get("EXPA_SYNC_DATE_FROM", "2025-01-01")
EXPA_SYNC_DATE_TO = os.environ.get("EXPA_SYNC_DATE_TO", "")

# Iframe embedding: allow our own pages to frame Drive/YouTube content.
X_FRAME_OPTIONS = "SAMEORIGIN"

# EXPA OAuth debug: full GIS API responses on each login attempt (file optional).
LOGS_DIR = BASE_DIR / "logs"


def _writable_logs_dir():
    try:
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        probe = LOGS_DIR / ".write_probe"
        probe.write_text("", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return True
    except OSError:
        return False

# Production hardening (when DJANGO_DEBUG=False)
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
    SECURE_REDIRECT_EXEMPT = [r"^health"]
    SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"

_expa_handlers = ["console"]
_expa_handler_defs = {
    "console": {
        "level": "INFO",
        "class": "logging.StreamHandler",
        "formatter": "verbose",
    },
}
if _writable_logs_dir():
    _expa_handlers.insert(0, "expa_file")
    _expa_handler_defs["expa_file"] = {
        "level": "INFO",
        "class": "logging.FileHandler",
        "filename": str(LOGS_DIR / "expa_oauth.log"),
        "formatter": "verbose",
    }

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": _expa_handler_defs,
    "loggers": {
        "accounts.expa": {
            "handlers": _expa_handlers,
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "impact": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}
