FROM node:20-bookworm AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run api:openapi:client \
  && npm run api:generate \
  && npm run build:ui \
  && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV DATABASE_URL=file:./scheduling.db

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages/core ./packages/core
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/dist/ui ./dist/ui

EXPOSE 4000

CMD ["sh", "-c", "npm run api:migrate:deploy && node ./node_modules/tsx/dist/cli.mjs apps/api/src/server.ts"]
