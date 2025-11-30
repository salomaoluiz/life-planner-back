FROM node:24.11.1-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

COPY . .
RUN corepack enable
RUN yarn install

RUN yarn build

EXPOSE 3000

CMD ["yarn", "start"]
