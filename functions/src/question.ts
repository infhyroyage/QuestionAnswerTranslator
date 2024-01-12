import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getReadOnlyContainer } from "./cosmosDBWrapper";
import { GetQuestion } from "../functions";
import { Question } from "../cosmosDB";

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
        { name: "@number", value: parseInt(questionNumber) },
      ],
    };
    const response: FeedResponse<QueryQuestion> = await getReadOnlyContainer(
      COSMOS_DB_DATABASE_NAME,
      COSMOS_DB_CONTAINER_NAME
    )
      .items.query<QueryQuestion>(query)
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
    const result: QueryQuestion = response.resources[0];

    const body: GetQuestion = {
      subjects: result.subjects.map((subject: string, idx: number) => {
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
      choices: result.choices.map((choice: string, idx: number) => {
        return {
          sentence: choice,
          isIndicatedImg: false,
          isEscapedTranslation:
            !!result.escapeTranslatedIdxes &&
            !!result.escapeTranslatedIdxes.choices &&
            result.escapeTranslatedIdxes.choices.includes(idx),
        };
      }),
      isMultiplied: result.correctIdxes.length > 1,
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
