#!/bin/sh
set -e

# A single Railway volume is mounted at /data. Keep BOTH the SQLite database
# and the uploaded receipt images there so they survive restarts & redeploys.
mkdir -p /data/uploads

# src/lib/actions/upload.ts writes to <cwd>/uploads — link it onto the volume.
rm -rf /app/uploads
ln -s /data/uploads /app/uploads

# Apply database migrations to the volume DB (DATABASE_URL=file:/data/prod.db).
# On first boot this creates the database; afterwards it's a no-op.
echo "→ prisma migrate deploy ..."
bunx prisma migrate deploy

# Optional demo seed — runs only when SEED_DEMO=true (set it in Railway Variables).
# Safe: prisma/seed.ts only deletes+recreates the single demo account
# (napha@example.com); other/real accounts are never touched. Idempotent to re-run.
if [ "${SEED_DEMO:-}" = "true" ]; then
  echo "→ seeding demo account (SEED_DEMO=true) ..."
  bun run prisma/seed.ts || echo "⚠ seed failed (continuing to start anyway)"
fi

echo "→ starting PocketProfit ..."
exec bun run start
