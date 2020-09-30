FROM node:erbium

RUN mkdir /usr/src/app

WORKDIR /usr/src/app

RUN npm i -g pm2

COPY . .

RUN ls -la

RUN npm ci

ENV NODE_ENV production

CMD ["pm2-runtime", "start", "app.js"]