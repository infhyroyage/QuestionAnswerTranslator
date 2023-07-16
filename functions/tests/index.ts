import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import { Context } from "@azure/functions";
import { getReadOnlyContainer } from "../shared/cosmosDBWrapper";
import { Test } from "../../types/cosmosDB";
import { GetTests } from "../../types/functions";

const COSMOS_DB_DATABASE_NAME = "Users";
const COSMOS_DB_CONTAINER_NAME = "Test";

export default async (context: Context): Promise<void> => {
  try {
    // Cosmos DBのUsersデータベースのTestコンテナーから全項目取得
    const query: SqlQuerySpec = {
      query: `SELECT c.id, c.courseName, c.testName, c.length FROM c${
        // Azure上では複合インデックスを作成するインデックスポリシーを定義しているが、
        // 2023/07/16現在、Azure SDK for JavaScriptでは未サポートでありlocalhost環境上では定義していないため、
        // Azure上のみORDER BY句を設定する
        // https://github.com/Azure/azure-sdk-for-js/issues/21115
        process.env["COSMOSDB_URI"] === "https://localhost:8081"
          ? ""
          : " ORDER BY c.courseName ASC, c.testName ASC"
      }`,
    };
    const response: FeedResponse<Test> = await getReadOnlyContainer(
      COSMOS_DB_DATABASE_NAME,
      COSMOS_DB_CONTAINER_NAME
    )
      .items.query<Test>(query)
      .fetchAll();
    const items: Test[] = response.resources;
    context.log.info({ items });

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
