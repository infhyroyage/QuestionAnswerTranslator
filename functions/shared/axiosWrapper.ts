import axios, { AxiosResponse } from "axios";
import { stringify } from "qs";
import {
  CognitiveResponse,
  CognitiveTranslation,
  DeepLResponse,
  DeepLTranslation,
} from "../../types/translation";

const DEEPL_URL: string = "https://api-free.deepl.com/v2/translate";
const COGNITIVE_URL: string =
  "https://api.cognitive.microsofttranslator.com/translate";

/**
 * 指定した英語の文字列群をDeepL翻訳でそれぞれ日本語に翻訳する
 * @param {string[]} texts 英語の文字列群
 * @returns {Promise<string[] | undefined>} 日本語に翻訳した文字列群(文字列上限に達した場合はundefined)
 * @throws 文字列上限以外のエラーがスローされた場合
 */
export const translateByDeepL = async (
  texts: string[]
): Promise<string[] | undefined> => {
  if (texts.length === 0) return [];

  const auth_key: string | undefined = process.env["DEEPL_AUTH_KEY"];
  if (!auth_key) {
    throw new Error("Unset DEEPL_AUTH_KEY");
  }

  try {
    const res: AxiosResponse<DeepLResponse, any> =
      await axios.get<DeepLResponse>(DEEPL_URL, {
        params: {
          auth_key,
          text: texts,
          source_lang: "EN",
          target_lang: "JA",
          split_sentences: "0",
        },
        paramsSerializer: (params) =>
          stringify(params, { arrayFormat: "repeat" }),
      });
    return res.data.translations.map(
      (deepLTranslation: DeepLTranslation) => deepLTranslation.text
    );
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response &&
      error.response.status === 456
    ) {
      // DeepL無料枠の上限500000文字を超過した場合は456エラーとなる
      return undefined;
    } else {
      throw error;
    }
  }
};

/**
 * 指定した英語の文字列群をAzure Translatorでそれぞれ日本語に翻訳する
 * @param {string[]} texts 英語の文字列群
 * @returns {Promise<string[]>} 画像URLフラグ、翻訳エスケープフラグが共にOFFの場合のみ日本語に翻訳した文字列群
 * @throws エラーがスローされた場合
 */
export const translateByCognitive = async (
  texts: string[]
): Promise<string[]> => {
  if (texts.length === 0) return [];

  const cognitiveKey: string | undefined = process.env["COGNITIVE_KEY"];
  if (!cognitiveKey) {
    throw new Error("Unset COGNITIVE_KEY");
  }

  const cognitiveRes: AxiosResponse<CognitiveResponse, any> = await axios.post<
    CognitiveResponse,
    AxiosResponse<CognitiveResponse>,
    { Text: string }[]
  >(
    COGNITIVE_URL,
    texts.map((text: string) => {
      return { Text: text };
    }),
    {
      headers: {
        "Ocp-Apim-Subscription-Key": cognitiveKey,
        "Ocp-Apim-Subscription-Region": "japaneast",
        "Content-Type": "application/json",
      },
      params: {
        "api-version": "3.0",
        from: "en",
        to: ["ja"],
      },
      responseType: "json",
    }
  );
  return cognitiveRes.data.map(
    (cognitiveTranslation: CognitiveTranslation) =>
      cognitiveTranslation.translations[0].text
  );
};
