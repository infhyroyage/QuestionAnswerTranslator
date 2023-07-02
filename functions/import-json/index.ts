import { Context } from "@azure/functions";
import { ImportItem } from "../../types/import";
import { getReadWriteContainer } from "../shared/cosmosDBWrapper";

const COSMOS_DB_DATABASE_NAME = "Users";
const COSMOS_DB_CONTAINER_NAME = "Question";
const VAULT_CRYPTOGRAPHY_KEY_NAME = "manual-import-data";

export default async (context: Context): Promise<void> => {
  try {
    const courseName = context.bindingData.courseName;
    const testName = context.bindingData.testName;
    context.log.info({ courseName, testName });

    // Blobトリガーで受け取ったjsonファイルのバイナリデータをImportItem[]型として読込み
    const jsonData: ImportItem[] = JSON.parse(
      context.bindings.jsonContentBinary.toString()
    );

    const container = getReadWriteContainer(
      COSMOS_DB_DATABASE_NAME,
      COSMOS_DB_CONTAINER_NAME
    );

    // TODO: UsersテータベースのTestコンテナーの項目を取得

    // TODO: 取得したUsersテータベースのTestコンテナーの項目が存在し差分がない場合以外はupsert

    // TODO: UsersテータベースのQuestionコンテナーの項目を全取得

    // TODO: 取得したUsersテータベースのQuestionコンテナーの各項目を復号化

    // TODO: 読み込んだjsonファイルの各ImportItemにて、取得したUsersテータベースの
    // Questionコンテナーに存在して差分がない場合以外はupsert

    context.res = { status: 200 };
  } catch (e) {
    context.log.error(e);
    context.res = {
      status: 500,
      body: "Internal Server Error",
    };
  }
};
