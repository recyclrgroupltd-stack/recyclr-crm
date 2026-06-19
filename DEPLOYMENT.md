# Recyclr CRM Test Deployment

Recommended free/low-cost testing stack:

- GitHub private repo: source of truth.
- Neon: hosted Postgres database.
- Koyeb: Django backend.
- Vercel: Next.js frontend.

## Backend: Koyeb

Service root:

```text
backend
```

Build command:

```bash
pip install -r requirements.txt
```

Run command:

```bash
bash start.sh
```

Environment variables:

```text
DJANGO_SECRET_KEY=<generate a long random value>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=<your-koyeb-hostname>
DJANGO_CORS_ALLOW_ALL_ORIGINS=False
DJANGO_CORS_ALLOWED_ORIGINS=<your-vercel-frontend-url>
DATABASE_URL=<neon-postgres-connection-string>
DATABASE_SSL_REQUIRE=True
FRONTEND_BASE_URL=<your-vercel-frontend-url>
BACKEND_BASE_URL=<your-koyeb-backend-url>
```

Also add the Zoho/CRM email variables from `backend/.env.example` when you want live email working.

## Frontend: Vercel

Project root:

```text
frontend
```

Build command:

```bash
npm run build
```

Environment variables:

```text
NEXT_PUBLIC_BACKEND_BASE=<your-koyeb-backend-url>
```

## Database: Neon

Create one Postgres database and copy the pooled or direct connection string into Koyeb as `DATABASE_URL`.

## Important Testing Note

Free backend hosting usually has ephemeral file storage. The database will persist in Neon, but uploaded PDFs, receipts, profile photos, and generated media may not survive a backend restart until we add proper file storage such as S3, Cloudflare R2, or similar.
