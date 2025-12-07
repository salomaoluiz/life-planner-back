FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

COPY . .
RUN corepack enable
RUN yarn install

RUN yarn prisma migrate deploy
RUN yarn prisma generate
RUN yarn build

EXPOSE 3000

CMD ["yarn", "start"]
