import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import { Context } from "@azure/functions";
import { CryptographyClient } from "@azure/keyvault-keys";
import { getReadOnlyContainer } from "../shared/cosmosDBWrapper";
import {
  createCryptographyClient,
  decryptNumberArrays2Strings,
} from "../shared/vaultWrapper";
import { Question } from "../../types/cosmosDB";
import { GetQuestion } from "../../types/functions";

const COSMOS_DB_DATABASE_NAME = "Users";
const COSMOS_DB_CONTAINER_NAME = "Question";
const VAULT_CRYPTOGRAPHY_KEY_NAME = "manual-import-data";

export default async (context: Context): Promise<void> => {
  try {
    const { testId, questionNumber } = context.bindingData;
    context.log.info({ testId, questionNumber });

    // questionNumberのバリデーションチェック
    if (isNaN(parseInt(questionNumber))) {
      context.res = {
        status: 400,
        body: `Invalid questionNumber: ${questionNumber}`,
      };
      return;
    }

    // Cosmos DBのUsersデータベースのQuestionコンテナーから項目取得
    type QueryQuestion = Pick<
      Question,
      | "subjects"
      | "choices"
      | "correctIdxes"
      | "indicateImgIdxes"
      | "escapeTranslatedIdxes"
    >;
    const query: SqlQuerySpec = {
      query:
        "SELECT c.subjects, c.choices, c.correctIdxes, c.indicateImgIdxes, c.escapeTranslatedIdxes FROM c WHERE c.testId = @testId AND c.number = @number",
      parameters: [
        { name: "@testId", value: testId },
        { name: "@number", value: questionNumber },
      ],
    };
    const response: FeedResponse<QueryQuestion> = await getReadOnlyContainer(
      COSMOS_DB_DATABASE_NAME,
      COSMOS_DB_CONTAINER_NAME
    )
      .items.query<QueryQuestion>(query)
      .fetchAll();
    context.log.verbose({ response });

    if (response.resources.length === 0) {
      context.res = {
        status: 404,
        body: "Not Found Question",
      };
      return;
    } else if (response.resources.length > 1) {
      throw new Error("Not Unique Question");
    }

    const result: QueryQuestion = response.resources[0];

    let subjects: string[];
    let choices: string[];
    if (process.env["COSMOSDB_URI"] === "https://localhost:8081") {
      // localhost環境のため、そのままsubjects/choicesを取得
      subjects = result.subjects as string[];
      choices = result.choices as string[];
    } else {
      // 非localhost環境のため、暗号化されたsubjects/choicesを復号して取得
      const cryptographyClient: CryptographyClient =
        await createCryptographyClient(VAULT_CRYPTOGRAPHY_KEY_NAME);
      subjects = await decryptNumberArrays2Strings(
        result.subjects as number[][],
        cryptographyClient
      );
      choices = await decryptNumberArrays2Strings(
        result.choices as number[][],
        cryptographyClient
      );
    }

    const body: GetQuestion = {
      subjects: subjects.map((subject: string, idx: number) => {
        return {
          sentence: subject,
          isIndicatedImg:
            !!result.indicateImgIdxes &&
            !!result.indicateImgIdxes.subjects &&
            result.indicateImgIdxes.subjects.includes(idx),
          isEscapedTranslation:
            !!result.escapeTranslatedIdxes &&
            !!result.escapeTranslatedIdxes.subjects &&
            result.escapeTranslatedIdxes.subjects.includes(idx),
        };
      }),
      choices: choices.map((choice: string, idx: number) => {
        return {
          sentence: choice,
          isIndicatedImg: false,
          isEscapedTranslation:
            !!result.escapeTranslatedIdxes &&
            !!result.escapeTranslatedIdxes.choices &&
            result.escapeTranslatedIdxes.choices.includes(idx),
        };
      }),
      isCorrectedMulti: result.correctIdxes.length > 1,
    };
    context.log.verbose({ body });

    context.res = {
      status: 200,
      body: JSON.stringify(body),
    };
  } catch (e) {
    context.log.error(e);
    context.res = {
      status: 500,
      body: "Internal Server Error",
    };
  }
};
