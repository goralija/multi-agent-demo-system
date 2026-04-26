# Multi-Agent Newsroom — Project Setup

Production-ready scaffold for the multi-agent newspaper editing demo
(see [`docs/CONCEPT.md`](docs/CONCEPT.md) for the original spec).

## Stack

**Backend** (`backend/`) — Python 3.12, Django 5, Django REST Framework,
PostgreSQL (via `psycopg`), Redis (via `django-redis`), Gunicorn,
WhiteNoise, Ruff, pytest.

**Frontend** (`frontend/`) — Vite, React 18, TypeScript, TanStack Query +
TanStack Router, Tailwind + shadcn/ui primitives, Vitest +
Testing Library, Biome (lint + format).

**Deploy** — Railway (Dockerfile builders) for the `backend`, `frontend`,
PostgreSQL plugin and Redis plugin services.

## Local development

### With Docker Compose (recommended)

```bash
docker compose up --build
```

- Backend: <http://localhost:8000> (admin at `/admin/`, health at `/api/health/`)
- Frontend: <http://localhost:4173>

### Manual

**Backend:**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
# tests / lint
pytest
ruff check . && ruff format --check .
```

**Frontend:**

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
# tests / lint
npm test
npm run check
```

## Deploying to Railway

1. Create a new Railway project.
2. Add the **PostgreSQL** and **Redis** plugins. They expose
   `DATABASE_URL` and `REDIS_URL` automatically.
3. Add a service from this repo with the **Root directory** set to
   `backend`. Railway will use `backend/railway.json` and
   `backend/Dockerfile`. Set:
   - `DJANGO_SECRET_KEY` (generate a strong value)
   - `DEBUG=False`
   - `ALLOWED_HOSTS=<your-app>.up.railway.app`
   - `CORS_ALLOWED_ORIGINS=https://<your-frontend>.up.railway.app`
4. Add a second service with the **Root directory** set to `frontend`.
   Set the build-time variable `VITE_API_URL=https://<backend>.up.railway.app`.
5. Generate domains for both services. Done.

The backend entrypoint runs `migrate` and `collectstatic` on every boot,
and Gunicorn binds to Railway's `$PORT`. The frontend image serves the
static `dist/` build via `serve` on `$PORT`.

## Layout

```
backend/        Django project (core/), DRF app (articles/)
frontend/      Vite + React app
docker-compose.yml  Local dev stack (Postgres + Redis + backend + frontend)
```

## Concept

The original concept (in Bosnian) is preserved in [`docs/CONCEPT.md`](docs/CONCEPT.md).
