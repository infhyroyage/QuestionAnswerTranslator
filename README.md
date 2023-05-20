# QuestionAnswerTranslator

[![Create Azure Resources](https://github.com/infhyroyage/QuestionAnswerTranslator/actions/workflows/create-azure-resources.yaml/badge.svg)](https://github.com/infhyroyage/QuestionAnswerTranslator/actions/workflows/create-azure-resources.yaml)
[![Build and Deploy Azure Functions Application](https://github.com/infhyroyage/QuestionAnswerTranslator/actions/workflows/build-deploy-functions-app.yaml/badge.svg)](https://github.com/infhyroyage/QuestionAnswerTranslator/actions/workflows/build-deploy-functions-app.yaml)
[![Deploy API Management](https://github.com/infhyroyage/QuestionAnswerTranslator/actions/workflows/deploy-apim.yaml/badge.svg)](https://github.com/infhyroyage/QuestionAnswerTranslator/actions/workflows/deploy-apim.yaml)
[![Regenerate Keys](https://github.com/infhyroyage/QuestionAnswerTranslator/actions/workflows/regenerate-keys.yaml/badge.svg)](https://github.com/infhyroyage/QuestionAnswerTranslator/actions/workflows/regenerate-keys.yaml)

## 概要

[QuestionAnswerPortal](https://github.com/infhyroyage/QuestionAnswerPortal)から呼び出す、[QuestionAnswerSwagger](https://github.com/infhyroyage/QuestionAnswerSwagger)に従った API サーバーを構成する。

## アーキテクチャー図

![architecture.drawio](architecture.drawio.svg)

| Azure リソース名            | 概要                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `qatranslator-je-apim`      | ユーザー/App Service からアクセスする API Management                                         |
| `qatranslator-je-func`      | API Management からアクセスする Functions                                                    |
| `qatranslator-je-funcplan`  | Functions のプラン                                                                           |
| `qatranslatorjesa`          | Functions から参照するストレージアカウント                                                   |
| `qatranslator-je-cosmosdb`  | Functions からアクセスする Cosmos DB                                                         |
| `qatranslator-je-cognitive` | Functions からアクセスする Translator(無料枠を使い切った場合は代わりに DeepL へアクセスする) |
| `qatranslator-je-vault`     | 暗号鍵/シークレットを管理する Key Vault                                                      |
| `qatranslator-je-insights`  | App Service/API Management/Functions を一括で監視する Application Insights                   |

## 使用する主要なパッケージのバージョン

| 名称       | バージョン |
| ---------- | ---------- |
| Node.js    | 16.19.0    |
| Typescript | 4.9.5      |

## 初期構築

Azure リソース/localhost に環境を構築する事前準備として、以下の順で初期構築を必ずすべて行う必要がある。

1. Azure AD 認証認可用サービスプリンシパルの発行
2. GitHub Actions 用サービスプリンシパルの発行
3. リポジトリのシークレット・変数設定
4. インポートデータファイルの作成

### 1. Azure AD 認証認可用サービスプリンシパルの発行

[Microsoft ID Platform](https://learn.microsoft.com/ja-jp/azure/active-directory/develop/v2-overview)経由で Web アプリケーションに認証認可を実現するためのサービスプリンシパル QATranslator_MSAL を、[QuestionAnswerPortal の「1. Microsoft ID Platform 認証認可用サービスプリンシパルの発行」](https://github.com/infhyroyage/QuestionAnswerPortal#1-microsoft-id-platform-%E8%AA%8D%E8%A8%BC%E8%AA%8D%E5%8F%AF%E7%94%A8%E3%82%B5%E3%83%BC%E3%83%93%E3%82%B9%E3%83%97%E3%83%AA%E3%83%B3%E3%82%B7%E3%83%91%E3%83%AB%E3%81%AE%E7%99%BA%E8%A1%8C)の通りに発行する。

### 2. GitHub Actions 用サービスプリンシパルの発行

1. Azure CLI にてログイン後、以下のコマンドを実行し、サービスプリンシパル`QATranslator_Contributor`を発行する。
   ```bash
   az ad sp create-for-rbac --name QATranslator_Contributor --role Contributor --scope /subscriptions/{サブスクリプションID}
   ```
2. 1 のコマンドを実行して得た以下の値を、それぞれ手元に控える。
   - `appId`(=クライアント ID)
   - `password`(=クライアントシークレット)
3. Azure Portal から Azure AD > App Registrations に遷移する。
4. QATranslator_Contributor のリンク先にある Overview にある「Managed application in local directory」のリンク「QATranslator_Contributor」を押下し、QATranslator_Contributor のエンタープライズアプリケーションに遷移する。
5. Overview の Properties にある「Object ID」の値(=エンタープライズアプリケーションのオブジェクト ID)を手元に控える。

### 3. リポジトリのシークレット・変数設定

QuestionAnswerTranslator リポジトリの Setting > Secrets And variables > Actions より、以下のシークレット・変数をすべて設定する。

#### シークレット

Secrets タブから「New repository secret」ボタンを押下して、下記の通り変数をすべて設定する。

| シークレット名                        | シークレット値                                                   |
| ------------------------------------- | ---------------------------------------------------------------- |
| AZURE_APIM_PUBLISHER_EMAIL            | API Management の発行者メールアドレス                            |
| AZURE_AD_SP_CONTRIBUTOR_CLIENT_SECRET | 2.で発行した QATranslator_Contributor のクライアントシークレット |
| DEEPL_AUTH_KEY                        | DeepL API の認証キー                                             |

#### 変数

Variables タブから「New repository variable」ボタンを押下して、下記の通り変数をすべて設定する。

| 変数名                            | 変数値                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| AZURE_AD_EA_CONTRIBUTOR_OBJECT_ID | 2.で発行した QATranslator_Contributor のエンタープライズアプリケーションのオブジェクト ID |
| AZURE_AD_SP_CONTRIBUTOR_CLIENT_ID | 2.で発行した QATranslator_Contributor のクライアント ID                                   |
| AZURE_AD_SP_MSAL_CLIENT_ID        | 1.で発行した QATranslator_MSAL のクライアント ID                                          |
| AZURE_SUBSCRIPTION_ID             | Azure サブスクリプション ID                                                               |
| AZURE_TENANT_ID                   | Azure ディレクトリ ID                                                                     |

### 4. インポートデータファイルの作成

`qatranslator-je-cosmosdb`に格納するデータは、GitHub 上で管理せず、**インポートデータファイル**と呼ぶ特定のフォーマットで記述した Typescript のソースコードを、ローカル上で管理する運用としている。
インポートデータファイルは、ローカルで git clone した QuestionAnswerTranslator リポジトリの cosmosdb/data 配下に importData.ts というファイル名で用意する必要がある。
インポートデータファイルのフォーマットを以下に示す。

```typescript
import { ImportData } from "../../types/import";

export const importData: ImportData = {
  "コース名1": {
    "テスト名1": [
      {
        number: 1, // 問題番号(1スタート)
        subjects: ["問題文1", "https://xxx.com/yyy/zzz.png", "問題文2", ... ], // 問題文または画像URL
        choices: ["選択肢1", "選択肢2", ... ], // 選択肢
        correctIdxes: [0], // 回答の選択肢のインデックス(複数回答の場合は複数指定)
        explanations: ["解説文1", "解説文2", ... ], // 解説文または画像URL
        incorrectChoicesExplanations: [null, ["選択肢2の解説文1", "選択肢2の解説文2", ... ], ... ], // 不正解の選択肢の解説文(正解の選択肢はnull、省略可能)
        indicateImgIdxes: { // 画像URLのインデックス群(省略可能)
          subjects: [0, ... ], // subjects(省略可能)
          explanations: [2, ... ] // explanations(省略可能)
        },
        escapeTranslatedIdxes: { // 翻訳不必要な文字列のインデックス群(省略可能)
          subjects: [0, ... ], // subjects(省略可能)
          choices: [1, ... ], // choices(省略可能)
          explanations: [2, ... ], // explanations(省略可能)
          incorrectChoicesExplanations: [null, [0, ... ], ... ] // incorrectChoicesExplanations(正解の選択肢はnull、省略可能)
        },
        references: ["https://xxx.com/yyy/zzz.html", ... ] // 解説URL(省略可能)
      },
      {
        number: 2,
        :
      },
      :
    ],
    "テスト名2": [
      :
    ],
    :
  },
  "コース名2": {
    :
  },
  :
}
```

## Azure リソース環境構築

### 構築手順

1. QuestionAnswerTranslator リポジトリの各 workflow をすべて有効化する。
2. QuestionAnswerTranslator リポジトリの Actions > 左側の Create Azure Resources の順で押下し、「Run workflow」のプルダウンから main ブランチに対して「Run workflow」ボタンを押下して、 Azure Resources の workflow を手動で実行する。
3. Azure Portal から Key Vault > qatranslator-je-vault > Access policies > Create の順で押下し、以下の通り「Next」ボタンを入力しながら「Create」ボタンを押下して、自身の AzureAD ユーザーの Azure Key Vault へのアクセス許可を追加する。
   - Permission : 「Key permissions」配下の「Get」と「Encrypt」、および、「Secret permissions」配下の「Get」に、それぞれチェックを入れる。
   - Principal : 自身の AzureAD ユーザー名を検索して選択する。
   - Application (optional) : 入力しない。
4. ターミナルを起動して以下のコマンドを実行し、Azure にデプロイ済の Cosmos DB に対し、インポートデータファイルからインポートする(タイムアウトなどで失敗した場合、もう一度実行し直すこと)。
   ```bash
   npm run cosmosdb:import
   ```

### 削除手順

1. QuestionAnswerTranslator リポジトリの各 workflow をすべて無効化する。
2. ターミナルを起動して以下のコマンドを実行し、リソースグループ`qatranslator-je`を削除する。
   ```bash
   az group delete -n qatranslator-je -y
   ```
3. 2 のターミナルで以下のコマンドを実行し、論理的に削除した`qatranslator-je-vault`を物理的に削除する。
   ```bash
   az keyvault purge -n qatranslator-je-vault
   ```
4. 3 のターミナルで以下のコマンドを実行し、論理的に削除した`qatranslator-je-cognitive`を物理的に削除する。
   ```bash
   az resource delete --ids /subscriptions/(サブスクリプションID)/providers/Microsoft.CognitiveServices/locations/japaneast/resourceGroups/qatranslator-je/deletedAccounts/qatranslator-je-cognitive
   ```
5. 4 のターミナルで以下のコマンドを実行し、論理的に削除した`qatranslator-je-apim`を物理的に削除する。
   ```bash
   az rest -m DELETE -u https://management.azure.com/subscriptions/(サブスクリプションID)/providers/Microsoft.ApiManagement/locations/japaneast/deletedservices/qatranslator-je-apim?api-version=2021-08-01
   ```

## API 追加開発時の対応

### 関数アプリ

functions 配下に cd し、以下のファイルを持つ関数アプリのプロジェクトディレクトリを生成する。

- function.json
- index.ts

### API Management

上記で生成した関数アプリが HTTP Trigger の場合は、[QuestionAnswerSwagger の swagger.yaml](https://github.com/infhyroyage/QuestionAnswerSwagger/blob/main/swagger.yaml)にその関数アプリの API リファレンスを記述する。

## localhost 環境構築

Azure にリソースを構築せず、localhost 上で以下のサーバーをそれぞれ起動することもできる。

| サーバー名                                     | 使用するサービス名                                                                                       | ポート番号 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------- |
| Azure Functions(HTTP Trigger の関数アプリのみ) | [Azure Functions Core Tools](https://docs.microsoft.com/ja-jp/azure/azure-functions/functions-run-local) | 9229       |
| Cosmos DB                                      | [Azure Cosmos DB Linux Emulator](https://docs.microsoft.com/ja-jp/azure/cosmos-db/local-emulator)        | 8081       |

localhost 環境構築後、 [Azure Cosmos DB Emulator の index.html](https://localhost:8081/_explorer/index.html) にアクセスすると、Cosmos DB 内のデータを参照・更新することができる。

### 構築手順

1. Docker および Docker Compose をインストールする。
   - Azure Functions Core Tools
   - Docker
   - Docker Compose
2. 以下を記述したファイル`local.settings.json`を QuestionAnswerTranslator リポジトリの functions ディレクトリ配下に保存する。
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "COGNITIVE_KEY": "(Azureリソース環境構築時にデプロイしたqatranslator-je-cognitiveのキー値)",
       "COSMOSDB_KEY": "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
       "COSMOSDB_READONLY_KEY": "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
       "COSMOSDB_URI": "https://localhost:8081",
       "DEEPL_AUTH_KEY": "(Azureリソース環境構築時にGitHubへ登録したシークレットDEEPL_AUTH_KEYの値)",
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "NODE_TLS_REJECT_UNAUTHORIZED": "0"
     },
     "Host": {
       "CORS": "*",
       "LocalHttpPort": 9229
     },
     "ConnectionStrings": {}
   }
   ```
   - CORS は任意のオリジンを許可するように設定しているため、特定のオリジンのみ許可したい場合は`Host` > `CORS`にそのオリジンを設定すること。
3. ターミナルを起動して以下のコマンドを実行し、Azure Functions を起動する。実行したターミナルはそのまま放置する。
   ```bash
   npm run local:functions
   ```
4. 3 とは別のターミナルで以下のコマンドを実行し、Cosmos DB を起動する。実行したターミナルはそのまま放置する。
   ```bash
   npm run local:cosmosdbCreate
   ```
   実行後、以下の標準出力が表示されるまで待機する。
   ```
   localcosmosdb     | Started
   ```
5. 4 とは別のターミナルで以下のコマンドを実行し、起動した Cosmos DB サーバーに対し、インポートデータファイルからインポートする(タイムアウトなどで失敗した場合、もう一度実行し直すこと)。
   ```bash
   npm run local:cosmosdbImport
   ```

### 削除手順

1. ターミナルを起動して以下のコマンドを実行し、起動した Cosmos DB を停止する。
   ```bash
   npm run local:cosmosdbDestroy
   ```
2. 構築手順の 3 で起動した Azure Functions のターミナルに対して Ctrl+C キーを入力し、起動した Azure Functions を停止する。

## 完全初期化

初期構築以前の完全なクリーンな状態に戻すためには、初期構築で行ったサービスプリンシパル・シークレット・変数それぞれを以下の順で削除すれば良い。

1. リポジトリの各シークレット・変数の削除
2. GitHub Actions 用サービスプリンシパルの削除
3. Azure AD 認証認可用サービスプリンシパルの削除

### 1. リポジトリのシークレット・変数の削除

QuestionAnswerTranslator リポジトリの Setting > Secrets And variables > Actions より、Secrets・Variables タブから初期構築時に設定した各シークレット・変数に対し、ゴミ箱のボタンを押下する。

### 2. GitHub Actions 用サービスプリンシパルの削除

1. Azure Portal から Azure AD > App Registrations に遷移する。
2. QATranslator_Contributor のリンク先にある Delete ボタンを押下し、「I understand the implications of deleting this app registration.」のチェックを入れて Delete ボタンを押下する。

### 3. Azure AD 認証認可用サービスプリンシパルの削除

[QuestionAnswerPortal の「2. Microsoft ID Platform 認証認可用サービスプリンシパルの削除」](https://github.com/infhyroyage/QuestionAnswerPortal#2-microsoft-id-platform-%E8%AA%8D%E8%A8%BC%E8%AA%8D%E5%8F%AF%E7%94%A8%E3%82%B5%E3%83%BC%E3%83%93%E3%82%B9%E3%83%97%E3%83%AA%E3%83%B3%E3%82%B7%E3%83%91%E3%83%AB%E3%81%AE%E5%89%8A%E9%99%A4)の通りに削除する。
