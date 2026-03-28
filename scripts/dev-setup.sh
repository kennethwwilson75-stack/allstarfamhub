#!/usr/bin/env bash
set -euo pipefail

echo "Setting up All Star Fam Hub development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js required"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker required for local DB/Redis"; exit 1; }

# Install deps
pnpm install

# Start local infra
docker-compose up -d postgres redis
echo "Waiting for services..."
sleep 5

# Generate Prisma client
npx prisma generate --schema=prisma/schema.prisma

# Run migrations (if credentials are configured)
npx prisma migrate dev --schema=prisma/schema.prisma || echo "Migration skipped - check DATABASE_URL"

echo "Done! Run 'pnpm dev' to start all services."
