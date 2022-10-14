FROM node:16.17.0-alpine3.16 as build
WORKDIR /home/node
COPY package*.json ./
RUN npm install
COPY react ./
RUN npm run react:build

FROM nginx:1.23.1
COPY react/nginx.conf /etc/nginx
COPY --from=build /home/node/build /usr/share/nginx/html
