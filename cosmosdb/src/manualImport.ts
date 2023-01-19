import { CryptographyClient } from "@azure/keyvault-keys";
import deepcopy from "deepcopy";
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
  const cosmosClient = await generateCosmosClient();
  const initData: Data = await createManualImportData(
    manualImportJson,
    cosmosClient
  );
  console.log("createManualImportData: OK");

  // 非ローカル環境のみ、CosmosDBのデータベース・コンテナー・項目ごとに直列で、手動インポートデータの一部カラムを暗号化
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
          prevDatabaseData[containerName] = [];

          for (const item of initData[databaseName][containerName]) {
            const encryptedItem: Item = deepcopy(item);

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
                encryptedItem.incorrectChoicesExplanations = [];
                for (const incorrectChoiceExplanations of item.incorrectChoicesExplanations) {
                  if (incorrectChoiceExplanations) {
                    const encryptedIncorrectChoiceExplanations: number[][] =
                      await encryptStrings2NumberArrays(
                        incorrectChoiceExplanations,
                        cryptographyClient
                      );
                    encryptedItem.incorrectChoicesExplanations.push(
                      encryptedIncorrectChoiceExplanations
                    );
                  } else {
                    encryptedItem.incorrectChoicesExplanations.push(null);
                  }
                }
              }
            }
            prevDatabaseData[containerName].push(encryptedItem);
          }
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
