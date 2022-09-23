import { CryptographyClient } from "@azure/keyvault-keys";
import deepcopy from "deepcopy";
import manualImportJson from "../data/manualImport.json";
import {
  Data,
  DatabaseData,
  Item,
  ManualImportItem,
  TestName2TestId,
} from "../types/common";
import {
  createDatabasesAndContainers,
  encryptStrings2NumberArrays,
  generateCosmosClient,
  upsertAndSleepAllItems,
  filterInsertedManualInitData,
  getTestName2TestId,
  createCryptographyClient,
} from "./common";

const main = async () => {
  // 全項目にid、testIdカラムを付加
  const cosmosClient = await generateCosmosClient(false);
  const testName2TestId: TestName2TestId = await getTestName2TestId(
    cosmosClient
  );
  const initData: Data = Object.keys(manualImportJson).reduce(
    (prevInitData: Data, databaseName: string) => {
      prevInitData[databaseName] = Object.keys(
        manualImportJson[databaseName]
      ).reduce((prevInitDatabaseData: DatabaseData, containerName: string) => {
        const items: ManualImportItem[] =
          manualImportJson[databaseName][containerName];
        prevInitDatabaseData[containerName] = items.map(
          (item: ManualImportItem) => {
            const testId: string = testName2TestId[item.testName];
            return {
              ...item,
              id: `${testId}_${item.number}`,
              testId,
            };
          }
        );
        return prevInitDatabaseData;
      }, {});
      return prevInitData;
    },
    {}
  );
  console.log("Add id and testId columns: OK");

  // 各データベース・コンテナー作成
  await createDatabasesAndContainers(initData, cosmosClient);
  console.log("createDatabasesAndContainers: OK");

  // Cosmos DB格納済の項目は当インポート処理の対象外とするようにフィルタリング
  const cosmosReadonlyClient = await generateCosmosClient(true);
  const nonInsertedInitData: Data = await filterInsertedManualInitData(
    initData,
    cosmosReadonlyClient
  );
  console.log("Filtering: OK");

  // 非localhost環境のみ、CosmosDBのデータベース・コンテナーごとに直列で、手動インポートデータの一部カラムを暗号化
  let encryptedInitData: Data;
  if (process.env["NODE_TLS_REJECT_UNAUTHORIZED"] === "0") {
    encryptedInitData = deepcopy(nonInsertedInitData);
  } else {
    const cryptographyClient: CryptographyClient =
      await createCryptographyClient();
    encryptedInitData = await Object.keys(nonInsertedInitData).reduce(
      async (prevDatabasePromise: Promise<Data>, databaseName: string) => {
        const prevData: Data = await prevDatabasePromise;

        prevData[databaseName] = await Object.keys(
          nonInsertedInitData[databaseName]
        ).reduce(
          async (
            prevContainerPromise: Promise<DatabaseData>,
            containerName: string
          ) => {
            const prevDatabaseData: DatabaseData = await prevContainerPromise;

            // 項目単位では並列で各カラムの暗号化を実行
            const encryptPromises = nonInsertedInitData[databaseName][
              containerName
            ].map(async (item: Item): Promise<Item> => {
              const encryptedItem = deepcopy(item);

              // UsersデータベースのQuestionコンテナーのCosmos DB未格納の項目において、
              // 以下のカラムの各要素の値をstring型→Uint8Array型→number[]型として暗号化
              // ・subjects
              // ・choices
              // ・explanations
              if (databaseName === "Users" && containerName === "Question") {
                encryptedItem.subjects = await encryptStrings2NumberArrays(
                  item.subjects,
                  cryptographyClient
                );
                encryptedItem.choices = await encryptStrings2NumberArrays(
                  item.choices,
                  cryptographyClient
                );
                encryptedItem.explanations = await encryptStrings2NumberArrays(
                  item.explanations,
                  cryptographyClient
                );
              }

              return encryptedItem;
            });
            prevDatabaseData[containerName] = await Promise.all(
              encryptPromises
            );
            console.log(
              `Database ${databaseName}, Container ${containerName}: Encryption OK`
            );

            return prevDatabaseData;
          },
          Promise.resolve({})
        );

        return prevData;
      },
      Promise.resolve({})
    );
  }

  // 暗号化した初期データのUpsert(暫定でUpsert実行の合間に3秒間sleepする)
  const responsesAll = await upsertAndSleepAllItems(
    encryptedInitData,
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
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
