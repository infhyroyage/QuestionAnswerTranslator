var apim = {
  backendsName: 'backends-functions'
  name: 'qatranslator-je-apim'
  namedValuesNames: {
    functionsDefaultHostKey: 'named-values-functions-default-host-key'
  }
}
var functions = {
  name: 'qatranslator-je-func'
}
var vault = {
  name: 'qatranslator-je-vault'
  secretNames: {
    functionsDefaultHostKey: 'functions-default-host-key'
  }
}

resource vaultSecretsFunctionsDefaultHostKey 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  name: '${vault.name}/${vault.secretNames.functionsDefaultHostKey}'
  properties: {
    attributes: {
      enabled: true
    }
    value: listKeys(
      resourceId('Microsoft.Web/sites/host', functions.name, 'default'),
      '2022-09-01'
    ).functionKeys.default
  }
}

resource apimNamedValuesFunctionsDefaultHostKey 'Microsoft.ApiManagement/service/namedValues@2022-08-01' = {
  name: '${apim.name}/${apim.namedValuesNames.functionsDefaultHostKey}'
  properties: {
    displayName: apim.namedValuesNames.functionsDefaultHostKey
    keyVault: {
      secretIdentifier: vaultSecretsFunctionsDefaultHostKey.properties.secretUri
    }
    secret: true
  }
}

resource apimBackends 'Microsoft.ApiManagement/service/backends@2022-08-01' = {
  name: '${apim.name}/${apim.backendsName}'
  properties: {
    description: functions.name
    url: 'https://${functions.name}.azurewebsites.net/api'
    protocol: 'http'
    resourceId: '${environment().resourceManager}${resourceId('Microsoft.Web/sites',functions.name)}'
    credentials: {
      header: {
        'x-functions-key': [
          '{{${apim.namedValuesNames.functionsDefaultHostKey}}}'
        ]
      }
    }
  }
  dependsOn: [apimNamedValuesFunctionsDefaultHostKey]
}
