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

EXPOSE 3000

CMD ["yarn", "start"]
