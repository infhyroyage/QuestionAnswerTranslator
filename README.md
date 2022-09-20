# QuestionAnswerTranslator

## Azure リソースアーキテクチャー図

準備中

| リソース名                 | 概要                                                                       | workflow での CI/CD |
| -------------------------- | -------------------------------------------------------------------------- | :-----------------: |
| `qatranslator-je-apim`     | App Service/localhost からアクセスする API Management                      |          o          |
| `qatranslator-je-func`     | API Management からアクセスする Functions                                  |          o          |
| `qatranslator-je-funcplan` | Functions のプラン                                                         |                     |
| `qatranslatorjesa`         | Functions から参照するストレージアカウント                                 |                     |
| `qatranslator-je-cosmosdb` | Functions からアクセスする Cosmos DB                                       |                     |
| `qatranslator-je-insights` | App Service/API Management/Functions を一括で監視する Application Insights |                     |
| `qatranslator-je-ws`       | Application Insights を分析する Workspaces                                 |                     |
| `qatranslator-je-vault`    | 暗号鍵/シークレットを管理する Key Vault                                    |                     |

## 使用するバージョン

| 名称    | バージョン |
| ------- | ---------- |
| Node.js | 16.17.0    |

## 初期構築

Azure リソース/localhost に環境を構築する事前準備として、以下の順で初期構築を必ずすべて行う必要がある。

1. サービスプリンシパルの作成
2. Azure AD へのアプリケーションの登録
3. QuestionAnswerTranslator リポジトリのシークレット設定

### 1. サービスプリンシパルの発行

Azure CLI にてログイン後、以下のコマンドをそれぞれ実行し、Contributor(Azure リソースの作成を担当)、および、User Access Administrator(Role の設定を担当)のサービスプリンシパルをそれぞれ発行する。

```bash
az ad sp create-for-rbac --name "QATranslator_Contributor" --role "Contributor" --scope /subscriptions/{サブスクリプションID} --sdk-auth
az ad sp create-for-rbac --name "QATranslator_UserAccessAdministrator" --role "User Access Administrator" --scope /subscriptions/{サブスクリプションID} --sdk-auth
```

それぞれ実行して得た JSON のレスポンスのクライアント ID(`clientId`)およびクライアントシークレット`clientSecret`の値を、それぞれ手元に控える。

### 2. Azure AD へのアプリケーションの登録

MSAL を用いて Azure AD で認証認可を行うべく、Azure Portal > Azure AD から以下の手順で Azure AD にアプリケーションを登録する。

1. App Registrations > New registration の順で押下し、以下の項目を入力後、Register ボタンを押下する。
   - Name : `QATranslator_MSAL`
   - Supported account types : `Accounts in this organizational directory only`
   - Redirect URI : `Single-page application(SPA)`(左) と `http://localhost:3000`(右)
2. QATranslator_MSAL の App Registration ブレードに遷移し、概要にある `Application (client) ID`の UUID を手元に控える。
3. Authentication > Single-page application にある 「Add URI」を押下して、Redirect URIs にあるリストに`https://qatranslator-je-app.azurewebsites.net`を追加し、Save ボタンを押下する。
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

| シークレット名                                   | シークレット値                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| AZURE_SUBSCRIPTION_ID                            | サブスクリプション ID                                                                   |
| AZURE_TENANT_ID                                  | ディレクトリ ID                                                                         |
| AZURE_AD_CONTRIBUTOR_CLIENT_ID                   | 1.で発行した Contributor のサービスプリンシパルのクライアント ID                        |
| AZURE_AD_CONTRIBUTOR_CLIENT_SECRET               | 1.で発行した Contributor のサービスプリンシパルのクライアントシークレット               |
| AZURE_AD_USER_ACCESS_ADMINISTRATOR_CLIENT_ID     | 1.で発行した User Access Administrator のサービスプリンシパルのクライアント ID          |
| AZURE_AD_USER_ACCESS_ADMINISTRATOR_CLIENT_SECRET | 1.で発行した User Access Administrator のサービスプリンシパルのクライアントシークレット |
| AZURE_AD_SP_MSAL_CLIENT_ID                       | 2.で Azure AD に登録したアプリケーションのクライアント ID                               |
| AZURE_AD_GLOBAL_ADMIN_EMAIL                      | API Management の発行者メールアドレス                                                   |
| AZURE_AD_GLOBAL_ADMIN_OBJECT_ID                  | ディレクトリの Azure AD のグローバル管理者のオブジェクト ID                             |

## Azure リソース構築手順

1. 以下の順で workflow を手動で実行する。
   1. Create Azure Resources

## Azure リソース削除手順

1. Azure Portal からリソースグループ`qatranslator-je`を削除する。
2. Azure Portal から Key Vault > Manage deleted vaults > サブスクリプション > qatranslator-je-vault の順で押下し、Purge ボタンを押下して、論理的に削除した Key Vault を物理的に削除する。
3. 以下の Azure CLI の実行後に正常復帰することを確認し、論理的に削除した API Management を物理的に削除する。
   ```bash
   az rest -m DELETE -u https://management.azure.com/subscriptions/(サブスクリプションID)/providers/Microsoft.ApiManagement/locations/japaneast/deletedservices/qatranslator-je-apim?api-version=2021-08-01
   ```

## 完全初期化

初期構築以前の完全なクリーンな状態に戻すためには、初期構築時に Azure AD へ登録したサービスプリンシパル/アプリケーション、および、QuestionAnswerTranslator リポジトリのシークレットを削除すれば良い。
サービスプリンシパル/アプリケーションの削除については、Azure Portal から Azure AD > App Registrations に遷移し、以下のサービスプリンシパル/アプリケーションのリンク先にある Overview ブレードの Delete ボタンを押下し、`I understand the implications of deleting this app registration.`のチェックを入れて Delete ボタンを押下する。

- QATranslator_Contributor
- QATranslator_MSAL
- QATranslator_UserAccessAdministrator

QuestionAnswerTranslator リポジトリのシークレットの削除については、[GitHub の QuestionAnswerTranslator リポジトリのページ](https://github.com/infhyroyage/QuestionAnswerTranslator)にある Setting > Secrets > Actions より、登録した各シークレットの Remove ボタンを押下する。
