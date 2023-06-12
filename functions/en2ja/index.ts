import { FeedResponse, ItemResponse, SqlQuerySpec } from "@azure/cosmos";
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
    context.log.info({ texts });

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
    const fetchAllResponse: FeedResponse<Flag> = await container.items
      .query<Flag>(query)
      .fetchAll();
    context.log.verbose({ fetchAllResponse });

    // 当月中にAzure Translatorの無料枠を使い切ったことがある場合、Azure Translatorにリクエストする必要がないため
    // 最初からDeepLにリクエストを送るように制御する
    if (fetchAllResponse.resources.length > 0) {
      const now: Date = new Date();
      if (
        fetchAllResponse.resources[0].year === now.getFullYear() &&
        fetchAllResponse.resources[0].month === now.getMonth() + 1
      ) {
        isUsedUpTransLator = true;
      } else {
        const deleteResponse: ItemResponse<Flag> = await container
          .item(COSMOS_DB_ITEMS_ID)
          .delete<Flag>();
        context.log.verbose({ deleteResponse });
      }
    }

    let body: PutEn2JaRes | undefined = undefined;
    if (isUsedUpTransLator) {
      body = await translateByDeepL(texts);
    } else {
      body = await translateByAzureTranslator(texts);
      if (!body) {
        // Azure Translatorの無料枠を使い切ったため、Warningログを出力してフラグを設定
        context.log.warn("Azure Translator Free Tier is used up.");
        const now: Date = new Date();
        const upsertResponse: ItemResponse<Flag> =
          await container.items.upsert<Flag>({
            id: COSMOS_DB_ITEMS_ID,
            year: now.getFullYear(),
            month: now.getMonth() + 1,
          });
        context.log.verbose({ upsertResponse });

        body = await translateByDeepL(texts);
      }
    }
    context.log.verbose({ body });
    if (!body) throw new Error("Translated texts are empty.");

    context.res = { status: 200, body };
  } catch (e) {
    context.log.error(e);
    context.res = {
      status: 500,
      body: "Internal Server Error",
    };
  }
};
