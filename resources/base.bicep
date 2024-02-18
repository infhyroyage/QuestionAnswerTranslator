param azureAdEAContributorObjectId string
@secure()
param azureApimPublisherEmail string
@secure()
param deeplAuthKey string
param location string = resourceGroup().location

var apimApisName = 'apis-functions'
var apisHealthcheckName = 'apis-healthcheck-functions'
var apimLoggersName = 'loggers-insights'
var apimName = 'qatranslator-je-apim'
var apimNamedValuesNames = {
  insightsInstrumentationKey: 'named-values-insights-instrumentation-key'
}
var apimOrgName = 'qatranslator-je-apim-org'

var translatorName = 'qatranslator-je-cognitive'

var cosmosDBContainerNames = {
  flag: 'Flag'
  question: 'Question'
  test: 'Test'
}
var cosmosDBDatabaseNames = {
  systems: 'Systems'
  users: 'Users'
}
var cosmosDBName = 'qatranslator-je-cosmosdb'

var functionsPlanName = 'qatranslator-je-funcplan'
var functionsName = 'qatranslator-je-func'

var insightsName = 'qatranslator-je-insights'

var lawName = 'qatranslator-je-law'

var storageBlobContainerName = 'import-items'
var storageName = 'qatranslatorjesa'

var vaultName = 'qatranslator-je-vault'
var vaultSecretNames = {
  cognitiveKey: 'cognitive-key'
  cosmosDBPrimaryKey: 'cosmos-db-primary-key'
  cosmosDBPrimaryReadonlyKey: 'cosmos-db-primary-readonly-key'
  deeplAuthKey: 'deepl-auth-key'
  insightsConnectionString: 'insights-connection-string'
  insightsInstrumentationKey: 'insights-instrumentation-key'
  storageConnectionString: 'storage-connection-string'
}

// API Management
resource apim 'Microsoft.ApiManagement/service@2022-08-01' = {
  name: apimName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'Consumption'
    capacity: 0
  }
  properties: {
    customProperties: {
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Protocols.Server.Http2': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Ssl30': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls10': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls11': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls10': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls11': 'false'
    }
    publisherEmail: azureApimPublisherEmail
    publisherName: apimOrgName
  }
}
resource apimApis 'Microsoft.ApiManagement/service/apis@2022-08-01' = {
  parent: apim
  name: apimApisName
  properties: {
    apiRevision: '1'
    description: 'QuestionAnswerPortalでのWebアプリケーションから実行するAPIリファレンスです'
    displayName: 'QuestionAnswerPortalAPIs'
    isCurrent: true
    path: 'api'
    protocols: ['https']
    subscriptionRequired: false
  }
  dependsOn: [functions]
}
resource apimApisHealthcheck 'Microsoft.ApiManagement/service/apis@2022-08-01' = {
  parent: apim
  name: apisHealthcheckName
  properties: {
    apiRevision: '1'
    description: 'FunctionsのヘルスチェックAPIリファレンスです'
    displayName: 'HealthCheckAPIs'
    isCurrent: true
    path: ''
    protocols: ['https']
    subscriptionRequired: true
  }
  dependsOn: [functions]
}
resource apimNamedValuesInsightsInstrumentationKey 'Microsoft.ApiManagement/service/namedValues@2022-08-01' = {
  parent: apim
  name: apimNamedValuesNames.insightsInstrumentationKey
  properties: {
    displayName: apimNamedValuesNames.insightsInstrumentationKey
    keyVault: {
      secretIdentifier: vaultSecretsInsightsInstrumentationKey.properties.secretUri
    }
    secret: true
  }
}
resource apimLoggers 'Microsoft.ApiManagement/service/loggers@2022-08-01' = {
  parent: apim
  name: apimLoggersName
  properties: {
    credentials: {
      instrumentationKey: '{{${apimNamedValuesNames.insightsInstrumentationKey}}}'
    }
    loggerType: 'applicationInsights'
    resourceId: insights.id
  }
  dependsOn: [apimNamedValuesInsightsInstrumentationKey]
}
resource apimDiagnosticsInsights 'Microsoft.ApiManagement/service/diagnostics@2022-08-01' = {
  parent: apim
  name: 'applicationinsights'
  properties: {
    alwaysLog: 'allErrors'
    httpCorrelationProtocol: 'Legacy'
    logClientIp: true
    loggerId: apimLoggers.id
    sampling: {
      percentage: 100
      samplingType: 'fixed'
    }
  }
}

