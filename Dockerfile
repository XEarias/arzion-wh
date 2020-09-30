FROM node:erbium

WORKDIR /usr/src/app

RUN npm i -g pm2

COPY . .

RUN npm ci

ENV NODE_ENV production

CMD ["pm2", "start", "index.js"]