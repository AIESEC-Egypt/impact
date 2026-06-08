# syntax=docker/dockerfile:1
# IMPACT — lean production image for Coolify (BuildKit recommended)

# --- Python wheels (rebuilds only when requirements.txt changes) ------------
FROM python:3.12-slim-bookworm AS deps

WORKDIR /build
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install --no-cache-dir -r requirements.txt


# --- Static bundle (rebuilds when assets or templates change) ---------------
FROM deps AS static

# deps installs to /install; put packages on the default Python path
COPY --from=deps /install /usr/local

WORKDIR /app

ENV DJANGO_SECRET_KEY=build-only \
    DJANGO_DEBUG=False \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=impact.settings

# Legacy asset sources (large — not copied into final runtime image)
COPY fonts/ fonts/
COPY AiE/ AiE/
COPY aspects/ aspects/
COPY image/ image/
COPY Academy/ Academy/
COPY ["Middle Video/", "Middle Video/"]
COPY ["styles server.css", "styles server.css"]

# Django app (needed for collectstatic + template refs)
COPY manage.py .
COPY impact/ impact/
COPY accounts/ accounts/
COPY lms/ lms/
COPY templates/ templates/

RUN mkdir -p static \
    && python manage.py sync_static_assets \
    && python manage.py collectstatic --noinput \
    && touch staticfiles/.image-baked


# --- Runtime (app code + pre-built static only) -----------------------------
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=impact.settings \
    PORT=8000

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 --shell /usr/sbin/nologin app

COPY --from=deps /install /usr/local

WORKDIR /app

COPY --chown=app:app manage.py .
COPY --chown=app:app impact/ impact/
COPY --chown=app:app accounts/ accounts/
COPY --chown=app:app lms/ lms/
COPY --chown=app:app templates/ templates/
COPY --chown=app:app scripts/ scripts/
COPY --from=static --chown=app:app /app/staticfiles/ staticfiles/

RUN mkdir -p /app/logs /app/media \
    && chmod +x /app/scripts/docker-entrypoint.sh /app/scripts/coolify-release.sh \
    && chown -R app:app /app

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import os,urllib.request as u; u.urlopen('http://127.0.0.1:%s/'%os.getenv('PORT','8000'), timeout=4)"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["web"]
