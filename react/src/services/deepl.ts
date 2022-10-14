import axios, { AxiosResponse } from "axios";
import { stringify } from "qs";
import { DeepLResponse, Translation } from "../types/deepl";
import { Sentence } from "../types/functions";

/**
 * DeepL翻訳エラー発生時のエラーメッセージ
 */
export const NOT_TRANSLATION_MSG = "翻訳できませんでした";

/**
 * 指定した英語の文字列群を、DeepL翻訳でそれぞれ日本語に翻訳する
 * @param {Sentence[]} sentences 翻訳エスケープフラグを含んだ英語の文字列群
 * @returns {Promise<string[]>} 日本語(翻訳エスケープONの場合は英語)の文字列群
 */
export const translate = async (sentences: Sentence[]): Promise<string[]> => {
  const auth_key = process.env["REACT_APP_DEEPL_AUTH_KEY"];
  if (!auth_key) {
    throw new Error("Unset REACT_APP_DEEPL_AUTH_KEY");
  }

  // 画像URL以外or翻訳エスケープOFFの場合のみ翻訳
  let translatedSentences: string[];
  const text: string[] = sentences.reduce(
    (prevText: string[], sentence: Sentence) => {
      if (!sentence.isIndicatedImg && !sentence.isEscapedTranslation) {
        prevText.push(sentence.sentence);
      }
      return prevText;
    },
    []
  );
  if (text.length) {
    const res: AxiosResponse<DeepLResponse, any> =
      await axios.get<DeepLResponse>(
        "https://api-free.deepl.com/v2/translate",
        {
          params: {
            auth_key,
            text,
            source_lang: "EN",
            target_lang: "JA",
            split_sentences: "0",
          },
          paramsSerializer: (params) =>
            stringify(params, { arrayFormat: "repeat" }),
        }
      );
    translatedSentences = res.data.translations.map(
      (translation: Translation) => translation.text
    );
  } else {
    translatedSentences = [];
  }

  // 画像URLor翻訳エスケープONの場合は、そのまま英語の文字列を返す
  // 翻訳エスケープOFFの場合は、翻訳した日本語の文字列を返す
  return sentences.map((sentence: Sentence) => {
    const translatedSentence: string | undefined =
      sentence.isIndicatedImg || sentence.isEscapedTranslation
        ? sentence.sentence
        : translatedSentences.shift();

    // 内部矛盾エラーチェック
    if (!translatedSentence) throw new Error("Invalid sentences");

    return translatedSentence;
  });
};
