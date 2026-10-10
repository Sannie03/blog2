# bogs2 local development

This copy uses its own PostgreSQL database, Docker volume and secrets.

Start Docker Desktop first, then run:

```powershell
cd D:\bogs2\backend
docker compose up -d --wait
npm run migrate
npm run bootstrap-admin
npm run dev
```

The bootstrap command creates or resets the account specified by the
`SUPERADMIN_*` values in `backend/.env`. It does not print the password.

In another terminal:

```powershell
cd D:\bogs2\frontend
npm run dev
```

Open http://localhost:5173/admin and use the username and password in
`backend/.env`. Keep both development terminals running.

Database: `bogs2`, port `5434`, container `bogs2_postgres`, volume
`bogs2_postgres_data`. Uploaded images stay in `backend/uploads` while
Cloudinary credentials are empty. Analytics and advertising are disabled until
you provide your own IDs. Configure your new API and public site URLs before
deployment; the previous project's Vercel API rewrites have been removed.
