# QuestionAnswerTranslator

## Azure リソースアーキテクチャー図

![architecture.drawio](architecture.drawio.svg)

| リソース名                       | 概要                                                                       | workflow での CI/CD |
| -------------------------------- | -------------------------------------------------------------------------- | :-----------------: |
| `qatranslator-je-appservice`     | ユーザーからアクセスする App Service                                       |          o          |
| `qatranslator-je-appserviceplan` | App Service のプラン                                                       |                     |
| `qatranslator-je-apim`           | ユーザー/App Service からアクセスする API Management                       |          o          |
| `qatranslator-je-func`           | API Management からアクセスする Functions                                  |          o          |
| `qatranslator-je-funcplan`       | Functions のプラン                                                         |                     |
| `qatranslatorjesa`               | Functions から参照するストレージアカウント                                 |                     |
| `qatranslator-je-cosmosdb`       | Functions からアクセスする Cosmos DB                                       |                     |
| `qatranslator-je-insights`       | App Service/API Management/Functions を一括で監視する Application Insights |                     |
| `qatranslator-je-ws`             | Application Insights を分析する Workspaces                                 |                     |
| `qatranslator-je-vault`          | 暗号鍵/シークレットを管理する Key Vault                                    |                     |

## 使用するバージョン

| 名称       | バージョン |
| ---------- | ---------- |
| Node.js    | 16.17.0    |
| React      | 18.2.0     |
| Typescript | 10.9.1     |

## 初期構築

Azure リソース/localhost に環境を構築する事前準備として、以下の順で初期構築を必ずすべて行う必要がある。

1. サービスプリンシパルの作成
2. Azure AD へのアプリケーションの登録
3. QuestionAnswerTranslator リポジトリのシークレット設定
4. 手動インポート用 JSON の作成

### 1. サービスプリンシパルの発行

Azure CLI にてログイン後、以下のコマンドを実行し、サービスプリンシパル`QATranslator_Contributor`を発行する。

```bash
az ad sp create-for-rbac --name "QATranslator_Contributor" --role "Contributor" --scope /subscriptions/{サブスクリプションID} --sdk-auth
```

実行して得た JSON のレスポンスのクライアント ID(`clientId`)およびクライアントシークレット`clientSecret`の値を、それぞれ手元に控える。

### 2. Azure AD へのアプリケーションの登録

MSAL を用いて Azure AD で認証認可を行うべく、Azure Portal > Azure AD から以下の手順で Azure AD にアプリケーションを登録する。

1. App Registrations > New registration の順で押下し、以下の項目を入力後、Register ボタンを押下する。
   - Name : `QATranslator_MSAL`
   - Supported account types : `Accounts in this organizational directory only`
   - Redirect URI : `Single-page application(SPA)`(左) と `http://localhost:3000`(右)
2. QATranslator_MSAL の App Registration ブレードに遷移し、概要にある `Application (client) ID`の UUID を手元に控える。
3. Authentication > Single-page application にある 「Add URI」を押下して、Redirect URIs にあるリストに`https://qatranslator-je-appservice.azurewebsites.net`を追加し、Save ボタンを押下する。
4. Expose an API > Application ID URI の右にある小さな文字「Set」を押下し、Application ID URI の入力欄に`api://{2で手元に控えたUUID}`が反映されていることを確認し、Save ボタンを押下する。
5. Expose an API > Scopes defined by this API にある「Add a scope」を押下し、以下の項目を入力後、Save ボタンを押下する。
   - Scope name : `access_as_user`
   - Who can consent? : `Admins and users`
   - Admin consent display name : `QATranslator`
   - Admin consent description : `Allow react app to access QATranslator backend as the signed-in user`
   - User consent display name :`QATranslator`
   - User consent description : `Allow react app to access QATranslator backend on your behalf`
   - State : `Enabled`
6. API permissions > Configured permissions の API / Permissions name に、Microsoft Graph API である User.Read が既に許可されていることを確認し、「Add a permission」ボタン押下後、以下の順で操作する。
   - 「My APIs」の`QATranslator_MSAL`を選択。
   - Delegated permissions セクションで,`QATranslator`の`access_as_user`スコープを選択。
   - Add permissions ボタンを押下。
7. Manifest ブレードから JSON 形式のマニフェストを表示し、`"accessTokenAcceptedVersion"`の値を`null`から`2`に変更する。

### 3. QuestionAnswerTranslator リポジトリのシークレット設定

