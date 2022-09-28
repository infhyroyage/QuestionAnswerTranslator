FROM mcr.microsoft.com/azure-functions/node:4-node16-core-tools

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

COPY functions /home/site/wwwroot/functions
COPY package.json /home/site/wwwroot/functions

WORKDIR /home/site/wwwroot/functions

RUN npm install && \
    npm run functions:build

CMD [ "npm", "run", "functions:start" ]
