import { Context } from "@azure/functions";
import { ImportItem } from "../../types/import";
import {
  getReadOnlyContainer,
  getReadWriteContainer,
} from "../shared/cosmosDBWrapper";
import { FeedResponse, ItemResponse, SqlQuerySpec } from "@azure/cosmos";
import { v4 as uuidv4 } from "uuid";
import { Question, Test } from "../cosmosDB";
import { CryptographyClient } from "@azure/keyvault-keys";
import {
  createCryptographyClient,
  decryptNumberArrays2Strings,
  encryptStrings2NumberArrays,
} from "../shared/vaultWrapper";
import deepEqual from "fast-deep-equal";

const COSMOS_DB_DATABASE_NAME = "Users";
const COSMOS_DB_CONTAINER_NAMES = { test: "Test", question: "Question" };
const VAULT_CRYPTOGRAPHY_KEY_NAME = "manual-import-data";

export default async (context: Context): Promise<void> => {
  try {
    const courseName: string = context.bindingData.courseName;
    const testName: string = context.bindingData.testName;
    context.log.info({ courseName, testName });

    // Blobトリガーで受け取ったjsonファイルのバイナリデータをImportItem[]型として読込み
    const jsonData: ImportItem[] = JSON.parse(
      context.bindings.jsonContentBinary.toString()
    );

    // UsersテータベースのTestコンテナーの項目を取得
    const testQuery: SqlQuerySpec = {
      query:
        "SELECT * FROM c WHERE c.courseName = @courseName and c.testName = @testName",
      parameters: [
        { name: "@courseName", value: courseName },
        { name: "@testName", value: testName },
      ],
    };
    const insertedTestItemsRes: FeedResponse<Test> = await getReadOnlyContainer(
      COSMOS_DB_DATABASE_NAME,
      COSMOS_DB_CONTAINER_NAMES.test
    )
      .items.query<Test>(testQuery)
      .fetchAll();
    const insertedTestItems: Test[] = insertedTestItemsRes.resources;
    context.log.info({ insertedTestItems });
    if (insertedTestItems.length > 1) {
      throw new Error("Not Unique Test");
    }

    // 取得したUsersテータベースのTestコンテナーの項目が存在し差分がない場合以外はupsert
    let testId: string;
    if (
      insertedTestItems.length === 0 ||
      (insertedTestItems.length === 1 &&
        insertedTestItems[0].length !== jsonData.length)
    ) {
      testId =
        insertedTestItems.length === 0 ? uuidv4() : insertedTestItems[0].id;
      const upsertTestItem: Test = {
        courseName,
        testName,
        id: testId,
        length: jsonData.length,
      };
      context.log.info({ upsertTestItem });
      const res: ItemResponse<Test> = await getReadWriteContainer(
        COSMOS_DB_DATABASE_NAME,
        COSMOS_DB_CONTAINER_NAMES.test
      ).items.upsert<Test>(upsertTestItem);
      if (res.statusCode >= 400) {
        throw new Error(
          `Status Code ${res.statusCode}: ${JSON.stringify(upsertTestItem)}`
        );
      }
    } else {
      testId = insertedTestItems[0].id;
    }

    // UsersテータベースのQuestionコンテナーの項目を全取得
    let insertedQuestionItems: Question[] = [];
    if (insertedTestItems.length > 0) {
      // UsersテータベースのTestコンテナーの項目が取得できた場合のみクエリを実行
      const questionQuery: SqlQuerySpec = {
        query: "SELECT * FROM c WHERE c.testId = @testId",
        parameters: [{ name: "@testId", value: testId }],
      };
      const insertedQuestionItemsRes: FeedResponse<Question> =
        await getReadOnlyContainer(
          COSMOS_DB_DATABASE_NAME,
          COSMOS_DB_CONTAINER_NAMES.question
        )
          .items.query<Question>(questionQuery)
          .fetchAll();
      insertedQuestionItems = insertedQuestionItemsRes.resources;
    }

    // 取得したUsersテータベースのQuestionコンテナーの各項目を復号化
    let insertedImportItems: ImportItem[] = [];
    const cryptographyClient: CryptographyClient =
      await createCryptographyClient(VAULT_CRYPTOGRAPHY_KEY_NAME);
    const decryptPromises: Promise<ImportItem>[] = insertedQuestionItems.map(
      async (insertedQuestionItem: Question) => {
        const subjects: string[] = await decryptNumberArrays2Strings(
          insertedQuestionItem.subjects as number[][],
          cryptographyClient
        );

        const choices: string[] = await decryptNumberArrays2Strings(
          insertedQuestionItem.choices as number[][],
          cryptographyClient
        );

        let explanations: string[] | undefined = undefined;
        if (insertedQuestionItem.explanations) {
          explanations = await decryptNumberArrays2Strings(
            insertedQuestionItem.explanations as number[][],
            cryptographyClient
          );
        }

        let incorrectChoicesExplanations: (string[] | null)[] | undefined =
          undefined;
        if (insertedQuestionItem.incorrectChoicesExplanations) {
          incorrectChoicesExplanations = [];
          for (const incorrectChoiceExplanations of insertedQuestionItem.incorrectChoicesExplanations) {
            if (incorrectChoiceExplanations) {
              const decryptedIncorrectChoiceExplanations: string[] =
                await decryptNumberArrays2Strings(
                  incorrectChoiceExplanations as number[][],
                  cryptographyClient
                );
              incorrectChoicesExplanations.push(
                decryptedIncorrectChoiceExplanations
              );
            } else {
              incorrectChoicesExplanations.push(null);
            }
          }
        }

        return {
          subjects,
          choices,
          correctIdxes: insertedQuestionItem.correctIdxes,
          explanations,
          incorrectChoicesExplanations,
          indicateImgIdxes: insertedQuestionItem.indicateImgIdxes,
          escapeTranslatedIdxes: insertedQuestionItem.escapeTranslatedIdxes,
          references: insertedQuestionItem.references,
        };
      }
    );
    if (insertedQuestionItems.length > 0) {
      insertedImportItems = await Promise.all<Promise<ImportItem>[]>(
        decryptPromises
      );
    }
    context.log.info({ insertedImportItems });

    // 読み込んだjsonファイルの各ImportItemにて、取得したUsersテータベースの
    // Questionコンテナーに存在して差分がない項目を抽出
    const upsertImportItems: ImportItem[] = jsonData.reduce(
      (prev: ImportItem[], jsonImportItem: ImportItem, idx: number) => {
        const insertedQuestionItem: ImportItem | undefined =
          insertedImportItems.find((insertedImportItem: ImportItem) => {
            if (idx === 0)
              context.log.info({ insertedImportItem, jsonImportItem });
            return deepEqual(insertedImportItem, jsonImportItem);
          });
        if (!insertedQuestionItem) {
          prev.push(jsonImportItem);
        }
        return prev;
      },
      []
    );
    context.log.info({ upsertImportItems });

    // 抽出したUsersテータベースのQuestionコンテナーの各項目を暗号化
    let upsertQuestionItems: Question[] = [];
    const encryptPromises: Promise<Question>[] = upsertImportItems.map(
      async (upsertImportItem: ImportItem, idx: number) => {
        const subjects: number[][] = await encryptStrings2NumberArrays(
          upsertImportItem.subjects as string[],
          cryptographyClient
        );

        const choices: number[][] = await encryptStrings2NumberArrays(
          upsertImportItem.choices as string[],
          cryptographyClient
        );

        let explanations: number[][] | undefined = undefined;
        if (upsertImportItem.explanations) {
          explanations = await encryptStrings2NumberArrays(
            upsertImportItem.explanations as string[],
            cryptographyClient
          );
        }

        let incorrectChoicesExplanations: (number[][] | null)[] | undefined =
          undefined;
        if (upsertImportItem.incorrectChoicesExplanations) {
          incorrectChoicesExplanations = [];
          for (const incorrectChoiceExplanations of upsertImportItem.incorrectChoicesExplanations) {
            if (incorrectChoiceExplanations) {
              const decryptedIncorrectChoiceExplanations: number[][] =
                await encryptStrings2NumberArrays(
                  incorrectChoiceExplanations as string[],
                  cryptographyClient
                );
              incorrectChoicesExplanations.push(
                decryptedIncorrectChoiceExplanations
              );
            } else {
              incorrectChoicesExplanations.push(null);
            }
          }
        }

        return {
          ...upsertImportItem,
          id: `${testId}_${idx + 1}`,
          number: idx + 1,
          subjects,
          choices,
          explanations,
          incorrectChoicesExplanations,
          testId,
        };
      }
    );
    if (upsertImportItems.length > 0) {
      upsertQuestionItems = await Promise.all<Promise<Question>[]>(
        encryptPromises
      );
    }

    // 暗号化したUsersテータベースのQuestionコンテナーの各項目をupsert
    // 比較的要求ユニット(RU)数が多いDB操作を行うため、upsertの合間に3秒間sleepする
    // https://docs.microsoft.com/ja-jp/azure/cosmos-db/sql/troubleshoot-request-rate-too-large
    if (upsertQuestionItems.length > 0) {
      const sleep = (sleepPeriod: number): Promise<unknown> =>
        new Promise((resolve) => setTimeout(resolve, sleepPeriod));
      for (let i = 0; i < upsertQuestionItems.length; i++) {
        const item: Question = upsertQuestionItems[i];
        const res: ItemResponse<Question> = await getReadWriteContainer(
          COSMOS_DB_DATABASE_NAME,
          COSMOS_DB_CONTAINER_NAMES.question
        ).items.upsert<Question>(item);
        if (res.statusCode >= 400) {
          throw new Error(
            `Status Code ${res.statusCode}: ${JSON.stringify(item)}`
          );
        }

        await sleep(3000);
      }
    }

    context.res = {
      status: 200,
      body: "OK",
    };
  } catch (e) {
    context.log.error(e);
    context.res = {
      status: 500,
      body: "Internal Server Error",
    };
  }
};