[GitHub の QuestionAnswerTranslator リポジトリのページ](https://github.com/infhyroyage/QuestionAnswerTranslator)にある Setting > Secrets > Actions より、以下のシークレットをすべて設定する。

| シークレット名                        | シークレット値                                                            |
| ------------------------------------- | ------------------------------------------------------------------------- |
| AZURE_AD_GLOBAL_ADMIN_EMAIL           | API Management の発行者メールアドレス                                     |
| AZURE_AD_GLOBAL_ADMIN_OBJECT_ID       | ディレクトリの Azure AD のグローバル管理者のオブジェクト ID               |
| AZURE_AD_SP_CONTRIBUTOR_CLIENT_ID     | 1.で発行した Contributor のサービスプリンシパルのクライアント ID          |
| AZURE_AD_SP_CONTRIBUTOR_CLIENT_SECRET | 1.で発行した Contributor のサービスプリンシパルのクライアントシークレット |
| AZURE_AD_SP_CONTRIBUTOR_OBJECT_ID     | 1.で発行した Contributor のサービスプリンシパルのオブジェクト ID          |
| AZURE_AD_SP_MSAL_CLIENT_ID            | 2.で Azure AD に登録したアプリケーションのクライアント ID                 |
| AZURE_SUBSCRIPTION_ID                 | サブスクリプション ID                                                     |
| AZURE_TENANT_ID                       | ディレクトリ ID                                                           |
| DEEPL_AUTH_KEY                        | DeepL API の認証キー                                                      |
| GHCR_PAT_READ_PACKAGES                | read:packages を許可した GitHub の Personal Access Tokens                 |

### 4. 手動インポート用 JSON の作成

Cosmos DB に保存する文字列を、そのまま GitHub 上に管理するべきではないセキュリティ上の理由から、そのような文字列すべては JSON ファイル(以下、**手動インポート用 JSON**と呼ぶ)としてローカル管理する運用としている。
手動インポート用 JSON は manualImport.json というファイル名で Azure リソース/localhost 環境構築前に用意しておく必要があり、ローカルで git clone した QuestionAnswerTranslator リポジトリの cosmosdb/data 配下に配置する。
手動インポート用 JSON のフォーマットを以下に示す。

```
{
  "コース名1": {
    "テスト名1": [
      {
        "number": 1, // 問題番号(1スタート)
        "subjects": ["問題文1", "https://xxx.com/yyy/zzz.png", "問題文2", ... ], // 問題文または画像URL
        "choices": ["選択肢1", "選択肢2", ... ], // 選択肢
        "correctIdxes": [0], // 回答の選択肢のインデックス(複数回答の場合は複数指定)
        "explanations": ["解説文1", "解説文2", ... ], // 解説文
        "incorrectChoicesExplanations": [null, ["選択肢2の解説文1", "選択肢2の解説文2", ... ], ... ], // 不正解の選択肢の解説文(正解の選択肢はnull、省略可能)
        "indicateImgIdxes": { // 画像URLのインデックス(省略可能)
          "subjects": [0, ... ],
          "explanations": [2, ... ]
        },
        "escapeTranslatedIdxes": { // 翻訳不必要な文字列のインデックス(省略可能)
          "subjects": [0, ... ],
          "choices": [1, ... ],
          "explanations": [2, ... ],
          "incorrectChoicesExplanations": [null, [0, ... ], ... ] // 正解の選択肢はnull
        },
        "references": ["https://xxx.com/yyy/zzz.html", ... ] // 解説URL(省略可能)
      },
      {
        "number": 2,
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
3. 以下のコマンドを実行して、Azure にデプロイ済の Cosmos DB に対し、手動インポート用のデータをインポートする(タイムアウトなどで失敗した場合、もう一度実行し直すこと)。
   ```bash
   npm run cosmosdb:manual
   ```

### 削除手順

1. QuestionAnswerTranslator リポジトリの各 workflow をすべて無効化する。
2. Azure Portal からリソースグループ`qatranslator-je`を削除する。
3. Azure Portal から Key Vault > Manage deleted vaults > サブスクリプション > qatranslator-je-vault の順で押下し、Purge ボタンを押下して、論理的に削除した Key Vault を物理的に削除する。
4. 以下の Azure CLI の実行後に正常復帰することを確認し、論理的に削除した API Management を物理的に削除する。
   ```bash
   az rest -m DELETE -u https://management.azure.com/subscriptions/(サブスクリプションID)/providers/Microsoft.ApiManagement/locations/japaneast/deletedservices/qatranslator-je-apim?api-version=2021-08-01
   ```

## API 追加時の対応

### 関数アプリ

functions 配下に cd し、以下のファイルを持つ関数アプリのプロジェクトディレクトリを生成する。

- function.json
- index.ts

### API Management

上記で生成した関数アプリが HTTP Trigger の場合は、apim/swagger.yaml にその関数アプリの Swagger を記述する。

## localhost 環境構築

Azure にリソースを構築せず、Azure Functions(HTTP Trigger の関数アプリのみ)・Cosmos DB・React サーバーを localhost 上で構築することもできる。
Azure Functions は[Azure Functions Core Tools](https://docs.microsoft.com/ja-jp/azure/azure-functions/functions-run-local)、Cosmos DB は[Azure Cosmos DB Linux Emulator](https://docs.microsoft.com/ja-jp/azure/cosmos-db/local-emulator)を Docker Compose で起動することによって実現する。
localhost 環境で使用する Azure Functions・Cosmos DB・React サーバーのポートは、それぞれ 9229・9230・3000 である。
localhost 環境構築後、 [Azure Cosmos DB Emulator の index](https://localhost:9230/_explorer/index.html) にアクセスすると、DB 内のデータをプレビューすることができる。

### 構築手順

1. Docker および Docker Compose をインストールする。
2. 以下を記述したファイル`.env.local`を QuestionAnswerTranslator リポジトリの react ディレクトリ配下に保存する。
   ```
   REACT_APP_AZURE_AD_SP_MSAL_CLIENT_ID=(初期構築時にGitHubへ登録したシークレットAZURE_AD_SP_MSAL_CLIENT_IDの値)
   REACT_APP_AZURE_TENANT_ID=(初期構築時にGitHubへ登録したシークレットAZURE_TENANT_IDの値)
   REACT_APP_DEEPL_AUTH_KEY=(初期構築時にGitHubへ登録したシークレットDEEPL_AUTH_KEYの値)
   ```
3. ターミナルを起動して以下を実行し、Docker Compose で Azure Functions・Cosmos DB・React サーバーを起動する。実行したターミナルはそのまま放置する。
   ```bash
   npm run local:create
   ```
   実行後、docker Compose で実行した localfunctions の標準出力が、以下のように表示されるまで待機する。
   ```
   localfunctions    |
   localfunctions    | Functions:
   localfunctions    |
   localfunctions    |     healthcheck: [GET] http://localhost:9229/api/healthcheck
   localfunctions    |
   (略)
   localfunctions    |
   localfunctions    | For detailed output, run func with --verbose flag.
   localfunctions    | [略] Worker process started and initialized.
   localfunctions    | [略] Host lock lease acquired by instance ID '(略)'.
   ```
   なお、以前上記コマンドを実行したことがあり、`questionanswertranslator_localreact`および`questionanswertranslator_localfunctions`の Docker イメージが残ったままである場合は再ビルドせず、残った Docker イメージに対してそのまま Docker Compose で起動する。
4. 3 とは別のターミナルで、以下のコマンドを実行する(タイムアウトなどで失敗した場合、もう一度実行し直すこと)。
   ```bash
   npm run local:cosmosdbInit
   ```

### React サーバーアップデート手順

localhost 環境構築後、React サーバーを再ビルドして localhost 環境にデプロイしたい場合、ターミナルを起動し以下を実行する。

```bash
npm run local:reactUpdate
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
docker image rm questionanswertranslator_localfunctions questionanswertranslator_localreact
```

## 完全初期化

初期構築以前の完全なクリーンな状態に戻すためには、初期構築時に Azure AD へ登録したサービスプリンシパル/アプリケーション、および、QuestionAnswerTranslator リポジトリのシークレットを削除すれば良い。
サービスプリンシパル/アプリケーションの削除については、Azure Portal から Azure AD > App Registrations に遷移し、以下のサービスプリンシパル/アプリケーションのリンク先にある Overview ブレードの Delete ボタンを押下し、`I understand the implications of deleting this app registration.`のチェックを入れて Delete ボタンを押下する。

- QATranslator_Contributor
- QATranslator_MSAL

QuestionAnswerTranslator リポジトリのシークレットの削除については、[GitHub の QuestionAnswerTranslator リポジトリのページ](https://github.com/infhyroyage/QuestionAnswerTranslator)にある Setting > Secrets > Actions より、登録した各シークレットの Remove ボタンを押下する。
