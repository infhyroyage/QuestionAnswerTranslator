import {
  CosmosClient,
  DatabaseResponse,
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
import { Question, Test } from "../../types/cosmosDB";
import { ImportData, ImportDatabaseData, ImportItem } from "../../types/import";

const COSMOSDB_LOCAL_KEY =
  "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";
const COSMOSDB_LOCAL_URI = "https://localhost:8081";
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
      // コマンドライン引数にコース名・テスト名未指定
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
    if (!secret || !secret.value) {
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
  let databaseRes: DatabaseResponse;

  // Systemsデータベース
  databaseRes = await cosmosClient.databases.createIfNotExists({
    id: "Systems",
  });

  // SystemsデータベースのFlagコンテナー
  await databaseRes.database.containers.createIfNotExists({
    id: "Flag",
    partitionKey: "/id",
  });

  // Usersデータベース
  databaseRes = await cosmosClient.databases.createIfNotExists({
    id: "Users",
  });

  // UsersデータベースのTestコンテナー
  await databaseRes.database.containers.createIfNotExists({
    id: "Test",
    partitionKey: "/id",
  });

  // UsersデータベースのQuestionコンテナー
  await databaseRes.database.containers.createIfNotExists({
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
    throw new Error(
      `Status Code ${firstErrorRes.statusCode}: ${JSON.stringify(
        firstErrorRes.resourceBody
      )}`
    );
  }
};

/**
 * 指定したstring型の平文(複数個)を、それぞれstring型→Uint8Array型→number[]型として暗号化する
 * @param {string[]} rawStrings 平文(複数個)
 * @param {CryptographyClient} cryptographyClient Key Vaultでの暗号化/復号クライアント
 * @returns {Promise<number[][]>} 暗号化した0〜255の値を持つ配列(複数個)のPromise
 */
const encryptStrings2NumberArrays = async (
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

/**
 * 指定したUsersデータベースのQuestionコンテナーの1項目に対し、
 * 以下のカラムを平文(複数個)のstring[]型からnumber[][]型に暗号化する
 * * subjects
 * * choices
 * * explanations
 * * (Optional)incorrectChoicesExplanationsの各非空文字要素
 * @param {Question} rewQuestionItem UsersデータベースのQuestionコンテナーの平文のカラムを持つ項目
 * @param {CryptographyClient} cryptographyClient Key Vaultでの暗号化/復号クライアント
 * @returns {Promise<Question>} UsersデータベースのQuestionコンテナーの暗号化したカラムを持つ項目
 */
const excryptQuestionItem = async (
  rewQuestionItem: Question,
  cryptographyClient: CryptographyClient
): Promise<Question> => {
  const encryptedQuestionItem: Question = deepcopy(rewQuestionItem);

  encryptedQuestionItem.subjects = await encryptStrings2NumberArrays(
    rewQuestionItem.subjects as string[],
    cryptographyClient
  );

  encryptedQuestionItem.choices = await encryptStrings2NumberArrays(
    rewQuestionItem.choices as string[],
    cryptographyClient
  );

  encryptedQuestionItem.explanations = await encryptStrings2NumberArrays(
    rewQuestionItem.explanations as string[],
    cryptographyClient
  );

  if (rewQuestionItem.incorrectChoicesExplanations) {
    encryptedQuestionItem.incorrectChoicesExplanations = [];
    for (const incorrectChoiceExplanations of rewQuestionItem.incorrectChoicesExplanations) {
      if (incorrectChoiceExplanations) {
        const encryptedIncorrectChoiceExplanations: number[][] =
          await encryptStrings2NumberArrays(
            incorrectChoiceExplanations as string[],
            cryptographyClient
          );
        encryptedQuestionItem.incorrectChoicesExplanations.push(
          encryptedIncorrectChoiceExplanations
        );
      } else {
        encryptedQuestionItem.incorrectChoicesExplanations.push(null);
      }
    }
  }

  return encryptedQuestionItem;
};

/**
 * インポートデータからUsersテータベースのQuestionコンテナーの項目を生成する
 * コマンドライン引数にコース名・テスト名を指定していない場合は未格納の項目のみ、
 * コース名/テスト名を指定した場合は、そのコース名/テスト名の全項目とする
 * 非ローカル環境の場合は、以下のカラムを暗号化する
 * * subjects
 * * choices
 * * explanations
 * * (Optional)incorrectChoicesExplanationsの各非空文字要素
 * @param {ImportData} importData インポートデータ
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 * @param {Test[]} testItems UsersテータベースのTestコンテナーの項目
 * @returns {Promise<Question[]>} UsersテータベースQuestionコンテナーの項目
 */
export const generateQuestionItems = async (
  importData: ImportData,
  cosmosClient: CosmosClient,
  testItems: Test[]
): Promise<Question[]> => {
  // UsersテータベースのQuestionコンテナーの項目を生成
  let questionItems: Question[], courseName: string;
  if (process.argv.length === 2) {
    // コマンドライン引数にコース名・テスト名未指定
    // UsersテータベースのQuestionコンテナーをquery
    const query: SqlQuerySpec = {
      query: "SELECT c.id FROM c",
    };
    type QueryResult = { id: string };
    const res: FeedResponse<QueryResult> = await cosmosClient
      .database("Users")
      .container("Question")
      .items.query<QueryResult>(query)
      .fetchAll();
    const insertedQuestionIds: string[] = res.resources.map(
      (resource: QueryResult) => resource.id
    );

    questionItems = Object.keys(importData).reduce(
      (prevQuestionItems: Question[], courseName: string) => {
        const innerQuestionItems: Question[] = Object.keys(
          importData[courseName]
        ).reduce((prevInnerQuestionItems: Question[], testName: string) => {
          const testItem: Test | undefined = testItems.find(
            (item: Test) =>
              item.courseName === courseName && item.testName === testName
          );
          if (!testItem) {
            throw new Error(
              `Course Name ${courseName} and Test Name ${testName} Not Found.`
            );
          }

          const testId: string = testItem.id;
          const nonInsertedImportItem: ImportItem[] = importData[courseName][
            testName
          ].filter(
            (item: ImportItem) =>
              !insertedQuestionIds.includes(`${testId}_${item.number}`)
          );

          return [
            ...prevInnerQuestionItems,
            ...nonInsertedImportItem.map((item: ImportItem) => {
              return {
                ...item,
                id: `${testId}_${item.number}`,
                testId,
              };
            }),
          ];
        }, []);

        return [...prevQuestionItems, ...innerQuestionItems];
      },
      []
    );
  } else if (process.argv.length === 3) {
    // コース名のみをコマンドライン引数で指定
    courseName = process.argv[2];
    if (!(courseName in importData)) {
      throw new Error("Invalid arguments");
    }

    // 指定したコース名でのid・テスト名を全取得
    type TestIdAndName = { testId: string; testName: string };
    const testIdAndNames: TestIdAndName[] = testItems
      .filter((item: Test) => item.courseName === courseName)
      .map((item: Test) => {
        return { testId: item.id, testName: item.testName };
      });

    questionItems = testIdAndNames.reduce(
      (prevQuestionItems: Question[], testIdAndName: TestIdAndName) => {
        const items: Question[] = importData[courseName][
          testIdAndName.testName
        ].map((item: ImportItem) => {
          const testId: string = testIdAndName.testId;
          return {
            ...item,
            id: `${testId}_${item.number}`,
            testId,
          };
        });
        return [...prevQuestionItems, ...items];
      },
      []
    );
  } else if (process.argv.length === 4) {
    // コース名・テスト名をコマンドライン引数で指定
    courseName = process.argv[2];
    const testName: string = process.argv[3];
    if (!(courseName in importData) || !(testName in importData[courseName])) {
      throw new Error("Invalid arguments");
    }

    // UsersテータベースのTestコンテナーのidを取得
    const testItem: Test | undefined = testItems.find(
      (item: Test) =>
        item.courseName === courseName && item.testName === testName
    );
    if (!testItem) {
      throw new Error(
        `Course Name ${courseName} and Test Name ${testName} Not Found.`
      );
    }

    const testId: string = testItem.id;
    questionItems = importData[courseName][testName].map((item: ImportItem) => {
      return {
        ...item,
        id: `${testId}_${item.number}`,
        testId,
      };
    });
  } else {
    throw new Error("Invalid arguments");
  }

  // ローカル環境はここで終了、非ローカル環境の場合は暗号化を行う
  if (process.env["NODE_TLS_REJECT_UNAUTHORIZED"] === "0") {
    return questionItems;
  }

  // 現在のAzure資格情報から、Key Vaultでの暗号化/復号クライアントを生成
  const credential = new DefaultAzureCredential();
  const keyClient = new KeyClient(VAULT_URL, credential);
  const cryptographyKey = await keyClient.getKey(VAULT_CRYPTOGRAPHY_KEY_NAME);
  if (!cryptographyKey || !cryptographyKey.id) {
    throw new Error(
      `Key vault key "${VAULT_CRYPTOGRAPHY_KEY_NAME}" is not found.`
    );
  }
  const cryptographyClient: CryptographyClient = new CryptographyClient(
    cryptographyKey.id,
    credential
  );

  // 生成したUsersテータベースのQuestionコンテナーの項目の一部カラムを直列に暗号化
  const encryptedQuestionItems: Question[] = [];
  for (const questionItem of questionItems) {
    const encryptedQuestionItem: Question = await excryptQuestionItem(
      questionItem,
      cryptographyClient
    );
    encryptedQuestionItems.push(encryptedQuestionItem);
  }

  return encryptedQuestionItems;
};

/**
 * UsersテータベースのQuestionコンテナーの項目を合間にsleepしながらインポートする
 * 項目は比較的要求ユニット(RU)数が多めであるものとする
 * @link https://docs.microsoft.com/ja-jp/azure/cosmos-db/sql/troubleshoot-request-rate-too-large
 * @param {Question[]} questionItems UsersテータベースのQuestionコンテナーの項目
 * @param {CosmosClient} cosmosClient Cosmos DBのクライアント
 * @param {number} sleepPeriod sleepする時間(ms単位)
 * @returns {Promise<void>}
 */
export const importQuestionItemsAndSleep = async (
  questionItems: Question[],
  cosmosClient: CosmosClient,
  sleepPeriod: number
): Promise<void> => {
  const sleep = (sleepPeriod: number): Promise<unknown> =>
    new Promise((resolve) => setTimeout(resolve, sleepPeriod));

  for (let i = 0; i < questionItems.length; i++) {
    const item: Question = questionItems[i];
    const res: ItemResponse<Question> = await cosmosClient
      .database("Users")
      .container("Question")
      .items.upsert<Question>(item);

    // レスポンス正常性チェック
    if (res.statusCode >= 400) {
      throw new Error(`Status Code ${res.statusCode}: ${JSON.stringify(item)}`);
    } else {
      console.log(`${i + 1}th Response OK`);
    }

    await sleep(sleepPeriod);
  }
};
