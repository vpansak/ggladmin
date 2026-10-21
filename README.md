# GGLADMIN

Separate, private administration dashboard for Gorakhpur's Got Latent. The dashboard reads application records from the existing GGL Neon PostgreSQL database and refreshes every 15 seconds.

## Required Vercel environment variables

- `DATABASE_URL`: same Neon PostgreSQL connection string used by the main GGL website.
- `GGLADMIN_PASSWORD`: a new, strong password only for this dashboard.
- `GGLADMIN_SESSION_SECRET`: a random secret of at least 32 characters, used to sign 8-hour HTTP-only sessions.

Never commit secrets into this repository. Add environment variables in Vercel Project Settings, then redeploy.

## Deploy

Import `vpansak/ggladmin` as a new Vercel project, add the environment variables above, and deploy. The repository is deliberately separate from the production GGL website.
