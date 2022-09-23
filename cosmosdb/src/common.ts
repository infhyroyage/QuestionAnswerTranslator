import {
  CosmosClient,
  FeedResponse,
  ItemResponse,
  OperationResponse,
  SqlQuerySpec,
  UpsertOperationInput,
} from "@azure/cosmos";
import { AzureCliCredential, DefaultAzureCredential } from "@azure/identity";
import {
  CryptographyClient,
  EncryptResult,
  KeyClient,
} from "@azure/keyvault-keys";
import { SecretClient } from "@azure/keyvault-secrets";
import { Item, Data, DatabaseData, TestName2TestId } from "../types/common";

const COSMOSDB_LOCAL_KEY =
  "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";
const COSMOSDB_LOCAL_URI = "https://localhost:9230";
const COSMOSDB_URI =
  "https://qatranslator-kc-cosmosdb.documents.azure.com:443/";
const VAULT_URL = "https://qatranslator-je-vault.vault.azure.net";
const VAULT_CRYPTOGRAPHY_KEY_NAME = "manual-import-data";

/**
 * Cosmos DBのクライアントを生成する
 * @param {boolean?} isReadOnly 読み取り専用のCosmos DBのクライアントを生成する場合はtrue、それ以外の場合はfalse
 * @returns {Promise<CosmosClient>} Cosmos DBのクライアント
 */
export const generateCosmosClient = async (
  isReadOnly: boolean = true
): Promise<CosmosClient> => {
  if (process.env["NODE_TLS_REJECT_UNAUTHORIZED"] === "0") {
    return new CosmosClient({
      endpoint: COSMOSDB_LOCAL_URI,
      key: COSMOSDB_LOCAL_KEY,
    });
  } else {
    // 非localhost環境の場合は、az loginでログイン中のサービスプリンシパルで
    // Key Vaultにログインし、Cosmos DBのプライマリーマスターキーを取得する
    const keyName = isReadOnly
      ? "cosmos-db-primary-readonly-key"
      : "cosmos-db-primary-key";
    const secretClient = new SecretClient(VAULT_URL, new AzureCliCredential());
    const cosmosDBKey = (await secretClient.getSecret(keyName)).value;
    if (!cosmosDBKey) {
      throw new Error(`Key vault secret "${keyName}" is not found.`);
    }
    return new CosmosClient({
      endpoint: COSMOSDB_URI,
      key: cosmosDBKey,
    });
  }
};

/**
 * 各データベースの各コンテナーにUpsertする項目を含むデータに示されるデータベース・コンテナーをすべて作成する
 * @param {Data} data データ
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 */
export const createDatabasesAndContainers = async (
  data: Data,
  cosmosClient: CosmosClient
): Promise<void> => {
  const createPromises = Object.keys(data).map(async (databaseName: string) => {
    const { database } = await cosmosClient.databases.createIfNotExists({
      id: databaseName,
    });

    const createContainersPromises = Object.keys(data[databaseName]).map(
      async (containerName: string) => {
        await database.containers.createIfNotExists({
          id: containerName,
          partitionKey: "/id",
        });
      }
    );
    await Promise.all(createContainersPromises);
  });
  await Promise.all(createPromises);
};

/**
 * 手動インポートデータのtestNameからtestIdへ変換するための変換器を取得する
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 * @returns {Promise<TestName2TestId>} 変換器のPromise
 */
export const getTestName2TestId = async (
  cosmosClient: CosmosClient
): Promise<TestName2TestId> => {
  // UsersテータベースのTestコンテナーの全id、testNameをquery
  const query: SqlQuerySpec = {
    query: "SELECT c.id, c.testName FROM c",
  };
  type QueryResult = { id: string; testName: string };
  const res: FeedResponse<QueryResult> = await cosmosClient
    .database("Users")
    .container("Test")
    .items.query<QueryResult>(query)
    .fetchAll();

  const testName2TestId: TestName2TestId = {};
  res.resources.map(
    (resource: QueryResult) =>
      (testName2TestId[resource.testName] = resource.id)
  );
  return testName2TestId;
};

