# syntax=docker/dockerfile:1
# IMPACT — production image for Coolify / any Docker host

# --- dependencies (cached layer) -------------------------------------------
FROM python:3.12-slim-bookworm AS deps

WORKDIR /build
COPY requirements.txt .
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt


# --- runtime image -----------------------------------------------------------
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=impact.settings \
    PORT=8000

# libpq5 for psycopg2-binary; non-root user
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 --shell /usr/sbin/nologin app

COPY --from=deps /install /usr/local

WORKDIR /app

# App code (see .dockerignore — static/ is rebuilt below)
COPY --chown=app:app . .

RUN chmod +x /app/scripts/docker-entrypoint.sh /app/scripts/coolify-release.sh

# Build static bundle once in the image (no database required)
ENV DJANGO_SECRET_KEY=build-only \
    DJANGO_DEBUG=False
RUN python manage.py sync_static_assets \
    && python manage.py collectstatic --noinput

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD python -c "import os,urllib.request as u; u.urlopen('http://127.0.0.1:%s/'%os.getenv('PORT','8000'), timeout=4)"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["web"]