// Translator
resource translator 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: translatorName
  location: location
  sku: {
    name: 'F0'
  }
  kind: 'TextTranslation'
  properties: {
    publicNetworkAccess: 'Enabled'
  }
}

// Cosmos DB
resource cosmosDB 'Microsoft.DocumentDb/databaseAccounts@2023-04-15' = {
  kind: 'GlobalDocumentDB'
  name: cosmosDBName
  location: location
  properties: {
    backupPolicy: {
      periodicModeProperties: {
        backupIntervalInMinutes: 240
        backupRetentionIntervalInHours: 8
        backupStorageRedundancy: 'Local'
      }
      type: 'Periodic'
    }
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    capacity: {
      totalThroughputLimit: 4000
    }
    consistencyPolicy: {
      defaultConsistencyLevel: 'Eventual'
    }
    databaseAccountOfferType: 'Standard'
    enableFreeTier: false
    ipRules: []
    isVirtualNetworkFilterEnabled: false
    locations: [
      {
        failoverPriority: 0
        locationName: location
      }
    ]
    virtualNetworkRules: []
  }
  tags: {
    defaultExperience: 'false'
    'hidden-cosmos-mmspecial': ''
  }
}
resource cosmosDBDatabaseSystems 'Microsoft.DocumentDb/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosDB
  name: cosmosDBDatabaseNames.systems
  properties: {
    resource: {
      id: cosmosDBDatabaseNames.systems
    }
  }
}
resource cosmosDBDatabaseSystemsContainerFlag 'Microsoft.DocumentDb/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: cosmosDBDatabaseSystems
  name: cosmosDBContainerNames.flag
  properties: {
    resource: {
      id: cosmosDBContainerNames.flag
      partitionKey: {
        paths: ['/id']
      }
    }
  }
}
resource cosmosDBDatabaseUsers 'Microsoft.DocumentDb/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosDB
  name: cosmosDBDatabaseNames.users
  properties: {
    resource: {
      id: cosmosDBDatabaseNames.users
    }
  }
}
resource cosmosDBDatabaseUsersContainerTest 'Microsoft.DocumentDb/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: cosmosDBDatabaseUsers
  name: cosmosDBContainerNames.test
  properties: {
    resource: {
      id: cosmosDBContainerNames.test
      indexingPolicy: {
        compositeIndexes: [
          [
            {
              order: 'ascending'
              path: '/courseName'
            }
            {
              order: 'ascending'
              path: '/testName'
            }
          ]
        ]
      }
      partitionKey: {
        paths: ['/id']
      }
    }
  }
}
resource cosmosDBDatabaseUsersContainerQuestion 'Microsoft.DocumentDb/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: cosmosDBDatabaseUsers
  name: cosmosDBContainerNames.question
  properties: {
    resource: {
      id: cosmosDBContainerNames.question
      partitionKey: {
        paths: ['/id']
      }
    }
  }
}

// Storage Account
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}
resource storageBlob 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storage
  name: 'default'
  properties: {
    cors: {
      corsRules: []
    }
    deleteRetentionPolicy: {
      allowPermanentDelete: false
      enabled: false
    }
  }
}
resource storageBlobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: storageBlob
  name: storageBlobContainerName
  properties: {
    immutableStorageWithVersioning: {
      enabled: false
    }
    defaultEncryptionScope: '$account-encryption-key'
    denyEncryptionScopeOverride: false
    publicAccess: 'None'
  }
}

// Log Analytics Workspaces
resource law 'Microsoft.OperationalInsights/workspaces@2021-06-01' = {
  name: lawName
  location: location
  properties: {
    sku: {
      name: 'pergb2018'
    }
  }
}

