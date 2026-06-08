#!/bin/sh
# Usage:
#   web      — start Gunicorn (default; Coolify start command)
#   release  — migrate + static + seeds (run once after first deploy)
#   …        — pass through to manage.py, e.g. ./docker-entrypoint.sh manage migrate
set -e

case "${1:-web}" in
  web)
    if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
      echo "==> migrate (startup)"
      python manage.py migrate --noinput
    fi
    exec gunicorn impact.wsgi:application \
      --bind "0.0.0.0:${PORT:-8000}" \
      --workers "${WEB_CONCURRENCY:-2}" \
      --threads "${GUNICORN_THREADS:-4}" \
      --worker-class gthread \
      --timeout "${GUNICORN_TIMEOUT:-120}" \
      --keep-alive 5 \
      --max-requests 1000 \
      --max-requests-jitter 50 \
      --access-logfile - \
      --error-logfile - \
      --capture-output \
      --enable-stdio-inheritance
    ;;
  release)
    exec /app/scripts/coolify-release.sh
    ;;
  manage)
    shift
    exec python manage.py "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
