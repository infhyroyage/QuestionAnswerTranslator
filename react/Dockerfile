FROM node:16.17.0-alpine3.16 as build

COPY react /home/node/react
COPY package.json /home/node/react

WORKDIR /home/node/react

RUN npm install && \
    npm run react:build

FROM nginx:1.23.1

COPY react/nginx.conf /etc/nginx
COPY --from=build /home/node/react/build /usr/share/nginx/html