// Application Insights
resource insights 'microsoft.insights/components@2020-02-02' = {
  name: insightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Flow_Type: 'Bluefield'
    Request_Source: 'rest'
    WorkspaceResourceId: law.id
  }
}

// Functions
resource functionsPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: functionsPlanName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: ''
}
resource functions 'Microsoft.Web/sites@2022-09-01' = {
  name: functionsName
  location: location
  tags: {
    'hidden-link: /app-insights-resource-id': insights.id
  }
  identity: {
    type: 'SystemAssigned'
  }
  kind: 'functionapp'
  properties: {
    clientAffinityEnabled: false
    httpsOnly: true
    serverFarmId: functionsPlan.id
    siteConfig: {
      appSettings: [
        {
          name: 'COSMOSDB_URI'
          value: 'https://${cosmosDBName}.documents.azure.com:443'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_ENABLE_SYNC_UPDATE_SITE'
          value: 'true'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
      ]
      cors: {
        allowedOrigins: ['https://portal.azure.com']
      }
      ftpsState: 'Disabled'
      keyVaultReferenceIdentity: 'SystemAssigned'
      netFrameworkVersion: 'v6.0'
      use32BitWorkerProcess: false
    }
  }
}

// Key Vault
resource vault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: vaultName
  location: location
  properties: {
    accessPolicies: [
      {
        objectId: azureAdEAContributorObjectId
        tenantId: tenant().tenantId
        permissions: {
          keys: []
          secrets: ['Get', 'Set']
          certificates: []
        }
      }
      {
        objectId: apim.identity.principalId
        tenantId: tenant().tenantId
        permissions: {
          keys: []
          secrets: ['Get', 'list']
          certificates: []
        }
      }
      {
        objectId: functions.identity.principalId
        tenantId: tenant().tenantId
        permissions: {
          keys: []
          secrets: ['Get']
          certificates: []
        }
      }
    ]
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    enableRbacAuthorization: false
    enableSoftDelete: true
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'allow'
      ipRules: []
      virtualNetworkRules: []
    }
    publicNetworkAccess: 'Enabled'
    sku: {
      family: 'A'
      name: 'standard'
    }
    softDeleteRetentionInDays: 90
    tenantId: tenant().tenantId
  }
}
resource vaultSecretsCognitiveKey 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: vault
  name: vaultSecretNames.cognitiveKey
  properties: {
    attributes: {
      enabled: true
    }
    value: translator.listKeys().key1
  }
}
resource vaultSecretsCosmosDBPrimaryKey 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: vault
  name: vaultSecretNames.cosmosDBPrimaryKey
  properties: {
    attributes: {
      enabled: true
    }
    value: cosmosDB.listKeys().primaryMasterKey
  }
}
resource vaultSecretsCosmosDBPrimaryReadonlyKey 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: vault
  name: vaultSecretNames.cosmosDBPrimaryReadonlyKey
  properties: {
    attributes: {
      enabled: true
    }
    value: cosmosDB.listKeys().primaryReadonlyMasterKey
  }
}
resource vaultSecretsDeeplAuthKey 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: vault
  name: vaultSecretNames.deeplAuthKey
  properties: {
    attributes: {
      enabled: true
    }
    value: deeplAuthKey
  }
}
resource vaultSecretsInsightsConnectionString 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: vault
  name: vaultSecretNames.insightsConnectionString
  properties: {
    attributes: {
      enabled: true
    }
    value: insights.properties.ConnectionString
  }
}
resource vaultSecretsInsightsInstrumentationKey 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: vault
  name: vaultSecretNames.insightsInstrumentationKey
  properties: {
    attributes: {
      enabled: true
    }
    value: insights.properties.InstrumentationKey
  }
}
resource vaultSecretsStorageConnectionString 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: vault
  name: vaultSecretNames.storageConnectionString
  properties: {
    attributes: {
      enabled: true
    }
    value: 'DefaultEndpointsProtocol=https;AccountName=${storageName};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
  }
}
