import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import { Context } from "@azure/functions";
import { CryptographyClient } from "@azure/keyvault-keys";
import { getReadOnlyContainer } from "../shared/cosmosDBWrapper";
import {
  createCryptographyClient,
  decryptNumberArrays2Strings,
} from "../shared/vaultWrapper";
import { EscapeTranslatedIdxes, Question } from "../types/cosmosDB";
import { GetQuestion } from "../types/response";

const COSMOS_DB_DATABASE_NAME = "Users";
const COSMOS_DB_CONTAINER_NAME = "Question";
const VAULT_CRYPTOGRAPHY_KEY_NAME = "manual-import-data";

export default async (context: Context): Promise<void> => {
  try {
    const { testId, questionNumber } = context.bindingData;
    console.log({ testId, questionNumber });

    // questionNumberのバリデーションチェック
    if (isNaN(parseInt(questionNumber))) {
      context.res = {
        status: 400,
        body: `Invalid questionNumber: ${questionNumber}`,
      };
      return;
    }

    // Cosmos DBのUsersデータベースのQuestionコンテナーから項目取得
    // QueryQuestion : localhost環境(平文のまま)
    // QueryEncryptedQuestion : 非localhost環境(暗号化済)
    type QueryQuestion = {
      subjects: string[];
      choices: string[];
      correctIdxes: number[];
      escapeTranslatedIdxes?: EscapeTranslatedIdxes;
    };
    type QueryEncryptedQuestion = Pick<
      Question,
      "subjects" | "choices" | "correctIdxes" | "escapeTranslatedIdxes"
    >;
    const query: SqlQuerySpec = {
      query:
        "SELECT c.subjects, c.choices, c.correctIdxes, c.escapeTranslatedIdxes FROM c WHERE c.testId = @testId AND c.number = @number",
      parameters: [
        { name: "@testId", value: testId },
        { name: "@number", value: questionNumber },
      ],
    };
    const response: FeedResponse<QueryQuestion | QueryEncryptedQuestion> =
      await getReadOnlyContainer(
        COSMOS_DB_DATABASE_NAME,
        COSMOS_DB_CONTAINER_NAME
      )
        .items.query<QueryQuestion | QueryEncryptedQuestion>(query)
        .fetchAll();
    console.dir(response, { depth: null });
    if (response.resources.length === 0) {
      context.res = {
        status: 404,
        body: "Not Found Question",
      };
      return;
    } else if (response.resources.length > 1) {
      throw new Error("Not Unique Question");
    }

    let body: GetQuestion;
    if (process.env["COSMOSDB_URI"] === "https://localcosmosdb:8081") {
      // localhost環境
      const result: QueryQuestion = response.resources[0] as QueryQuestion;

      body = {
        subjects: result.subjects.map((subject: string, idx: number) => {
          return {
            sentence: subject,
            isEscapedTranslation:
              result.escapeTranslatedIdxes &&
              result.escapeTranslatedIdxes.subjects &&
              result.escapeTranslatedIdxes.subjects.includes(idx),
          };
        }),
        choices: result.choices.map((choice: string, idx: number) => {
          return {
            sentence: choice,
            isEscapedTranslation:
              result.escapeTranslatedIdxes &&
              result.escapeTranslatedIdxes.choices &&
              result.escapeTranslatedIdxes.choices.includes(idx),
          };
        }),
        isCorrectedMulti: result.correctIdxes.length > 1,
      };
    } else {
      // 非localhost環境のため、暗号化されたsubjects/choicesを復号
      const encryptedResult: QueryEncryptedQuestion = response
        .resources[0] as QueryEncryptedQuestion;
      const cryptographyClient: CryptographyClient =
        await createCryptographyClient(VAULT_CRYPTOGRAPHY_KEY_NAME);
      const decryptedSubjects: string[] = await decryptNumberArrays2Strings(
        encryptedResult.subjects,
        cryptographyClient
      );
      const decryptedChoices: string[] = await decryptNumberArrays2Strings(
        encryptedResult.choices,
        cryptographyClient
      );

      body = {
        subjects: decryptedSubjects.map((subject: string, idx: number) => {
          return {
            sentence: subject,
            isEscapedTranslation:
              encryptedResult.escapeTranslatedIdxes &&
              encryptedResult.escapeTranslatedIdxes.subjects &&
              encryptedResult.escapeTranslatedIdxes.subjects.includes(idx),
          };
        }),
        choices: decryptedChoices.map((choice: string, idx: number) => {
          return {
            sentence: choice,
            isEscapedTranslation:
              encryptedResult.escapeTranslatedIdxes &&
              encryptedResult.escapeTranslatedIdxes.choices &&
              encryptedResult.escapeTranslatedIdxes.choices.includes(idx),
          };
        }),
        isCorrectedMulti: encryptedResult.correctIdxes.length > 1,
      };
    }

    context.res = {
      status: 200,
      body: JSON.stringify(body),
    };
  } catch (e) {
    console.error(e);

    context.res = {
      status: 500,
      body: JSON.stringify(e),
    };
  }
};
