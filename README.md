# IMPACT - AIESEC in Egypt educational platform

A Django-backed learning platform for AIESEC in Egypt. Members log in with their
EXPA (AIESEC GIS) account; only **active members of AIESEC in Egypt** can access
the functional academies and the dreaming process. Content managers add
materials, session videos, and quizzes/exams from the Django admin, and member
scores are stored automatically.

## What's included

- **Server-side EXPA OAuth login** (`accounts/`). The client secret stays on the
  server. Login is gated to the allowed entity (Egypt) + an active member
  position.
- **LMS** (`lms/`): academies, materials (PPT/Drive links), sessions (video
  links), exams/quizzes (single / multiple / true-false), attempts and
  auto-grading.
- **Gated pages**: the 8 functional academies and the dreaming process require
  login. Marketing pages (home, history, rankings, contracts) stay public.
- The original static site is served through Django: HTML lives in `templates/`,
  assets in `static/`.

## Project layout

```
impact/            Django project (settings, urls, wsgi)
accounts/          Custom User, EXPA OAuth flow, login tracking
lms/               Academy/Material/Session/Exam/Question/Choice/Attempt models,
                   views, admin, seed command, template tags
templates/         All HTML pages (index, academies, dreaming, exams, login...)
static/            CSS / JS / images (served by WhiteNoise)
tools/             One-time migration helper (static site -> Django)
```

## Local setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env            # then edit .env with real EXPA credentials
python manage.py migrate
python manage.py seed_lms       # creates the academies + sample content
python manage.py createsuperuser
python manage.py runserver
```

Open http://127.0.0.1:8000/ for the site and http://127.0.0.1:8000/admin/ for
the admin.

## Configuring EXPA OAuth

Credentials can come from environment variables (`.env`) **or** an
`EXPA OAuth configuration` row in the admin (the admin row wins). Set:

- `client_id`, `client_secret`
- `redirect_uri` - must match what is registered for the EXPA app. The IMPACT app
  is registered with the site root (`https://impact.aiesec.org.eg/`), so the
  site root doubles as the OAuth callback. You can switch to the dedicated
  `/accounts/expa/callback/` endpoint if you re-register the app.
- `allowed_entities` - comma separated entity names allowed to log in
  (default `egypt`; matched against home MC and current office, case-insensitive).
- `require_active_member` - require an active EXPA member position (default on).

### Login flow

```
/accounts/login/  ->  /accounts/expa/start/  ->  EXPA authorize
   -> EXPA redirects back with ?code (site root or /accounts/expa/callback/)
   -> server exchanges code for token, fetches /v2/current_person
   -> checks roster (if synced) or Egypt entity + active position
   -> creates/updates the User, records a LoginEvent, starts a Django session
   -> redirects to the member's function academy (ogv, igv, …)
```

## Member roster (EDM / `membership-extract`)

When `EXPA_USE_MEMBER_ROSTER=True` (default) and the roster has been synced, only
EXPA IDs present in **EXPA member roster** can log in. Each member is mapped to a
functional academy from their EXPA function (OGX→oGV, ICX→iGV, MKT→B2C, etc.).

1. In admin, open **EXPA member sync configuration** and set:
   - `access_token` — GIS API token (from EXPA; not the OAuth client secret)
   - `office_id` — AIESEC in Egypt MC office id in EXPA
   - `date_from` / `date_to` — position term window
2. Run:

```bash
python manage.py sync_expa_members
```

3. Members log in with EXPA OAuth; on success they are sent to `/academy/<their-function>/`.

View or edit rows under **EXPA member roster** in admin. Logic lives in
`accounts/expa_roster_sync.py` and `accounts/function_mapping.py` (from
`membership-extract/`).

## Managing content (admin)

- **Academies**: add materials and sessions inline on each academy; attach exams.
- **Materials**: paste a Google Slides/Drive link (`url`). The card links straight
  to it.
- **Sessions**: paste a YouTube or Drive video link; it is embedded automatically.
- **Exams**: set `pass_mark`, `time_limit_minutes`, `max_attempts`, and publish.
  Add questions inline, then open each question to add its choices and mark the
  correct one(s). Knowledge quizzes for the dreaming process use
  `kind = knowledge_quiz`.
- **Attempts**: read-only; shows each member's score, percentage, and pass/fail.

## Tracking active users

Every successful login writes a `LoginEvent` (user, time, IP, user agent), and
each `User` stores the raw EXPA `profile_json`, `home_mc`, `current_office`, and
`last_synced`. This is enough to report on who is active later.

## Production notes

See **[DEPLOY.md](DEPLOY.md)** for the full checklist.

- Set `DJANGO_DEBUG=False`, a strong `DJANGO_SECRET_KEY`, and proper
  `DJANGO_ALLOWED_HOSTS` / `DJANGO_CSRF_TRUSTED_ORIGINS`.
- `python manage.py sync_static_assets` then `python manage.py collectstatic`.
- Set `POSTGRES_*` env vars for PostgreSQL (recommended).
- Serve with gunicorn: `gunicorn impact.wsgi` (see `Procfile`).

```bash
python manage.py sync_static_assets
python manage.py collectstatic --noinput
python manage.py migrate
gunicorn impact.wsgi --bind 0.0.0.0:8000 --workers 3
```

## Security note

The legacy `expa-login-extract/expa-oauth-config.js` contains a client secret in
frontend JavaScript. That file is kept only as reference and is **not** served by
Django. The secret it contains should be rotated, and the live secret should only
ever live in `.env` / the admin config on the server.
