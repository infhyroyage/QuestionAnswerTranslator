import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import { Context } from "@azure/functions";
import { CryptographyClient } from "@azure/keyvault-keys";
import { getReadOnlyContainer } from "../shared/cosmosDBWrapper";
import {
  createCryptographyClient,
  decryptNumberArrays2Strings,
} from "../shared/vaultWrapper";
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
    type GetEncryptedQuestion = {
      subjects: number[][];
      choices: number[][];
    };
    const query: SqlQuerySpec = {
      query:
        "SELECT c.subjects, c.choices FROM c WHERE c.testId = @testId AND c.number = @number",
      parameters: [
        { name: "@testId", value: testId },
        { name: "@number", value: questionNumber },
      ],
    };
    const response: FeedResponse<GetQuestion | GetEncryptedQuestion> =
      await getReadOnlyContainer(
        COSMOS_DB_DATABASE_NAME,
        COSMOS_DB_CONTAINER_NAME
      )
        .items.query<GetEncryptedQuestion | GetQuestion>(query)
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

    // 非localhost環境のみ、暗号化された項目値を復号
    let body: GetQuestion;
    if (process.env["COSMOSDB_URI"] === "https://localcosmosdb:8081") {
      body = response.resources[0] as GetQuestion;
    } else {
      const cryptographyClient: CryptographyClient =
        await createCryptographyClient(VAULT_CRYPTOGRAPHY_KEY_NAME);

      // subjectsの復号
      const decryptedSubjects: string[] = await decryptNumberArrays2Strings(
        (response.resources[0] as GetEncryptedQuestion).subjects,
        cryptographyClient
      );
      // choicesの復号
      const decryptedChoices: string[] = await decryptNumberArrays2Strings(
        (response.resources[0] as GetEncryptedQuestion).choices,
        cryptographyClient
      );

      body = {
        subjects: decryptedSubjects,
        choices: decryptedChoices,
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
