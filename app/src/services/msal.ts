/**
 * MSALプロバイダー使用時のコンフィグ
 */
export const config = {
  auth: {
    clientId: `${process.env["REACT_APP_AZURE_AD_APP_CLIENT_ID"]}`,
    authority: `https://login.microsoftonline.com/${process.env["REACT_APP_AZURE_AD_APP_TENANT_ID"]}`,
    // ログイン後のリダイレクト先
    redirectUri: `${process.env["REACT_APP_AZURE_AD_APP_REDIRECT_URI"]}`,
    // ログアウト後のリダイレクト先
    postLogoutRedirectUri: `${process.env["REACT_APP_AZURE_AD_APP_REDIRECT_URI"]}`,
  },
  cache: {
    // アクセストークンの格納先
    cacheLocation: "sessionStorage",
    // IE11/Edgeでの動作で問題が発生する場合のみtrueに設定
    storeAuthStateInCookie: false,
  },
};

/**
 * ログイン時の認証のスコープ
 */
export const loginScope = {
  scopes: [],
};

/**
 * HTTPトリガーのAzure Functionsで構成したREST APIアクセスのスコープ
 */
export const functionsScopes = {
  accessAsUser: [
    `api://${process.env["REACT_APP_AZURE_AD_APP_CLIENT_ID"]}/access_as_user`,
  ],
};
