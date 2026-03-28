FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json packages/api/
COPY packages/connectors/package.json packages/connectors/
COPY packages/shared/package.json packages/shared/

RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

COPY packages/api ./packages/api
COPY packages/connectors ./packages/connectors
COPY packages/shared ./packages/shared
COPY prisma ./prisma
COPY tsconfig.base.json ./

RUN pnpm --filter @allstarfamhub/shared build && \
    pnpm --filter @allstarfamhub/connectors build && \
    pnpm --filter @allstarfamhub/api build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "packages/api/dist/server.js"]
