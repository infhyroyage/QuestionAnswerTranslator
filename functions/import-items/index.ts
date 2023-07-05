import { Context } from "@azure/functions";
import { ImportItem } from "../../types/import";
import {
  getReadOnlyContainer,
  getReadWriteContainer,
} from "../shared/cosmosDBWrapper";
import { FeedResponse, ItemResponse, SqlQuerySpec } from "@azure/cosmos";
import { v4 as uuidv4 } from "uuid";
import { Question, Test } from "../cosmosDB";

const COSMOS_DB_DATABASE_NAME = "Users";
const COSMOS_DB_CONTAINER_NAMES = { test: "Test", question: "Question" };
// const VAULT_CRYPTOGRAPHY_KEY_NAME = "manual-import-data";

export default async (context: Context): Promise<void> => {
  try {
    const courseName: string = context.bindingData.courseName;
    const testName: string = context.bindingData.testName;
    context.log.info({ courseName, testName });

    // Blobトリガーで受け取ったjsonファイルのバイナリデータをImportItem[]型として読込み
    const jsonData: ImportItem[] = JSON.parse(
      context.bindings.jsonContentBinary.toString()
    );

    // UsersテータベースのTestコンテナーの項目を取得
    const testQuery: SqlQuerySpec = {
      query:
        "SELECT * FROM c WHERE c.courseName = @courseName and c.testName = @testName",
      parameters: [
        { name: "@courseName", value: courseName },
        { name: "@testName", value: testName },
      ],
    };
    const insertedTestItemsRes: FeedResponse<Test> = await getReadOnlyContainer(
      COSMOS_DB_DATABASE_NAME,
      COSMOS_DB_CONTAINER_NAMES.test
    )
      .items.query<Test>(testQuery)
      .fetchAll();
    const insertedTestItems: Test[] = insertedTestItemsRes.resources;
    context.log.info({ insertedTestItems });
    if (insertedTestItems.length > 1) {
      throw new Error("Not Unique Test");
    }

    // 取得したUsersテータベースのTestコンテナーの項目が存在し差分がない場合以外はupsert
    let testId: string;
    if (
      insertedTestItems.length === 0 ||
      (insertedTestItems.length === 1 &&
        insertedTestItems[0].length !== jsonData.length)
    ) {
      testId =
        insertedTestItems.length === 0 ? uuidv4() : insertedTestItems[0].id;
      const upsertTestItem: Test = {
        courseName,
        testName,
        id: testId,
        length: jsonData.length,
      };
      context.log.info({ upsertTestItem });
      const res: ItemResponse<Test> = await getReadWriteContainer(
        COSMOS_DB_DATABASE_NAME,
        COSMOS_DB_CONTAINER_NAMES.test
      ).items.upsert<Test>(upsertTestItem);
      if (res.statusCode >= 400) {
        throw new Error(
          `Status Code ${res.statusCode}: ${JSON.stringify(upsertTestItem)}`
        );
      }
    } else {
      testId = insertedTestItems[0].id;
    }

    // UsersテータベースのQuestionコンテナーの項目を全取得
    let insertedQuestionItems: Question[] = [];
    if (insertedTestItems.length > 0) {
      // UsersテータベースのTestコンテナーの項目が取得できた場合のみクエリを実行
      const questionQuery: SqlQuerySpec = {
        query: "SELECT * FROM c WHERE c.testId = @testId",
        parameters: [{ name: "@testId", value: testId }],
      };
      const insertedQuestionItemsRes: FeedResponse<Question> =
        await getReadOnlyContainer(
          COSMOS_DB_DATABASE_NAME,
          COSMOS_DB_CONTAINER_NAMES.question
        )
          .items.query<Question>(questionQuery)
          .fetchAll();
      insertedQuestionItems = insertedQuestionItemsRes.resources;
    }
    context.log.info({ insertedQuestionItems });

    // TODO: 取得したUsersテータベースのQuestionコンテナーの各項目を復号化

    // TODO: 読み込んだjsonファイルの各ImportItemにて、取得したUsersテータベースの
    // Questionコンテナーに存在して差分がない場合以外はupsert

    context.res = {
      status: 200,
      body: "OK",
    };
  } catch (e) {
    context.log.error(e);
    context.res = {
      status: 500,
      body: "Internal Server Error",
    };
  }
};
