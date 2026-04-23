# Docker Setup

This project now runs against a local Docker-based Supabase stack plus two app containers:

- `supabase`: official local Supabase stack managed by the Supabase CLI
- `client`: Next.js app on port `3000`
- `server`: Express + Playwright API on port `5000`

## Prerequisites

- Docker Desktop
- Node.js 20+
- Supabase CLI via `npx supabase`

The local Supabase stack is the official Docker-based setup from the Supabase CLI. The app containers connect to that stack instead of a hosted Supabase project.

## First-time setup

1. Copy `docker-compose.env.example` to `.env` in the repo root.
2. Start the local Supabase stack:

```bash
npx supabase start
```

3. Reset or re-apply the database schema after schema changes:

```bash
npx supabase db reset
```

4. Keep backend-only non-Supabase secrets in `server/.env`, especially:
   - `GITHUB_TOKEN`
   - optional crawl/screenshot tuning values

The root `.env` now carries the Docker app wiring plus the default local Supabase anon and service-role keys.

## Run

```bash
docker compose up --build
```

Then open `http://localhost:3000`.

Open local Supabase Studio at `http://localhost:54323`.

## Stop

```bash
docker compose down
```

To stop the Supabase stack:

```bash
npx supabase stop
```

## Notes

- The client image is built with Next.js standalone output for a smaller runtime container.
- The repo now keeps the authoritative schema in `supabase/migrations`, which the local Supabase Docker stack applies.
- Browser requests go to `http://localhost:3000/api/...`, and Next rewrites those calls to `http://server:5000/api/...` inside the Docker network.
- The browser talks to Supabase on `http://127.0.0.1:54321`, while the server container uses `http://host.docker.internal:54321`.
- Scan result image paths are stored as relative `/storage/...` paths so the browser can use the public Supabase URL and the server container can use its internal asset base when generating PDFs.
- The server image uses the official Playwright base image so Chromium and its Linux dependencies are already present.
