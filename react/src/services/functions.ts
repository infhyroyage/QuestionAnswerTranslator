import {
  AccountInfo,
  AuthenticationResult,
  InteractionRequiredAuthError,
  IPublicClientApplication,
} from "@azure/msal-browser";
import axios, { AxiosRequestHeaders } from "axios";
import { Method } from "../../../types/functions";
import { functionsScopes } from "./msal";

/**
 * HTTPトリガーのAzure Functionsへアクセスする
 * @param {Method} method アクセスするFunctionsへのHTTPメソッドタイプ
 * @param {string} path アクセスするFunctionsへのパス
 * @param {IPublicClientApplication} instance MSALインスタンス
 * @param {AccountInfo | null} accountInfo ログイン済のアカウント情報
 * @returns {Promise<T>} Functionsアクセス時のレスポンス
 */
export const accessFunctions = async <T>(
  method: Method,
  path: string,
  instance: IPublicClientApplication,
  accountInfo: AccountInfo | null
): Promise<T> => {
  const apiUrl = process.env["REACT_APP_API_URL"];
  if (!apiUrl) {
    throw new Error("Unset REACT_APP_API_URL");
  }

  // localhost環境
  if (apiUrl === "http://localhost:9229") {
    return await callByAxios<T>(method, path);
  }

  // 非localhost環境 & ログイン済
  const account = accountInfo === null ? undefined : accountInfo;

  try {
    const msalRes: AuthenticationResult = await instance.acquireTokenSilent({
      scopes: functionsScopes.accessAsUser,
      account,
    });
    return await callByAxios<T>(method, path, msalRes.accessToken);
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      try {
        const msalRes: AuthenticationResult = await instance.acquireTokenPopup({
          scopes: functionsScopes.accessAsUser,
        });
        return await callByAxios<T>(method, path, msalRes.accessToken);
      } catch (e) {
        throw e;
      }
    } else {
      throw err;
    }
  }
};

/**
 * axiosを用いて、HTTPトリガーのAzure Functionsにコールしたレスポンスをそのまま返す
 * @param {Method} method アクセスするFunctionsへのHTTPメソッドタイプ
 * @param {string} path アクセスするFunctionsへのパス
 * @param {string | undefined} accessToken MSALで発行したアクセストークン
 * @returns {Promise<T>} レスポンス
 */
const callByAxios = async <T>(
  method: Method,
  path: string,
  accessToken?: string | undefined
): Promise<T> => {
  try {
    const apiUrl = process.env["REACT_APP_API_URL"];
    if (!apiUrl) {
      throw new Error("Unset REACT_APP_API_URL");
    }

    // ヘッダー作成
    const headers: AxiosRequestHeaders = {};
    if (apiUrl !== "http://localhost:9229") {
      // 非localhost環境のみ、アクセストークンと、API Managementのサブスクリプションキーをヘッダーに追加
      if (!accessToken) {
        throw new Error("Unset accessToken");
      }
      headers["X-Access-Token"] = accessToken;

      const subscriptionKey =
        process.env["REACT_APP_API_MANAGEMENT_SUBSCRIPTION_KEY"];
      if (!subscriptionKey) {
        throw new Error("Unset REACT_APP_API_MANAGEMENT_SUBSCRIPTION_KEY");
      }
      headers["Ocp-Apim-Subscription-Key"] = subscriptionKey;
    }

    // axios実行
    let res;
    switch (method) {
      case "GET":
        res = await axios.get<T>(`${apiUrl}/api${path}`, { headers });
        break;
      default:
        throw new Error(`Invalid method type: ${method}`);
    }
    if (res.status !== 200) {
      throw new Error(res.statusText);
    }

    return res.data;
  } catch (e) {
    throw e;
  }
};
