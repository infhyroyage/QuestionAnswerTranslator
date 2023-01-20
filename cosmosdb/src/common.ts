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
import { KeyVaultSecret, SecretClient } from "@azure/keyvault-secrets";
import deepcopy from "deepcopy";
import { v4 as uuidv4 } from "uuid";
import { importData } from "../data/importData";
import {
  Item,
  Data,
  DatabaseData,
  CourseAndTestName2TestId,
  TestName2TestId,
  ImportData,
  ImportDatabaseData,
  Test,
} from "../types/common";

const COSMOSDB_LOCAL_KEY =
  "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";
const COSMOSDB_LOCAL_URI = "https://localhost:9230";
const COSMOSDB_URI =
  "https://qatranslator-je-cosmosdb.documents.azure.com:443/";
const VAULT_URL = "https://qatranslator-je-vault.vault.azure.net";
const VAULT_CRYPTOGRAPHY_KEY_NAME = "manual-import-data";

/**
 * コマンドライン引数でコース名/テスト名指定した場合は、インポートデータから
 * 指定したコース名/テスト名における項目を抽出して、インポートデータを生成する
 * @returns {ImportData} 抽出した項目のみで構成するインポートデータ
 */
export const createImportData = (): ImportData => {
  let courseName: string;
  const extractedImportData: ImportData = {};
  switch (process.argv.length) {
    case 2:
      // コマンドライン引数にコース名/テスト名を未指定
      return deepcopy(importData);
    case 3:
      // コース名のみをコマンドライン引数で指定
      courseName = process.argv[2];
      if (!(courseName in importData)) {
        throw new Error("Invalid arguments");
      }

      extractedImportData[courseName] = { ...importData[courseName] };
      return extractedImportData;
    case 4:
      // コース名・テスト名をコマンドライン引数で指定
      courseName = process.argv[2];
      const testName: string = process.argv[3];
      if (
        !(courseName in importData) ||
        !(testName in importData[courseName])
      ) {
        throw new Error("Invalid arguments");
      }

      const extractedImportDatabaseData: ImportDatabaseData = {};
      extractedImportDatabaseData[testName] = [
        ...importData[courseName][testName],
      ];
      extractedImportData[courseName] = extractedImportDatabaseData;
      return extractedImportData;
    default:
      throw new Error("Invalid arguments");
  }
};

/**
 * Cosmos DBのクライアントを生成する
 * @returns {Promise<CosmosClient>} Cosmos DBのクライアント
 */
export const generateCosmosClient = async (): Promise<CosmosClient> => {
  let endpoint: string, key: string;
  if (process.env["NODE_TLS_REJECT_UNAUTHORIZED"] === "0") {
    // ローカル環境
    endpoint = COSMOSDB_LOCAL_URI;
    key = COSMOSDB_LOCAL_KEY;
  } else {
    // 非ローカル環境の場合、az loginでログイン中のサービスプリンシパルでKey Vaultにログインし、
    // Cosmos DBのプライマリーマスターキーを取得
    endpoint = COSMOSDB_URI;
    const keyName: string = "cosmos-db-primary-key";
    const secret: KeyVaultSecret = await new SecretClient(
      VAULT_URL,
      new AzureCliCredential()
    ).getSecret(keyName);
    if (!secret) {
      throw new Error(`Key vault secret "${keyName}" is not found.`);
    }
    key = secret.value;
  }

  return new CosmosClient({ endpoint, key });
};

/**
 * インポートデータの格納に必要な各データベース、コンテナーをすべて作成する
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 * @returns {Promise<void>}
 */
export const createDatabasesAndContainers = async (
  cosmosClient: CosmosClient
): Promise<void> => {
  // Usersデータベース
  const { database } = await cosmosClient.databases.createIfNotExists({
    id: "Users",
  });

  // Testコンテナー
  await database.containers.createIfNotExists({
    id: "Test",
    partitionKey: "/id",
  });

  // Questionコンテナー
  await database.containers.createIfNotExists({
    id: "Question",
    partitionKey: "/id",
  });
};

