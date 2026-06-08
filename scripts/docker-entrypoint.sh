#!/bin/sh
# Usage:
#   web      — start Gunicorn (default; Coolify start command)
#   release  — migrate + static + seeds (run once after first deploy)
#   …        — pass through to manage.py, e.g. ./docker-entrypoint.sh manage migrate
set -e

_seed_if_empty() {
  if [ "${SKIP_SEED:-0}" = "1" ] || [ "${AUTO_SEED:-1}" != "1" ]; then
    return 0
  fi
  echo "==> checking database seed"
  if python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'impact.settings')
django.setup()
from lms.models import Academy
raise SystemExit(0 if Academy.objects.exists() else 1)
"; then
    echo "    data present — skip seed"
    return 0
  fi
  echo "==> empty database — seeding"
  python manage.py seed_lms
  python manage.py merge_duplicate_academies
  python manage.py seed_home_howya_promo
}

case "${1:-web}" in
  web)
    if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
      echo "==> repair ghost migrations (if needed)"
      python manage.py repair_ghost_migrations
      echo "==> migrate (startup)"
      python manage.py migrate --noinput
    fi
    _seed_if_empty
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
