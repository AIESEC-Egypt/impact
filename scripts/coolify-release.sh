#!/bin/sh
# First deploy / full re-seed. Coolify terminal:
#   /app/scripts/docker-entrypoint.sh release
set -e

echo "==> repair ghost migrations (if needed)"
python manage.py repair_ghost_migrations

echo "==> migrate"
python manage.py migrate --noinput

echo "==> static"
if [ -f staticfiles/.image-baked ]; then
  echo "    baked in Docker image — skip sync/collectstatic"
else
  python manage.py sync_static_assets
  python manage.py collectstatic --noinput
fi

if [ "${SKIP_SEED:-0}" = "1" ]; then
  echo "==> SKIP_SEED=1 — skipping data seeds"
  exit 0
fi

echo "==> seed LMS"
python manage.py seed_lms
python manage.py merge_duplicate_academies
python manage.py clear_legacy_academy_materials
python manage.py seed_home_haweya_promo
python manage.py seed_dreaming_history_quiz --replace

echo "==> done — run: docker-entrypoint.sh manage createsuperuser"
