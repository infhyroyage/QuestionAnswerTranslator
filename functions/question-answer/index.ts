import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import { Context } from "@azure/functions";
import { CryptographyClient } from "@azure/keyvault-keys";
import { getReadOnlyContainer } from "../shared/cosmosDBWrapper";
import {
  createCryptographyClient,
  decryptNumberArrays2Strings,
} from "../shared/vaultWrapper";
import { EscapeTranslatedIdxes, Question } from "../types/cosmosDB";
import { GetQuestionAnswer } from "../types/response";

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
    // QueryQuestionAnswer : localhost環境(平文のまま)
    // QueryEncryptedQuestionAnswer : 非localhost環境(暗号化済)
    type QueryQuestionAnswer = {
      correctIdx: number;
      explanations: string[];
      escapeTranslatedIdxes?: EscapeTranslatedIdxes;
      references?: string[];
    };
    type QueryEncryptedQuestionAnswer = Pick<
      Question,
      "correctIdx" | "explanations" | "escapeTranslatedIdxes" | "references"
    >;
    const query: SqlQuerySpec = {
      query:
        "SELECT c.correctIdx, c.explanations, c.escapeTranslatedIdxes, c.references FROM c WHERE c.testId = @testId AND c.number = @number",
      parameters: [
        { name: "@testId", value: testId },
        { name: "@number", value: questionNumber },
      ],
    };
    const response: FeedResponse<
      QueryQuestionAnswer | QueryEncryptedQuestionAnswer
    > = await getReadOnlyContainer(
      COSMOS_DB_DATABASE_NAME,
      COSMOS_DB_CONTAINER_NAME
    )
      .items.query<QueryQuestionAnswer | QueryEncryptedQuestionAnswer>(query)
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

    let body: GetQuestionAnswer;
    if (process.env["COSMOSDB_URI"] === "https://localcosmosdb:8081") {
      // localhost環境
      const result = response.resources[0] as QueryQuestionAnswer;

      body = {
        correctIdx: result.correctIdx,
        explanations: result.explanations.map(
          (explanation: string, idx: number) => {
            return {
              sentence: explanation,
              isEscapedTranslation:
                result.escapeTranslatedIdxes &&
                result.escapeTranslatedIdxes.explanations &&
                result.escapeTranslatedIdxes.explanations.includes(idx),
            };
          }
        ),
        references: result.references || [],
      };
    } else {
      // 非localhost環境のため、暗号化されたexplanationsを復号
      const encryptedResult: QueryEncryptedQuestionAnswer = response
        .resources[0] as QueryEncryptedQuestionAnswer;
      const cryptographyClient: CryptographyClient =
        await createCryptographyClient(VAULT_CRYPTOGRAPHY_KEY_NAME);
      const decryptExplanations: string[] = await decryptNumberArrays2Strings(
        encryptedResult.explanations,
        cryptographyClient
      );

      body = {
        correctIdx: encryptedResult.correctIdx,
        explanations: decryptExplanations.map(
          (explanation: string, idx: number) => {
            return {
              sentence: explanation,
              isEscapedTranslation:
                encryptedResult.escapeTranslatedIdxes &&
                encryptedResult.escapeTranslatedIdxes.explanations &&
                encryptedResult.escapeTranslatedIdxes.explanations.includes(
                  idx
                ),
            };
          }
        ),
        references: encryptedResult.references || [],
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
