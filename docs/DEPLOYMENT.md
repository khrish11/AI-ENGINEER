# Deployment

## Docker Compose

Copy the documented environment template to `.env.production`, set a strong
`DATABASE_URL`, `AUTH_SECRET`, and provider credentials as needed, then run:

```sh
docker compose -f docker-compose.production.yml up --build -d
```

Apply migrations from a controlled release job before serving traffic:

```sh
docker compose -f docker-compose.production.yml run --rm app npm run db:migrate
```

The production image runs the standalone Next.js server as a non-root user and
copies `.next/static` and `public` into the runtime image. Readiness is exposed
at `/api/health/ready`; liveness is exposed at `/api/health/live`.

Do not expose PostgreSQL publicly. Put TLS and request forwarding in a trusted
reverse proxy, and keep OAuth secrets in a secret manager.