/**
 * インポートデータからUsersテータベースのTestコンテナーの項目を生成する
 * @param {ImportData} importData インポートデータ
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 * @returns {Promise<Test[]>} UsersテータベースのTestコンテナーの項目
 */
export const generateTestItems = async (
  importData: ImportData,
  cosmosClient: CosmosClient
): Promise<Test[]> => {
  // UsersテータベースのTestコンテナーをreadAll
  let insertedTestItems: Test[];
  try {
    const res: FeedResponse<Test> = await cosmosClient
      .database("Users")
      .container("Test")
      .items.readAll<Test>()
      .fetchAll();
    insertedTestItems = res.resources;
  } catch (e) {
    console.log("generateTestItems: Not Found Items");
    insertedTestItems = [];
  }

  return Object.keys(importData).reduce(
    (prevTestItems: Test[], courseName: string) => {
      const innerTestItems: Test[] = Object.keys(importData[courseName]).reduce(
        (prevInnerTestItems: Test[], testName: string) => {
          // UsersテータベースのTestコンテナー格納済の場合は格納した項目、
          // 未格納の場合はundefinedを取得
          const foundTestItem: Test | undefined = insertedTestItems.find(
            (item: Test) =>
              item.courseName === courseName && item.testName === testName
          );

          return [
            ...prevInnerTestItems,
            foundTestItem || {
              courseName,
              testName,
              id: uuidv4(),
              length: importData[courseName][testName].length,
            },
          ];
        },
        []
      );

      return [...prevTestItems, ...innerTestItems];
    },
    []
  );
};

/**
 * UsersテータベースのTestコンテナーの項目をインポートする
 * 項目は比較的要求ユニット(RU)数が少量であるものとする
 * @param {Test[]} testItems UsersテータベースのTestコンテナーの項目
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 * @returns {Promise<void>}
 */
export const importTestItems = async (
  testItems: Test[],
  cosmosClient: CosmosClient
): Promise<void> => {
  // UsersテータベースのTestコンテナーにBulk Upsert
  const bulkResponse: OperationResponse[] = await cosmosClient
    .database("Users")
    .container("Test")
    .items.bulk(
      testItems.map((item: Test): UpsertOperationInput => {
        return {
          operationType: "Upsert",
          partitionKey: item.id,
          resourceBody: item,
        };
      })
    );

  // レスポンス正常性チェック
  const firstErrorRes: OperationResponse | undefined = bulkResponse.find(
    (res: OperationResponse) => res.statusCode >= 400
  );
  if (firstErrorRes) {
    console.error(firstErrorRes.resourceBody);
    throw new Error("Exists NG Bulk Upsert Response.");
  }
};

/**
 * Cosmos DB格納済のインポートデータから抽出した項目を取得する
 * @param {ImportData} importData インポートデータ
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 * @returns {Promise<Data>} Cosmos DB格納済の全項目を含むインポートデータのPromise
 */
