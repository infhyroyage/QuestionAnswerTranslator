FROM mcr.microsoft.com/azure-functions/node:4-node16-core-tools

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

COPY . /home/site/wwwroot

WORKDIR /home/site/wwwroot

RUN npm install

CMD [ "npm", "run", "functions:start" ]