/**
 * 比較的要求ユニット(RU)数が少量のデータで構成される、各データベースの各コンテナーに対する全項目を並列でBulkUpsertする
 * @param {Data} data データ
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 * @returns {Promise<OperationResponse[]>[]} 各データベースの各コンテナーに対する全項目をBulkUpsertした全レスポンス
 */
export const bulkUpsertAllItems = (
  data: Data,
  cosmosClient: CosmosClient
): Promise<OperationResponse[]>[] => {
  const bulkUpsertPromise: Promise<OperationResponse[]>[] = Object.keys(data)
    .map((databaseName: string): Promise<OperationResponse[]>[] => {
      const database = cosmosClient.database(databaseName);

      return Object.keys(data[databaseName]).map(
        async (containerName: string): Promise<OperationResponse[]> => {
          const container = database.container(containerName);
          const items = data[databaseName][containerName];

          const operations: UpsertOperationInput[] = items.map(
            (item: Item): UpsertOperationInput => {
              return {
                operationType: "Upsert",
                partitionKey: item.id,
                resourceBody: item,
              };
            }
          );

          const bulkResponse: OperationResponse[] = await container.items.bulk(
            operations
          );
          const firstErrorResponse: OperationResponse | undefined =
            bulkResponse.find(
              (res: OperationResponse) => res.statusCode >= 400
            );
          if (firstErrorResponse) {
            console.error(
              `Database ${databaseName}, Container ${containerName}: Exist NG Response`
            );
          } else {
            console.log(
              `Database ${databaseName}, Container ${containerName}: All Response OK`
            );
          }

          return bulkResponse;
        }
      );
    })
    .flat();

  if (bulkUpsertPromise.length === 0) {
    throw new Error("There is no upsert item");
  }

  return bulkUpsertPromise;
};

/**
 * 比較的要求ユニット(RU)数が大きめデータで構成される、各データベースの各コンテナーに対する全項目を
 * 合間にsleepを挟みながら直列でUpsertする
 * generateBulkUpsertPromises関数の実行時に429エラー(Cosmos DBの要求率が大きすぎる)場合に代用すること
 * @link https://docs.microsoft.com/ja-jp/azure/cosmos-db/sql/troubleshoot-request-rate-too-large
 * @param {Data} data データ
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 * @param {number} sleepPeriod sleepする時間(ms単位)
 * @returns {Promise<ItemResponse<Item>[]>} 各データベースの各コンテナーに対する全項目をUpsertした全レスポンス
 */
export const upsertAndSleepAllItems = async (
  data: Data,
  cosmosClient: CosmosClient,
  sleepPeriod: number
): Promise<ItemResponse<Item>[]> => {
  const sleep = (sleepPeriod: number): Promise<unknown> =>
    new Promise((resolve) => setTimeout(resolve, sleepPeriod));

  const responses: ItemResponse<Item>[] = [];
  for (const databaseName in data) {
    const database = cosmosClient.database(databaseName);

    for (const containerName in data[databaseName]) {
      const container = database.container(containerName);

      console.log(
        `Database ${databaseName}, Container ${containerName}: Start ${data[databaseName][containerName].length} Items`
      );

      for (
        let itemIdx = 0;
        itemIdx < data[databaseName][containerName].length;
        itemIdx++
      ) {
        const item: Item = data[databaseName][containerName][itemIdx];
        const upsertResponse: ItemResponse<Item> =
          await container.items.upsert<Item>(item);
        responses.push(upsertResponse);
        if (upsertResponse.statusCode >= 400) {
          console.error(
            `Database ${databaseName}, Container ${containerName}: ${
              itemIdx + 1
            }th Response NG`
          );
        } else {
          console.log(
            `Database ${databaseName}, Container ${containerName}: ${
              itemIdx + 1
            }th Response OK`
          );
        }

        await sleep(sleepPeriod);
      }
    }
  }

  return responses;
};

/**
 * 指定した手動インポートデータからCosmos DB格納済の項目を除外する
 * @param {Data} initData 手動インポートデータ
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 * @returns {Promise<Data>} Cosmos DB未格納の手動インポートデータの項目のPromise
 */