const fetchInsertedImportData = async (
  importData: ImportData,
  cosmosClient: CosmosClient
): Promise<Data> => {
  // コース名・テスト名単位にqueryを並列実行し、配列として格納
  const readAllPromises: Promise<Item[][]>[] = Object.keys(importData).map(
    async (courseName: string): Promise<Item[][]> => {
      const readAllCoursesPromises: Promise<Item[]>[] = Object.keys(
        importData[courseName]
      ).map(async (testName: string): Promise<Item[]> => {
        try {
          // UsersテータベースのTestコンテナーのをquery
          const query: SqlQuerySpec = {
            query:
              "SELECT * FROM c WHERE c.courseName = @courseName AND c.testName = @testName",
            parameters: [
              { name: "@courseName", value: courseName },
              { name: "@testName", value: testName },
            ],
          };
          const res: FeedResponse<Test> = await cosmosClient
            .database("Users")
            .container("Test")
            .items.query<Test>(query)
            .fetchAll();
          return res.resources;
        } catch (e) {
          console.log(
            `Database ${courseName}, Container ${testName}: Not Found Items`
          );
          return [];
        }
      });
      return await Promise.all(readAllCoursesPromises);
    }
  );
  const responses: Item[][][] = await Promise.all(readAllPromises);

  // データベース、コンテナー単位の配列→objectに構造変換
  return Object.keys(importData).reduce(
    (nonInsertedData: Data, databaseName: string, databaseIdx: number) => {
      nonInsertedData[databaseName] = Object.keys(
        importData[databaseName]
      ).reduce(
        (
          nonInsertedDatabaseData: DatabaseData,
          containerName: string,
          containerIdx: number
        ) => {
          nonInsertedDatabaseData[containerName] =
            responses[databaseIdx][containerIdx];
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
 * 手動インポートデータのcourseName&testNameからtestIdへ変換するための変換器を作成する
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 * @returns {Promise<CourseAndTestName2TestId>} 変換器のPromise
 */
const createCourseAndTestName2TestId = async (
  cosmosClient: CosmosClient
): Promise<CourseAndTestName2TestId> => {
  // UsersテータベースのTestコンテナーの全id、courseName、testNameをquery
  const query: SqlQuerySpec = {
    query: "SELECT c.id, c.courseName, c.testName FROM c",
  };
  type QueryResult = { id: string; courseName: string; testName: string };
  const res: FeedResponse<QueryResult> = await cosmosClient
    .database("Users")
    .container("Test")
    .items.query<QueryResult>(query)
    .fetchAll();

  return res.resources.reduce(
    (
      prevCourseAndTestName2TestId: CourseAndTestName2TestId,
      resource: QueryResult
    ) => {
      if (prevCourseAndTestName2TestId[resource.courseName]) {
        prevCourseAndTestName2TestId[resource.courseName][resource.testName] =
          resource.id;
      } else {
        const testName2TestId: TestName2TestId = {};
        testName2TestId[resource.testName] = resource.id;
        prevCourseAndTestName2TestId[resource.courseName] = testName2TestId;
      }

      return prevCourseAndTestName2TestId;
    },
    {}
  );
};

/**
 * 手動インポートデータを作成する
 * @param {unknown} manualImportJson 手動インポート用JSON
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 * @returns {Promise<Data>} 手動インポートデータのPromise
 */
export const createManualImportData = async (
  manualImportJson: unknown,
  cosmosClient: CosmosClient
): Promise<Data> => {
  // Cosmos DB格納済の手動インポート用JSONに対応する全項目のIDを取得
  const insertedManualImportJson: Data = await fetchInsertedImportData(
    { Users: { Question: [] } },
    cosmosClient
  );
  const insertedIds: string[] = insertedManualImportJson.Users.Question.map(
    (item: Item) => item.id
  );

  // courseName&testName→testIdの変換器を作成
  const courseAndTestName2TestId: CourseAndTestName2TestId =
    await createCourseAndTestName2TestId(cosmosClient);

  // Cosmos DB未格納の全項目のみ抽出し、全項目にid、testIdカラムをそれぞれ付加
  return Object.keys(manualImportJson).reduce(
    (prevInitData: Data, courseName: string) => {
      const nonInsertedItemsPerCourse: Item[] = Object.keys(
        manualImportJson[courseName]
      ).reduce((prevInsertedItemsPerTest: Item[], testName: string) => {
        const testId: string = courseAndTestName2TestId[courseName][testName];

        const nonInsertedItemsPerTest: Item[] = manualImportJson[courseName][
          testName
        ].reduce((prevInsertedItems: Item[], item: Item) => {
          if (!insertedIds.includes(`${testId}_${item.number}`)) {
            prevInsertedItems.push({
              ...item,
              id: `${testId}_${item.number}`,
              testId,
            });
          }
          return prevInsertedItems;
        }, []);

        prevInsertedItemsPerTest = prevInsertedItemsPerTest.concat(
          nonInsertedItemsPerTest
        );

        return prevInsertedItemsPerTest;
      }, []);

      prevInitData.Users.Question = prevInitData.Users.Question.concat(
        nonInsertedItemsPerCourse
      );

      return prevInitData;
    },
    { Users: { Question: [] } }
  );
};

/**
 * 比較的要求ユニット(RU)数が多めのデータで構成される、各データベースの各コンテナーに対する全項目を
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
