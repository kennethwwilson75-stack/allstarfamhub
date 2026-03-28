FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/workers/package.json packages/workers/
COPY packages/connectors/package.json packages/connectors/
COPY packages/shared/package.json packages/shared/

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY packages/workers ./packages/workers
COPY packages/connectors ./packages/connectors
COPY packages/shared ./packages/shared
COPY prisma ./prisma
COPY tsconfig.base.json ./

RUN pnpm --filter @allstarfamhub/shared build && \
    pnpm --filter @allstarfamhub/connectors build && \
    pnpm --filter @allstarfamhub/workers build

RUN npx playwright install chromium

ENV NODE_ENV=production

CMD ["node", "packages/workers/dist/scraper-worker.js"]
