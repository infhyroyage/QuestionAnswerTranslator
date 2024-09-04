import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { Test } from "../cosmosDB";
import { GetTests } from "../functions";
import { getReadOnlyContainer } from "./cosmosDBWrapper";

const COSMOS_DB_DATABASE_NAME = "Users";
const COSMOS_DB_CONTAINER_NAME = "Test";

export default async function (
  _: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    // Cosmos DBのUsersデータベースのTestコンテナーから全項目取得
    const query: SqlQuerySpec = {
      query: `SELECT c.id, c.courseName, c.testName, c.length FROM c ORDER BY c.courseName ASC, c.testName ASC`,
    };
    const response: FeedResponse<Test> = await getReadOnlyContainer(
      COSMOS_DB_DATABASE_NAME,
      COSMOS_DB_CONTAINER_NAME
    )
      .items.query<Test>(query)
      .fetchAll();
    const items: Test[] = response.resources;
    context.info({ items });

    // 各項目をcourseName単位でまとめるようにレスポンス整形
    const body: GetTests = items.reduce((prev: GetTests, item: Test) => {
      const tmpItem = {
        id: item.id,
        testName: item.testName,
      };

      if (item.courseName in prev) {
        prev[item.courseName].push(tmpItem);
      } else {
        prev[item.courseName] = [tmpItem];
      }
      return prev;
    }, {});
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
