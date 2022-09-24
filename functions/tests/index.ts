import { Context } from "@azure/functions";
import { getReadOnlyContainer } from "../shared/cosmosDBWrapper";
import { Test } from "../types/cosmosDB";
import { GetTests } from "../types/response";

const COSMOS_DB_DATABASE_NAME = "Users";
const COSMOS_DB_CONTAINER_NAME = "Test";

export default async (context: Context): Promise<void> => {
  try {
    // Cosmos DBのUsersデータベースのTestコンテナーから全項目取得
    const response = await getReadOnlyContainer(
      COSMOS_DB_DATABASE_NAME,
      COSMOS_DB_CONTAINER_NAME
    )
      .items.readAll<Test>()
      .fetchAll();
    const items = response.resources;
    console.log({ items });

    // 各項目をcourseName単位でまとめるようにレスポンス整形
    const body = items.reduce((prev: GetTests, item: Test) => {
      const tmpItem = {
        id: item.id,
        test: item.testName,
        length: item.length,
      };

      if (item.courseName in prev) {
        prev[item.courseName].push(tmpItem);
      } else {
        prev[item.courseName] = [tmpItem];
      }
      return prev;
    }, {});

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