export const filterInsertedManualInitData = async (
  initData: Data,
  cosmosClient: CosmosClient
): Promise<Data> => {
  // dataのobjectの構造に従って、query処理を実行するPromiseを格納する
  // データベース名、コンテナー名単位の2次元配列を生成して実行
  const query: SqlQuerySpec = {
    query: "SELECT c.id FROM c",
  };
  type QueryResult = { id: string };
  const promises = Object.keys(initData).map(
    (databaseName: string): Promise<FeedResponse<QueryResult>[]> => {
      const database = cosmosClient.database(databaseName);

      const queryPromises = Object.keys(initData[databaseName]).map(
        (containerName: string): Promise<FeedResponse<QueryResult>> => {
          const container = database.container(containerName);
          return container.items.query<QueryResult>(query).fetchAll();
        }
      );
      return Promise.all(queryPromises);
    }
  );
  const responsesAll: FeedResponse<QueryResult>[][] = await Promise.all(
    promises
  );

  // dataのobjectの構造に沿うように、
  // データベース名、コンテナー名単位の2次元配列→objectのobjectに変換
  return Object.keys(initData).reduce(
    (nonInsertedData: Data, databaseName: string, databaseIdx: number) => {
      nonInsertedData[databaseName] = Object.keys(
        initData[databaseName]
      ).reduce(
        (
          nonInsertedDatabaseData: DatabaseData,
          containerName: string,
          containerIdx: number
        ) => {
          const insertedIds: string[] = responsesAll[databaseIdx][
            containerIdx
          ].resources.map((resources: QueryResult) => resources.id);

          const nonInsertedItems: Item[] = initData[databaseName][
            containerName
          ].reduce((prevNonInsertedItems: Item[], item: Item) => {
            if (!insertedIds.includes(`${item.testId}_${item.number}`)) {
              prevNonInsertedItems.push(item);
            }
            return prevNonInsertedItems;
          }, []);
          if (nonInsertedItems.length)
            nonInsertedDatabaseData[containerName] = nonInsertedItems;

          return nonInsertedDatabaseData;
        },
        {}
      );
      return nonInsertedData;
    },
    {}
  );
};

/**
 * 現在のAzure CLIKey Vaultでの暗号化/復号クライアントを生成する
 * @returns {CryptographyClient} Key Vaultでの暗号化/復号クライアント
 */
export const createCryptographyClient =
  async (): Promise<CryptographyClient> => {
    const credential = new DefaultAzureCredential();
    const keyClient = new KeyClient(VAULT_URL, credential);
    const cryptographyKey = await keyClient.getKey(VAULT_CRYPTOGRAPHY_KEY_NAME);
    if (!cryptographyKey) {
      throw new Error(
        `Key vault key "${VAULT_CRYPTOGRAPHY_KEY_NAME}" is not found.`
      );
    }
    return new CryptographyClient(cryptographyKey.id, credential);
  };

/**
 * 指定したstring型の平文(複数個)を、それぞれstring型→Uint8Array型→number[]型として暗号化する
 * @param {string[]} rawStrings 平文(複数個)
 * @param {CryptographyClient} cryptographyClient Key Vaultでの暗号化/復号クライアント
 * @returns {Promise<number[][]>} 暗号化した0〜255の値を持つ配列(複数個)のPromise
 */
export const encryptStrings2NumberArrays = async (
  rawStrings: string[],
  cryptographyClient: CryptographyClient
): Promise<number[][]> => {
  const encryptResults: EncryptResult[] = await Promise.all(
    rawStrings.map(
      (rawString: string, i: number): Promise<EncryptResult> =>
        cryptographyClient
          .encrypt({
            algorithm: "RSA1_5",
            plaintext: Buffer.from(rawString),
          })
          .catch((e) => {
            console.error(
              `${i}th Encrypt Error(${rawString.length} chars): ${rawString}`
            );
            throw e;
          })
    )
  );
  return encryptResults.map((encryptedResult: EncryptResult) =>
    Array.from(encryptedResult.result)
  );
};
