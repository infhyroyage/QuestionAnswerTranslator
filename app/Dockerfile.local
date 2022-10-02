FROM node:16.17.0-alpine3.16

COPY app /home/node/app
COPY package.json /home/node/app

WORKDIR /home/node/app

RUN npm install

CMD [ "npm", "run", "app:start" ]
