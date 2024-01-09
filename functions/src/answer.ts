import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getReadOnlyContainer } from "./cosmosDBWrapper";
import { Question } from "../cosmosDB";
import { GetQuestionAnswer, IncorrectChoices } from "../functions";

const COSMOS_DB_DATABASE_NAME = "Users";
const COSMOS_DB_CONTAINER_NAME = "Question";

export default async function (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const { testId, questionNumber } = request.params;
    context.info({ testId, questionNumber });

    // questionNumberのバリデーションチェック
    if (isNaN(parseInt(questionNumber))) {
      return {
        status: 400,
        body: `Invalid questionNumber: ${questionNumber}`,
      };
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
    context.info({ resources: response.resources });

    if (response.resources.length === 0) {
      return {
        status: 404,
        body: "Not Found Question",
      };
    } else if (response.resources.length > 1) {
      throw new Error("Not Unique Question");
    }
    const result: QueryQuestionAnswer = response.resources[0];

    // 不正解の選択肢の説明文のレスポンス組立て
    const incorrectChoices: IncorrectChoices =
      result.incorrectChoicesExplanations
        ? result.incorrectChoicesExplanations.reduce(
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
        overall: result.explanations
          ? result.explanations.map((explanation: string, idx: number) => {
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
    context.info({ body });

    return {
      status: 200,
      body: JSON.stringify(body),
    };
  } catch (e) {
    context.error(e);
    return {
      status: 500,
      body: "Internal Server Error",
    };
  }
}
