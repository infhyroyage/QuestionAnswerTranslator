# QuestionAnswerTranslator

## 概要

[Microsoft ID Platform](https://learn.microsoft.com/ja-jp/azure/active-directory/develop/v2-overview)経由で認証認可を行った[QuestionAnswerPortal](https://github.com/infhyroyage/QuestionAnswerPortal)の Web アプリケーションから呼び出す、主に以下の Azure リソースで必要最小限のコストに抑えるように構成する API サーバーと、Web サーバーの 2 つを構成する Azure リソース。

- Azure API Management
- Azure Functions
- Azure Cosmos DB

## アーキテクチャー図

![architecture.drawio](architecture.drawio.svg)

| Azure リソース名            | 概要                                                                          | workflow での CI/CD      |
| --------------------------- | ----------------------------------------------------------------------------- | :----------------------- |
| `qatranslator-ea-swa`       | ユーザーからアクセスする Static Web App                                       | QuestionAnswerPortal     |
| `qatranslator-je-apim`      | ユーザー/Static Web App からアクセスする API Management                       | QuestionAnswerTranslator |
| `qatranslator-je-func`      | API Management からアクセスする Functions                                     | QuestionAnswerTranslator |
| `qatranslator-je-funcplan`  | Functions のプラン                                                            |                          |
| `qatranslatorjesa`          | Functions から参照するストレージアカウント                                    |                          |
| `qatranslator-je-cosmosdb`  | Functions からアクセスする Cosmos DB                                          |                          |
| `qatranslator-je-cognitive` | ユーザーから DeepL の無料枠を超過した場合のみアクセスする Translator          |                          |
| `qatranslator-je-vault`     | 暗号鍵/シークレットを管理する Key Vault                                       |                          |
| `qatranslator-je-insights`  | Static Web App/API Management/Functions を一括で監視する Application Insights |                          |
| `qatranslator-je-ws`        | Application Insights を分析する Workspaces                                    |                          |

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
   az ad sp create-for-rbac --name "QATranslator_Contributor" --role "Contributor" --scope /subscriptions/{サブスクリプションID} --sdk-auth
   ```
2. 1 のコマンドを実行して得た以下の値を、それぞれ手元に控える。
   - `clientId`(=クライアント ID)
   - `clientSecret`(=クライアントシークレット)
3. Azure Portal から Azure AD に遷移する。

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

| 変数名                            | 変数値                                                  |
| --------------------------------- | ------------------------------------------------------- |
| AZURE_AD_SP_CONTRIBUTOR_CLIENT_ID | 2.で発行した QATranslator_Contributor のクライアント ID |
| AZURE_AD_SP_MSAL_CLIENT_ID        | 1.で発行した QATranslator_MSAL のクライアント ID        |
| AZURE_SUBSCRIPTION_ID             | Azure サブスクリプション ID                             |
| AZURE_TENANT_ID                   | Azure ディレクトリ ID                                   |

### 4. インポートデータファイルの作成

Cosmos DB に保存する以下の文字列は、そのまま GitHub 上に管理するべきではないセキュリティ上の理由のため、**インポートデータファイル**と呼ぶ特定のフォーマットで記述した Typescript のソースコードを git 管理せず、ローカル管理する運用としている。
インポートデータファイルは、ローカルで git clone した QuestionAnswerTranslator リポジトリの cosmosdb/data 配下に importData.ts というファイル名で Azure リソース/localhost 環境構築前に用意しておく必要がある。
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
2. Create Azure Resources の workflow を手動で実行する。
3. 以下のコマンドを実行して、Azure にデプロイ済の Cosmos DB に対し、インポートデータファイルからインポートする(タイムアウトなどで失敗した場合、もう一度実行し直すこと)。
   ```bash
   npm run cosmosdb:import
   ```

### 削除手順

1. QuestionAnswerTranslator リポジトリの各 workflow をすべて無効化する。
2. Azure Portal からリソースグループ`qatranslator-je`を削除する。
3. Azure Portal から Key Vault > Manage deleted vaults > サブスクリプション > qatranslator-je-vault の順で押下し、Purge ボタンを押下して、論理的に削除した Key Vault を物理的に削除する。
4. 以下の Azure CLI の実行後に正常復帰することを確認し、論理的に削除した API Management を物理的に削除する。
   ```bash
   az rest -m DELETE -u https://management.azure.com/subscriptions/(サブスクリプションID)/providers/Microsoft.ApiManagement/locations/japaneast/deletedservices/qatranslator-je-apim?api-version=2021-08-01
   ```

## API 追加開発時の対応

### 関数アプリ

functions 配下に cd し、以下のファイルを持つ関数アプリのプロジェクトディレクトリを生成する。

- function.json
- index.ts

### API Management

上記で生成した関数アプリが HTTP Trigger の場合は、apim/apis-functions-swagger.yaml にその関数アプリの Swagger を記述する。

## localhost 環境構築

Azure にリソースを構築せず、localhost 上で以下のサーバーをそれぞれ起動することもできる。

| サーバー名                                     | 使用するサービス名                                                                                       | ポート番号 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------- |
| Azure Functions(HTTP Trigger の関数アプリのみ) | [Azure Functions Core Tools](https://docs.microsoft.com/ja-jp/azure/azure-functions/functions-run-local) | 9229       |
| Cosmos DB                                      | [Azure Cosmos DB Linux Emulator](https://docs.microsoft.com/ja-jp/azure/cosmos-db/local-emulator)        | 9230       |

localhost 環境構築後、 [Azure Cosmos DB Emulator の index.html](https://localhost:9230/_explorer/index.html) にアクセスすると、Cosmos DB 内のデータを参照・更新することができる。

### 構築手順

1. Docker および Docker Compose をインストールする。
2. 以下を記述したファイル`local.settings.json`を QuestionAnswerTranslator リポジトリの functions ディレクトリ配下に保存する。
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "COGNITIVE_KEY": "(Azureリソース環境構築時にデプロイしたqatranslator-je-cognitiveのキー値)",
       "COSMOSDB_URI": "https://localcosmosdb:8081",
       "COSMOSDB_KEY": "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
       "COSMOSDB_READONLY_KEY": "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
       "DEEPL_AUTH_KEY": "(Azureリソース環境構築時にGitHubへ登録したシークレットDEEPL_AUTH_KEYの値)",
       "FUNCTIONS_WORKER_RUNTIME": "node"
     },
     "Host": {
       "LocalHttpPort": 9229,
       "CORS": "http://localhost:3000"
     },
     "ConnectionStrings": {}
   }
   ```
3. ターミナルを起動して以下のコマンドを実行し、Docker Compose で Azure Functions・Cosmos DB を起動する。実行したターミナルはそのまま放置する。
   ```bash
   npm run local:create
   ```
   実行後、docker Compose で実行した localfunctions の標準出力が、以下のように表示されるまで待機する。
   ```
   localcosmosdb     | Starting
   localcosmosdb     | Started 1/4 partitions
   localcosmosdb     | Started 2/4 partitions
   localcosmosdb     | Started 3/4 partitions
   localcosmosdb     | Started 4/4 partitions
   localcosmosdb     | Started
   ```
   なお、以前上記コマンドを実行したことがあり、`questionanswertranslator_localreact`および`questionanswertranslator_localfunctions`の Docker イメージが残ったままである場合は再ビルドせず、残った Docker イメージに対してそのまま Docker Compose で起動する。
4. 3 とは別のターミナルで以下のコマンドを実行し、起動した Cosmos DB サーバーに対し、インポートデータファイルからインポートする(タイムアウトなどで失敗した場合、もう一度実行し直すこと)。
   ```bash
   npm run local:cosmosdbImport
   ```

### 関数アプリアップデート手順

localhost 環境構築後、関数アプリを再ビルドして localhost 環境にデプロイしたい場合、ターミナルを起動し以下を実行する。

```bash
npm run local:functionsUpdate
```

### 削除手順

ターミナルを起動し以下を実行すると、localhost 環境を削除できる。

```bash
npm run local:destroy
```

なお、localhost 環境構築時にビルドした Docker イメージを削除したい場合は、ターミナルを起動し以下を実行すればよい。

```bash
docker image rm questionanswertranslator_localfunctions
```

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
