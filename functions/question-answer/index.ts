import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import { Context } from "@azure/functions";
import { CryptographyClient } from "@azure/keyvault-keys";
import { getReadOnlyContainer } from "../shared/cosmosDBWrapper";
import {
  createCryptographyClient,
  decryptNumberArrays2Strings,
} from "../shared/vaultWrapper";
import {
  Explanation,
  IncorrectChoiceExplanation,
  IncorrectChoiceExplanations,
  Question,
} from "../types/cosmosDB";
import { GetQuestionAnswer, IncorrectChoices } from "../types/response";

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
    type QueryQuestionAnswer = Pick<
      Question,
      | "correctIdxes"
      | "explanations"
      | "incorrectChoicesExplanations"
      | "escapeTranslatedIdxes"
      | "references"
    >;
    const query: SqlQuerySpec = {
      query:
        "SELECT c.correctIdxes, c.explanations, c.incorrectChoicesExplanations, c.escapeTranslatedIdxes, c.references FROM c WHERE c.testId = @testId AND c.number = @number",
      parameters: [
        { name: "@testId", value: testId },
        { name: "@number", value: questionNumber },
      ],
    };
    const response: FeedResponse<QueryQuestionAnswer> =
      await getReadOnlyContainer(
        COSMOS_DB_DATABASE_NAME,
        COSMOS_DB_CONTAINER_NAME
      )
        .items.query<QueryQuestionAnswer>(query)
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
    const result: QueryQuestionAnswer = response.resources[0];

    let explanations: Explanation[];
    let incorrectChoicesExplanations: IncorrectChoiceExplanations[] | undefined;
    if (process.env["COSMOSDB_URI"] === "https://localcosmosdb:8081") {
      // localhost環境のため、そのままexplanations/incorrectChoiceExplanationsを取得
      explanations = result.explanations;
      incorrectChoicesExplanations = result.incorrectChoicesExplanations;
    } else {
      // 非localhost環境のため、暗号化されたexplanations/incorrectChoiceExplanationsの各要素を復号して取得
      const cryptographyClient: CryptographyClient =
        await createCryptographyClient(VAULT_CRYPTOGRAPHY_KEY_NAME);
      explanations = await decryptNumberArrays2Strings(
        result.explanations as number[][],
        cryptographyClient
      );
      if (result.incorrectChoicesExplanations) {
        incorrectChoicesExplanations = [];
        for (const incorrectChoiceExplanations of result.incorrectChoicesExplanations) {
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
      } else {
        incorrectChoicesExplanations = undefined;
      }
    }

    // 不正解の選択肢の説明文のレスポンス組立て
    const incorrectChoices: IncorrectChoices =
      incorrectChoicesExplanations.reduce(
        (
          prevIncorrectChoices: IncorrectChoices,
          incorrectChoiceExplanations: IncorrectChoiceExplanations,
          choiceIdx: number
        ) => {
          if (incorrectChoiceExplanations) {
            prevIncorrectChoices[choiceIdx] = incorrectChoiceExplanations.map(
              (
                IncorrectChoiceExplanation: IncorrectChoiceExplanation,
                idx: number
              ) => {
                return {
                  sentence: IncorrectChoiceExplanation as string,
                  isIndicatedImg: false,
                  isEscapedTranslation:
                    result.escapeTranslatedIdxes &&
                    result.escapeTranslatedIdxes.incorrectChoicesExplanations &&
                    result.escapeTranslatedIdxes.incorrectChoicesExplanations[
                      choiceIdx
                    ].includes(idx),
                };
              }
            );
          }
          return prevIncorrectChoices;
        },
        {}
      );

    const body: GetQuestionAnswer = {
      correctIdxes: result.correctIdxes,
      explanations: {
        overall: explanations.map((explanation: string, idx: number) => {
          return {
            sentence: explanation,
            isIndicatedImg: false,
            isEscapedTranslation:
              result.escapeTranslatedIdxes &&
              result.escapeTranslatedIdxes.explanations &&
              result.escapeTranslatedIdxes.explanations.includes(idx),
          };
        }),
        incorrectChoices,
      },
      references: result.references || [],
    };
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
