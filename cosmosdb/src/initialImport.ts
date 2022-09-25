import { v4 as uuidv4 } from "uuid";
import initialImportJson from "../data/initialImport.json";
import { Data, DatabaseData, Item } from "../types/common";
import {
  createDatabasesAndContainers,
  bulkUpsertAllItems,
  generateCosmosClient,
  fetchInsertedImportJson,
} from "./common";

const main = async () => {
  // Cosmos DB未格納の全項目のみ抽出し、全項目にidカラムを付加
  const cosmosReadonlyClient = await generateCosmosClient(true);
  const insertedInitialImportJson: Data = await fetchInsertedImportJson(
    initialImportJson,
    cosmosReadonlyClient
  );
  const initData: Data = Object.keys(initialImportJson).reduce(
    (prevInitData: Data, databaseName: string) => {
      prevInitData[databaseName] = Object.keys(
        initialImportJson[databaseName]
      ).reduce((prevInitDatabaseData: DatabaseData, containerName: string) => {
        const insertedCourseNames: Set<string> = new Set<string>(
          insertedInitialImportJson[databaseName][containerName].map(
            (item: Item) => item.courseName
          )
        );
        const insertedTestNames: Set<string> = new Set<string>(
          insertedInitialImportJson[databaseName][containerName].map(
            (item: Item) => item.testName
          )
        );

        const nonInsertedItems: Item[] = initialImportJson[databaseName][
          containerName
        ].reduce((prevNonInsertedItems: Item[], item: Item) => {
          if (
            !insertedCourseNames.has(item.courseName) ||
            !insertedTestNames.has(item.testName)
          ) {
            prevNonInsertedItems.push({ ...item, id: uuidv4() });
          }

          return prevNonInsertedItems;
        }, []);

        if (nonInsertedItems.length) {
          prevInitDatabaseData[containerName] = nonInsertedItems;
        }

        return prevInitDatabaseData;
      }, {});
      return prevInitData;
    },
    {}
  );
  console.log("Filter and Add id columns: OK");

  // 各データベース・コンテナー作成
  const cosmosClient = await generateCosmosClient(false);
  await createDatabasesAndContainers(initData, cosmosClient);
  console.log("createDatabasesAndContainers: OK");

  // 初期データのBulkUpsert
  const bulkUpsertPromisses = bulkUpsertAllItems(initData, cosmosClient);
  if (bulkUpsertPromisses.length === 0) {
    console.log("There is no upsert item");
    return;
  }
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
