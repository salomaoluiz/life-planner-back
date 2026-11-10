FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY . .

RUN corepack enable
RUN yarn install --ci

ENV DB_USER=user
ENV DB_PASSWORD=password
ENV DB_HOST=localhost
ENV DB_PORT=5432
ENV DB_NAME=mydatabase

RUN yarn prisma generate
RUN yarn build
RUN date -u +%Y-%m-%dT%H:%M:%SZ > build-time

# Spec 106: upload the source maps with debug ids for this release. The token exists only in this builder
# stage (never in the runtime image); without it the build still succeeds.
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_URL=https://sentry.io/
RUN if [ -n "$SENTRY_AUTH_TOKEN" ] && [ -n "$SENTRY_ORG" ] && [ -n "$SENTRY_PROJECT" ]; then \
      VERSION=$(node -p "require('./package.json').version") && \
      npx --yes @sentry/cli@2 sourcemaps inject dist && \
      npx @sentry/cli@2 sourcemaps upload --release "life-planner-back@$VERSION" dist; \
    else \
      echo "WARNING: SENTRY_AUTH_TOKEN, SENTRY_ORG or SENTRY_PROJECT not set: source maps were not uploaded"; \
    fi

FROM node:24-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile --ignore-scripts && yarn cache clean

COPY CHANGELOG.md ./
COPY --from=builder /app/build-time ./build-time
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Prisma downloads its schema engine on first use (--ignore-scripts skipped the postinstall).
# Fetch it now, so redeploying never depends on reaching the Prisma CDN at container start.
RUN DB_USER=user DB_PASSWORD=password DB_HOST=localhost DB_PORT=5432 DB_NAME=mydatabase \
    node_modules/.bin/prisma -v

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/src/main"]
