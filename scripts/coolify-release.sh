#!/bin/sh
# First deploy / full re-seed. Coolify terminal:
#   /app/scripts/docker-entrypoint.sh release
set -e

echo "==> migrate"
python manage.py migrate --noinput

echo "==> static"
python manage.py sync_static_assets
python manage.py collectstatic --noinput

if [ "${SKIP_SEED:-0}" = "1" ]; then
  echo "==> SKIP_SEED=1 — skipping data seeds"
  exit 0
fi

echo "==> seed LMS"
python manage.py seed_lms
python manage.py seed_academy_legacy_materials --replace
python manage.py seed_home_howya_promo
python manage.py seed_dreaming_history_quiz --replace

echo "==> done — run: docker-entrypoint.sh manage createsuperuser"
