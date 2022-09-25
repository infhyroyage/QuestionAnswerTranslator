import { CosmosClient } from "@azure/cosmos";
import initialImportJson from "../data/initialImport.json";
import manualImportJson from "../data/manualImport.json";
import { Data } from "../types/common";
import {
  createDatabasesAndContainers,
  bulkUpsertAllItems,
  createInitialImportData,
  createManualImportData,
  upsertAndSleepAllItems,
} from "./common";

const COSMOSDB_LOCAL_KEY =
  "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";
const COSMOSDB_LOCAL_URI = "https://localhost:9230";

const main = async () => {
  // 初期インポートデータ作成
  const cosmosClient = new CosmosClient({
    endpoint: COSMOSDB_LOCAL_URI,
    key: COSMOSDB_LOCAL_KEY,
  });
  const initialImportData: Data = await createInitialImportData(
    initialImportJson,
    cosmosClient
  );
  console.log("createInitialImportData: OK");

  // 初期インポートデータの各データベース・コンテナー作成
  await createDatabasesAndContainers(initialImportData, cosmosClient);
  console.log("1st createDatabasesAndContainers: OK");

  // 初期インポートデータのBulkUpsert
  const bulkUpsertPromisses = bulkUpsertAllItems(
    initialImportData,
    cosmosClient
  );
  const responsesBulkUpsert = await Promise.all(bulkUpsertPromisses);

  // レスポンス正常性チェック
  const firstErrorResponseBulkUpsert = responsesBulkUpsert
    .flat()
    .find((res) => res.statusCode >= 400);
  if (firstErrorResponseBulkUpsert) {
    throw new Error(
      `Status Code ${firstErrorResponseBulkUpsert.statusCode}: ${JSON.stringify(
        firstErrorResponseBulkUpsert.resourceBody
      )}`
    );
  }
  console.log("Import Initial Import Data: OK");

  // 手動インポートデータ作成
  const manualImportData: Data = await createManualImportData(
    manualImportJson,
    cosmosClient
  );
  console.log("createManualImportData: OK");

  // 手動インポートデータの各データベース・コンテナー作成
  await createDatabasesAndContainers(manualImportData, cosmosClient);
  console.log("2nd createDatabasesAndContainers: OK");

  // 暗号化した手動インポートデータのUpsert
  // 暫定でUpsert実行の合間に3秒間sleepする
  const responsesAll = await upsertAndSleepAllItems(
    manualImportData,
    cosmosClient,
    3000
  );

  // レスポンス正常性チェック
  const firstErrorResponse = responsesAll
    .flat()
    .find((res) => res.statusCode >= 400);
  if (firstErrorResponse) {
    throw new Error(
      `Status Code ${firstErrorResponse.statusCode}: ${JSON.stringify(
        firstErrorResponse.item
      )}`
    );
  }
  console.log("Import Manual Import Data: OK");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
