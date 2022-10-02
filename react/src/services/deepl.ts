import axios from "axios";
import { stringify } from "qs";
import { DeepLResponse, Translation } from "../types/deepl";

/**
 * DeepL翻訳エラー発生時のエラーメッセージ
 */
export const NOT_TRANSLATION_MSG = "翻訳できませんでした";

/**
 * 指定した英語の文字列群を、DeepL翻訳でそれぞれ日本語に翻訳する
 * @param {string[]} texts 英語の文字列群
 * @returns {Promise<string[]>} 日本語の文字列群
 */
export const translate = async (texts: string[]): Promise<string[]> => {
  const auth_key = process.env["REACT_APP_DEEPL_AUTH_KEY"];
  if (!auth_key) {
    throw new Error("Unset REACT_APP_DEEPL_AUTH_KEY");
  }

  const res = await axios.get<DeepLResponse>(
    "https://api-free.deepl.com/v2/translate",
    {
      params: {
        auth_key,
        text: texts,
        source_lang: "EN",
        target_lang: "JA",
        split_sentences: "0",
      },
      paramsSerializer: (params) =>
        stringify(params, { arrayFormat: "repeat" }),
    }
  );

  return res.data.translations.map(
    (translation: Translation) => translation.text
  );
};
