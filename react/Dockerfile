FROM node:16.17.0-alpine3.16 as build

COPY react /home/node/react
COPY package.json /home/node/react

WORKDIR /home/node/react

RUN npm install && \
    npm run react:build

FROM nginx:1.23.1

ENV REACT_APP_API_URL=https://qatranslator-je-apim.azure-api.net \
    REACT_APP_AZURE_AD_APP_REDIRECT_URI=https://qatranslator-je-appservice.azurewebsites.net

COPY react/nginx.conf /etc/nginx
COPY --from=build /home/node/react/build /usr/share/nginx/html
