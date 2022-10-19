import { CryptographyClient } from "@azure/keyvault-keys";
import deepcopy from "deepcopy";
import manualImportJson from "../data/manualImport.json";
import { Data, DatabaseData, Item } from "../types/common";
import {
  createDatabasesAndContainers,
  encryptStrings2NumberArrays,
  generateCosmosClient,
  upsertAndSleepAllItems,
  createCryptographyClient,
  createManualImportData,
} from "./common";

const main = async () => {
  // 手動インポートデータ作成
  const cosmosReadonlyClient = await generateCosmosClient(true);
  const initData: Data = await createManualImportData(
    manualImportJson,
    cosmosReadonlyClient
  );
  console.log("createManualImportData: OK");

  // 各データベース・コンテナー作成
  const cosmosClient = await generateCosmosClient(false);
  await createDatabasesAndContainers(initData, cosmosClient);
  console.log("createDatabasesAndContainers: OK");

  // 非localhost環境のみ、CosmosDBのデータベース・コンテナーごとに直列で、手動インポートデータの一部カラムを暗号化
  const cryptographyClient: CryptographyClient =
    await createCryptographyClient();
  const encryptedInitData: Data = await Object.keys(initData).reduce(
    async (prevDatabasePromise: Promise<Data>, databaseName: string) => {
      const prevData: Data = await prevDatabasePromise;

      prevData[databaseName] = await Object.keys(initData[databaseName]).reduce(
        async (
          prevContainerPromise: Promise<DatabaseData>,
          containerName: string
        ) => {
          const prevDatabaseData: DatabaseData = await prevContainerPromise;

          // 項目単位では並列で各カラムの暗号化を実行
          const encryptPromises = initData[databaseName][containerName].map(
            async (item: Item): Promise<Item> => {
              const encryptedItem = deepcopy(item);

              // UsersデータベースのQuestionコンテナーのCosmos DB未格納の項目において、
              // 以下のカラムの各要素の値をstring型→Uint8Array型→number[]型として暗号化
              // ・subjects
              // ・choices
              // ・explanations
              // ・incorrectChoicesExplanationsの各非空文字要素(Optional)
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
                if (item.incorrectChoicesExplanations) {
                  encryptedItem.incorrectChoiceExplanations =
                    item.incorrectChoicesExplanations.reduce(
                      async (
                        prevIncorrectChoicesExplanations: (number[][] | null)[],
                        incorrectChoiceExplanations: string[] | null
                      ) => {
                        if (incorrectChoiceExplanations) {
                          const encryptedIncorrectChoiceExplanations: number[][] =
                            await encryptStrings2NumberArrays(
                              incorrectChoiceExplanations,
                              cryptographyClient
                            );
                          prevIncorrectChoicesExplanations.push(
                            encryptedIncorrectChoiceExplanations
                          );
                        } else {
                          prevIncorrectChoicesExplanations.push(null);
                        }
                        return prevIncorrectChoicesExplanations;
                      },
                      []
                    );
                }
              }

              return encryptedItem;
            }
          );
          prevDatabaseData[containerName] = await Promise.all(encryptPromises);
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
  console.log("Manual Import Data Encrypt: OK");

  // 暗号化した手動インポートデータのUpsert
  // 暫定でUpsert実行の合間に3秒間sleepする
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
  console.log("Import Manual Import Data: OK");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
