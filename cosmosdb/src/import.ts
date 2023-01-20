import { CosmosClient } from "@azure/cosmos";
import { ImportData, Test } from "../types/common";
import {
  createDatabasesAndContainers,
  generateCosmosClient,
  createImportData,
  importTestItems,
  generateTestItems,
} from "./common";

const main = async () => {
  // インポートデータ作成
  const importData: ImportData = createImportData();
  console.log("createImportData: OK");

  // 各データベース・コンテナー作成
  const cosmosClient: CosmosClient = await generateCosmosClient();
  await createDatabasesAndContainers(cosmosClient);
  console.log("createDatabasesAndContainers: OK");

  // UsersテータベースのTestコンテナーの項目を生成
  const testItems: Test[] = await generateTestItems(importData, cosmosClient);
  console.log("generateTestItems: OK");

  // UsersテータベースのTestコンテナーの項目をインポート
  await importTestItems(testItems, cosmosClient);
  console.log("importTestItems: OK");

  // 手動インポートデータ作成
  // const manualImportData: Data = await createManualImportData(
  //   importData,
  //   cosmosClient
  // );
  // console.log("createManualImportData: OK");

  // 暗号化した手動インポートデータのUpsert
  // 暫定でUpsert実行の合間に1秒間sleepする
  // const responsesManualImport = await upsertAndSleepAllItems(
  //   manualImportData,
  //   cosmosClient,
  //   1000
  // );

  // レスポンス正常性チェック
  // const firstErrorResponseManualImport = responsesManualImport
  //   .flat()
  //   .find((res) => res.statusCode >= 400);
  // if (firstErrorResponseManualImport) {
  //   throw new Error(
  //     `Status Code ${
  //       firstErrorResponseManualImport.statusCode
  //     }: ${JSON.stringify(firstErrorResponseManualImport.item)}`
  //   );
  // }
  // console.log("Import Manual Import Data: OK");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
