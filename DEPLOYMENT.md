# Recyclr CRM Test Deployment

Recommended free/low-cost testing stack:

- GitHub private repo: source of truth.
- Neon: hosted Postgres database.
- Render: Django backend.
- Vercel: Next.js frontend.

## Backend: Render

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
DJANGO_ALLOWED_HOSTS=<your-render-hostname>
DJANGO_CORS_ALLOW_ALL_ORIGINS=False
DJANGO_CORS_ALLOWED_ORIGINS=<your-vercel-frontend-url>
DATABASE_URL=<neon-postgres-connection-string>
DATABASE_SSL_REQUIRE=True
FRONTEND_BASE_URL=<your-vercel-frontend-url>
BACKEND_BASE_URL=<your-render-backend-url>
```

Optional first-login bootstrap user:

```text
BOOTSTRAP_ADMIN_USERNAME=Jay.Gallagher
BOOTSTRAP_ADMIN_PASSWORD=<temporary password>
BOOTSTRAP_ADMIN_EMAIL=jay.gallagher@recyclrgroup.co.uk
BOOTSTRAP_ADMIN_FIRST_NAME=Jay
BOOTSTRAP_ADMIN_LAST_NAME=Gallagher
BOOTSTRAP_ADMIN_JOB_TITLE=Founder
```

After the first successful hosted login, remove `BOOTSTRAP_ADMIN_PASSWORD` from Render so later deploys do not keep resetting that password.

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
NEXT_PUBLIC_BACKEND_BASE=<your-render-backend-url>
```

## Database: Neon

Create one Postgres database and copy the connection string into Render as `DATABASE_URL`.

## Important Testing Note

Free backend hosting usually has ephemeral file storage. The database will persist in Neon, but uploaded PDFs, receipts, profile photos, and generated media may not survive a backend restart until we add proper file storage such as S3, Cloudflare R2, or similar.
