# Production deployment — IMPACT (Django)

## Before first deploy

1. Copy `.env.example` → `.env` on the server and set real values (never commit `.env`).
2. Register EXPA OAuth redirect URI: `https://impact.aiesec.org.eg/` (or your domain).
3. Use PostgreSQL in production (`POSTGRES_*` env vars).

## Server setup (one time)

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

python manage.py migrate
python manage.py sync_static_assets
python manage.py collectstatic --noinput
python manage.py seed_lms
python manage.py clear_legacy_academy_materials
python manage.py seed_home_haweya_promo
python manage.py createsuperuser
```

Configure **EXPA OAuth** and **EXPA member sync** in Django admin, then:

```bash
python manage.py sync_expa_members
```

## Run with Gunicorn

```bash
export DJANGO_DEBUG=False
gunicorn impact.wsgi --bind 0.0.0.0:8000 --workers 3 --timeout 120
```

Or use the Dockerfile + `scripts/docker-entrypoint.sh` (Coolify — see `COOLIFY.md`).

## Required environment variables

| Variable | Example |
|----------|---------|
| `DJANGO_SECRET_KEY` | long random string |
| `DJANGO_DEBUG` | `False` |
| `DJANGO_ALLOWED_HOSTS` | `impact.aiesec.org.eg` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://impact.aiesec.org.eg` |
| `EXPA_CLIENT_ID` / `EXPA_CLIENT_SECRET` | from EXPA app |
| `EXPA_REDIRECT_URI` | `https://impact.aiesec.org.eg/` |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST` | database |

## Static assets

- `python manage.py sync_static_assets` — copies `aspects/`, `Middle Video/`, `fonts/`, etc. into `static/`
- `python manage.py collectstatic` — builds `staticfiles/` for WhiteNoise

## Push to GitHub

Repository: https://github.com/AIESEC-Egypt/impact

The remote `main` branch currently holds the old static HTML site. This Django project replaces it. After your first push you may need:

```bash
git push -u origin main --force
```

Only use `--force` if you intend to overwrite the old static site on `main`.
