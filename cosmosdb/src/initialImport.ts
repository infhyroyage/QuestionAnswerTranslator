import { Data } from "../types/common";
import {
  createDatabasesAndContainers,
  bulkUpsertAllItems,
  generateCosmosClient,
  createInitialImportData,
} from "./common";

const main = async () => {
  // 初期インポートデータ作成
  const cosmosReadonlyClient = await generateCosmosClient(true);
  const importData: Data = await createInitialImportData(cosmosReadonlyClient);
  console.log("createInitialImportData: OK");

  // 各データベース・コンテナー作成
  const cosmosClient = await generateCosmosClient(false);
  await createDatabasesAndContainers(importData, cosmosClient);
  console.log("createDatabasesAndContainers: OK");

  // 初期インポートデータのBulkUpsert
  const bulkUpsertPromisses = bulkUpsertAllItems(importData, cosmosClient);
  const responsesAll = await Promise.all(bulkUpsertPromisses);

  // レスポンス正常性チェック
  const firstErrorResponse = responsesAll
    .flat()
    .find((res) => res.statusCode >= 400);
  if (firstErrorResponse) {
    throw new Error(
      `Status Code ${firstErrorResponse.statusCode}: ${JSON.stringify(
        firstErrorResponse.resourceBody
      )}`
    );
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
