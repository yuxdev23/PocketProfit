# PocketProfit — production image
# Next.js 15 + Prisma + SQLite. The DB and uploaded receipts live on a
# persistent Railway volume (mounted at /data) — see docker-entrypoint.sh.
FROM oven/bun:1

WORKDIR /app

# OpenSSL is required by Prisma's query engine at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first (cached layer). Keeps devDeps too —
# the Prisma CLI is needed at runtime for `prisma migrate deploy`.
COPY package.json bun.lock ./
RUN bun install

# Copy the rest of the app.
COPY . .

# Build-time placeholder so `prisma generate` / `next build` never trip on a
# missing env. Railway overrides DATABASE_URL at runtime (see entrypoint).
ENV DATABASE_URL="file:/tmp/build.db"
ENV NODE_ENV=production

# Generate the Prisma client and build the production bundle.
RUN bunx prisma generate \
  && bun run build

# Entrypoint links uploads onto the volume, applies migrations, starts Next.
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Railway provides $PORT; `next start` reads it automatically.
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
