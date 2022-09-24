import { CosmosClient, Container } from "@azure/cosmos";

/**
 * 指定したCosmos DBアカウントのコンテナーの読み取り専用インスタンスを返す
 * @param {string} databaseName Cosmos DBアカウントのデータベース名
 * @param {string} containerName Cosmos DBアカウントのコンテナー名
 * @returns {Container} Cosmos DBアカウントのコンテナーの読み取り専用インスタンス
 */
export const getReadOnlyContainer = (
  databaseName: string,
  containerName: string
): Container =>
  new CosmosClient({
    endpoint: process.env["COSMOSDB_URI"],
    key: process.env["COSMOSDB_READONLY_KEY"],
  })
    .database(databaseName)
    .container(containerName);

/**
 * 指定したCosmos DBアカウントのコンテナーのインスタンスを返す
 * @param {string} databaseName Cosmos DBアカウントのデータベース名
 * @param {string} containerName Cosmos DBアカウントのコンテナー名
 * @returns {Container} Cosmos DBアカウントのコンテナーのインスタンス
 */
export const getReadWriteContainer = (
  databaseName: string,
  containerName: string
): Container =>
  new CosmosClient({
    endpoint: process.env["COSMOSDB_URI"],
    key: process.env["COSMOSDB_KEY"],
  })
    .database(databaseName)
    .container(containerName);
