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

FROM node:24-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile --ignore-scripts && yarn cache clean

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/src/main"]
