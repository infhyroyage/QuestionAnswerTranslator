import { v4 as uuidv4 } from "uuid";
import initialImportJson from "../data/initialImport.json";
import { Data, DatabaseData, InitialImportItem } from "../types/common";
import {
  createDatabasesAndContainers,
  bulkUpsertAllItems,
  generateCosmosClient,
} from "./common";

const main = async () => {
  // 全項目にidカラムを付加
  const initData: Data = Object.keys(initialImportJson).reduce(
    (prevInitData: Data, databaseName: string) => {
      prevInitData[databaseName] = Object.keys(
        initialImportJson[databaseName]
      ).reduce((prevInitDatabaseData: DatabaseData, containerName: string) => {
        const items: InitialImportItem[] =
          initialImportJson[databaseName][containerName];
        prevInitDatabaseData[containerName] = items.map(
          (item: InitialImportItem) => {
            return { ...item, id: uuidv4() };
          }
        );
        return prevInitDatabaseData;
      }, {});
      return prevInitData;
    },
    {}
  );
  console.log("Add id columns: OK");

  // 各データベース・コンテナー作成
  const cosmosClient = await generateCosmosClient(false);
  await createDatabasesAndContainers(initData, cosmosClient);
  console.log("createDatabasesAndContainers: OK");

  // 初期データのBulkUpsert
  const bulkUpsertPromisses = bulkUpsertAllItems(initData, cosmosClient);
  const responsesAll = await Promise.all(bulkUpsertPromisses);

  // 各コンテナーのレスポンス正常性チェック
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
