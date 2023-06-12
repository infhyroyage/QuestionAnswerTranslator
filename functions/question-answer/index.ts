import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import { Context } from "@azure/functions";
import { CryptographyClient } from "@azure/keyvault-keys";
import { getReadOnlyContainer } from "../shared/cosmosDBWrapper";
import {
  createCryptographyClient,
  decryptNumberArrays2Strings,
} from "../shared/vaultWrapper";
import { Question } from "../../types/cosmosDB";
import { GetQuestionAnswer, IncorrectChoices } from "../../types/functions";

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
    type QueryQuestionAnswer = Pick<
      Question,
      | "correctIdxes"
      | "explanations"
      | "incorrectChoicesExplanations"
      | "indicateImgIdxes"
      | "escapeTranslatedIdxes"
      | "references"
    >;
    const query: SqlQuerySpec = {
      query:
        "SELECT c.correctIdxes, c.explanations, c.incorrectChoicesExplanations, c.indicateImgIdxes, c.escapeTranslatedIdxes, c.references FROM c WHERE c.testId = @testId AND c.number = @number",
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
    context.log.info({ response });

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

    let explanations: string[] | undefined;
    let incorrectChoicesExplanations: (string[] | null)[] | undefined;
    if (process.env["COSMOSDB_URI"] === "https://localhost:8081") {
      // localhost環境のため、そのままexplanations/incorrectChoiceExplanationsを取得
      explanations = result.explanations as string[] | undefined;
      incorrectChoicesExplanations = result.incorrectChoicesExplanations as
        | (string[] | null)[]
        | undefined;
    } else {
      // 非localhost環境のため、暗号化されたexplanations/incorrectChoiceExplanationsの各要素を復号して取得
      const cryptographyClient: CryptographyClient =
        await createCryptographyClient(VAULT_CRYPTOGRAPHY_KEY_NAME);
      if (result.explanations) {
        explanations = await decryptNumberArrays2Strings(
          result.explanations as number[][],
          cryptographyClient
        );
      } else {
        explanations = undefined;
      }
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
    const incorrectChoices: IncorrectChoices = incorrectChoicesExplanations
      ? incorrectChoicesExplanations.reduce(
          (
            prevIncorrectChoices: IncorrectChoices,
            incorrectChoiceExplanations: string[] | null,
            choiceIdx: number
          ) => {
            if (incorrectChoiceExplanations) {
              prevIncorrectChoices[`${choiceIdx}`] =
                incorrectChoiceExplanations.map(
                  (incorrectChoiceExplanation: string, idx: number) => {
                    return {
                      sentence: incorrectChoiceExplanation as string,
                      isIndicatedImg: false,
                      isEscapedTranslation:
                        !!result.escapeTranslatedIdxes &&
                        !!result.escapeTranslatedIdxes
                          .incorrectChoicesExplanations &&
                        !!result.escapeTranslatedIdxes
                          .incorrectChoicesExplanations[choiceIdx] &&
                        (
                          result.escapeTranslatedIdxes
                            .incorrectChoicesExplanations[choiceIdx] || []
                        ).includes(idx),
                    };
                  }
                );
            }
            return prevIncorrectChoices;
          },
          {}
        )
      : {};

    const body: GetQuestionAnswer = {
      correctIdxes: result.correctIdxes,
      explanations: {
        overall: explanations
          ? explanations.map((explanation: string, idx: number) => {
              return {
                sentence: explanation,
                isIndicatedImg:
                  !!result.indicateImgIdxes &&
                  !!result.indicateImgIdxes.explanations &&
                  result.indicateImgIdxes.explanations.includes(idx),
                isEscapedTranslation:
                  !!result.escapeTranslatedIdxes &&
                  !!result.escapeTranslatedIdxes.explanations &&
                  result.escapeTranslatedIdxes.explanations.includes(idx),
              };
            })
          : [],
        incorrectChoices,
      },
      references: result.references || [],
    };
    context.log.info({ body });

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
