import { CosmosClient } from "@azure/cosmos";
import { ImportData, Question, Test } from "../types/common";
import {
  createDatabasesAndContainers,
  generateCosmosClient,
  createImportData,
  importTestItems,
  generateTestItems,
  generateQuestionItems,
  importQuestionItemsAndSleep,
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

  // UsersテータベースのQuestionコンテナーの項目を生成
  const questionItems: Question[] = await generateQuestionItems(
    importData,
    cosmosClient,
    testItems
  );
  console.log("generateQuestionItems: OK");

  // UsersテータベースのQuestionコンテナーの項目をインポート
  // 暫定でsleepの秒数はローカル環境で1秒、非ローカル環境で3秒とする
  await importQuestionItemsAndSleep(
    questionItems,
    cosmosClient,
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] ? 1000 : 3000
  );
  console.log("importQuestionItemsAndSleep: OK");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
