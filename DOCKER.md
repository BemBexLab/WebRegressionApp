# Docker Setup

This project runs as two containers:

- `client`: Next.js app on port `3000`
- `server`: Express + Playwright API on port `5000`

## Prerequisites

- Docker Desktop
- Existing backend secrets in `server/.env`

The backend container loads its private environment from `server/.env`, which is already ignored by git.

## First-time setup

1. Copy `docker-compose.env.example` to `.env` in the repo root.
2. Keep your frontend public Supabase values in `client/.env.local`.
3. Make sure `server/.env` contains the backend secrets your API already expects:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Optional values like `GITHUB_TOKEN`, crawl/screenshot tuning, and storage settings

## Run

```bash
docker compose up --build
```

Then open `http://localhost:3000`.

## Stop

```bash
docker compose down
```

## Notes

- The client image is built with Next.js standalone output for a smaller runtime container.
- The Next build reads frontend public env vars from `client/.env.local`, so Compose does not need duplicate `NEXT_PUBLIC_SUPABASE_*` entries.
- Browser requests go to `http://localhost:3000/api/...`, and Next rewrites those calls to `http://server:5000/api/...` inside the Docker network.
- The server image uses the official Playwright base image so Chromium and its Linux dependencies are already present.
