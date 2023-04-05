import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import { Context } from "@azure/functions";
import { getReadOnlyContainer } from "../shared/cosmosDBWrapper";
import { GetTest } from "../../types/functions";

const COSMOS_DB_DATABASE_NAME = "Users";
const COSMOS_DB_CONTAINER_NAME = "Test";

export default async (context: Context): Promise<void> => {
  try {
    const { testId } = context.bindingData;
    console.log({ testId });

    // Cosmos DBのUsersデータベースのTestコンテナーから項目取得
    const query: SqlQuerySpec = {
      query: "SELECT c.testName, c.length FROM c WHERE c.id = @testId",
      parameters: [{ name: "@testId", value: testId }],
    };

    const response: FeedResponse<GetTest> = await getReadOnlyContainer(
      COSMOS_DB_DATABASE_NAME,
      COSMOS_DB_CONTAINER_NAME
    )
      .items.query<GetTest>(query)
      .fetchAll();
    console.dir(response, { depth: null });
    if (response.resources.length === 0) {
      context.res = {
        status: 404,
        body: "Not Found Test",
      };
      return;
    } else if (response.resources.length > 1) {
      throw new Error("Not Unique Test");
    }
    const item: GetTest = response.resources[0];

    context.res = {
      status: 200,
      body: JSON.stringify(item),
    };
  } catch (e) {
    console.error(e);

    context.res = {
      status: 500,
      body: JSON.stringify(e),
    };
  }
};
