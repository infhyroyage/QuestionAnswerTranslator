import { FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import { Context } from "@azure/functions";
import { PutEn2JaReq, PutEn2JaRes } from "../../types/functions";
import { Flag } from "../cosmosDB";
import {
  translateByAzureTranslator,
  translateByDeepL,
} from "../shared/axiosWrapper";
import { getReadWriteContainer } from "../shared/cosmosDBWrapper";

const COSMOS_DB_DATABASE_NAME = "Systems";
const COSMOS_DB_CONTAINER_NAME = "Flag";
const COSMOS_DB_ITEMS_ID = "isUsedUpTransLator";

export default async (context: Context): Promise<void> => {
  try {
    const texts: PutEn2JaReq = context.req?.body;

    // Cosmos DBのSystemsデータベースのFlagsコンテナーから、
    // Azure Translatorの無料枠を使い切ったかのフラグを取得
    let isUsedUpTransLator: boolean = false;
    const query: SqlQuerySpec = {
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: COSMOS_DB_ITEMS_ID }],
    };
    const container = getReadWriteContainer(
      COSMOS_DB_DATABASE_NAME,
      COSMOS_DB_CONTAINER_NAME
    );
    const response: FeedResponse<Flag> = await container.items
      .query<Flag>(query)
      .fetchAll();
    console.dir(response, { depth: null });
    if (response.resources.length > 0) {
      isUsedUpTransLator = true;
    }

    let body: PutEn2JaRes | undefined = undefined;
    if (isUsedUpTransLator) {
      body = await translateByDeepL(texts);
    } else {
      body = await translateByAzureTranslator(texts);
      if (!body) {
        // Azure Translatorの無料枠を使い切ったためフラグを設定
        await container.items.upsert<Flag>({ id: COSMOS_DB_ITEMS_ID });

        body = await translateByDeepL(texts);
      }
    }
    if (!body) throw new Error("Translated texts are empty.");

    context.res = { status: 200, body };
  } catch (e) {
    console.error(e);

    context.res = {
      status: 500,
      body: JSON.stringify(e),
    };
  }
};
