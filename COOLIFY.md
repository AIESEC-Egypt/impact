# Coolify deployment (IMPACT)

## App settings

| Field | Value |
|-------|--------|
| Build pack | **Dockerfile** |
| Port | `8000` |
| Start command | *(leave empty — image uses `CMD web`)* |

Paste env vars from `.env.coolify.example` (set real `DJANGO_SECRET_KEY`, `POSTGRES_*`, and `EXPA_*`).
Set `DJANGO_DEBUG=False` so users see friendly errors only (no technical dumps).

## First deploy

1. Deploy the container (Coolify builds the Dockerfile).
   Migrations run automatically on each container start.
2. Open **Terminal** and run:

```bash
/app/scripts/docker-entrypoint.sh release
/app/scripts/docker-entrypoint.sh manage createsuperuser
```

`release` seeds academies, quizzes, and promos (skip later with `SKIP_SEED=1`).

3. Configure EXPA in `/admin/`, then:

```bash
/app/scripts/docker-entrypoint.sh manage sync_expa_members
```

## Later deploys

Static files are baked into the Docker image — redeploying the container is enough.
Migrations only (no re-seed):

```bash
/app/scripts/docker-entrypoint.sh manage migrate --noinput
```

Skip seeds on `release`: `SKIP_SEED=1 /app/scripts/docker-entrypoint.sh release`

## Optional env

| Variable | Default | Purpose |
|----------|---------|---------|
| `WEB_CONCURRENCY` | `2` | Gunicorn workers |
| `GUNICORN_THREADS` | `4` | Threads per worker (`gthread`) |
| `GUNICORN_TIMEOUT` | `120` | Slow uploads / EXPA |
| `PORT` | `8000` | Set by Coolify automatically |

## Image notes

- **Multi-stage** install — smaller image, no compiler in production.
- **`static/`** is generated at build — do not rely on a pre-built `static/` folder in git.
- Runs as user **`app`** (uid 1000).
- **Health check** hits `/` on the app port.
