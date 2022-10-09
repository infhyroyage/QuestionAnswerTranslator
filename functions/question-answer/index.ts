import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import { Context } from "@azure/functions";
import { CryptographyClient } from "@azure/keyvault-keys";
import { getReadOnlyContainer } from "../shared/cosmosDBWrapper";
import {
  createCryptographyClient,
  decryptNumberArrays2Strings,
} from "../shared/vaultWrapper";
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
    type GetEncryptedQuestionAnswer = {
      correctIdx: number;
      explanations: number[][];
    };
    const query: SqlQuerySpec = {
      query:
        "SELECT c.correctIdx, c.explanations FROM c WHERE c.testId = @testId AND c.number = @number",
      parameters: [
        { name: "@testId", value: testId },
        { name: "@number", value: questionNumber },
      ],
    };
    const response: FeedResponse<
      GetEncryptedQuestionAnswer | GetQuestionAnswer
    > = await getReadOnlyContainer(
      COSMOS_DB_DATABASE_NAME,
      COSMOS_DB_CONTAINER_NAME
    )
      .items.query<GetEncryptedQuestionAnswer | GetQuestionAnswer>(query)
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

    let result: GetQuestionAnswer;
    if (process.env["COSMOSDB_URI"] === "https://localcosmosdb:8081") {
      result = response.resources[0] as GetQuestionAnswer;
    } else {
      const cryptographyClient: CryptographyClient =
        await createCryptographyClient(VAULT_CRYPTOGRAPHY_KEY_NAME);

      // explanationsの復号
      const decryptExplanations: string[] = await decryptNumberArrays2Strings(
        (response.resources[0] as GetEncryptedQuestionAnswer).explanations,
        cryptographyClient
      );

      result = {
        correctIdx: (response.resources[0] as GetEncryptedQuestionAnswer)
          .correctIdx,
        explanations: decryptExplanations,
      };
    }

    context.res = {
      status: 200,
      body: JSON.stringify(result),
    };
  } catch (e) {
    console.error(e);

    context.res = {
      status: 500,
      body: JSON.stringify(e),
    };
  }
};
