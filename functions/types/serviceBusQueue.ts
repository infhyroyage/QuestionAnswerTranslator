export type IPRestrictionsMsg = {
  id: string;
  eventType: "AzureCloud.japaneast";
  subject: "ServiceTagDiscoveryAPI";
  data: {
    addressPrefixes: Array<string>;
    changeNumber: string;
  };
  dataVersion: string;
  metadataVersion: string;
  eventTime: string;
  topic: string;
};
