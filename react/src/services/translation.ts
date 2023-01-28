import axios, { AxiosResponse } from "axios";
import { stringify } from "qs";
import {
  CognitiveResponse,
  CognitiveTranslation,
  DeepLResponse,
  DeepLTranslation,
} from "../../translation";
import { Sentence } from "../../../types/functions";

/**
 * 翻訳エラー発生時のエラーメッセージ
 */
export const NOT_TRANSLATION_MSG = "翻訳できませんでした";

/**
 * 指定した英語の文字列群をDeepL翻訳でそれぞれ日本語に翻訳する
 * @param {Sentence[]} sentences 画像URLフラグ/翻訳エスケープフラグを含んだ英語の文字列群
 * @returns {Promise<string[] | undefined>} 画像URLフラグ、翻訳エスケープフラグが共にOFFの場合のみ日本語に翻訳した文字列群、文字列上限に達した場合はundefined
 */
export const translateByDeepL = async (
  sentences: Sentence[]
): Promise<string[] | undefined> => {
  const auth_key = process.env["REACT_APP_DEEPL_AUTH_KEY"];
  if (!auth_key) {
    throw new Error("Unset REACT_APP_DEEPL_AUTH_KEY");
  }

  // 画像URLではない、かつ、翻訳エスケープOFFの場合のみ翻訳対象
  const text: string[] = sentences.reduce(
    (prevText: string[], sentence: Sentence) => {
      if (!sentence.isIndicatedImg && !sentence.isEscapedTranslation) {
        prevText.push(sentence.sentence);
      }
      return prevText;
    },
    []
  );

  let translatedTexts: string[] = [];
  if (text.length) {
    try {
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
      translatedTexts = res.data.translations.map(
        (deepLTranslation: DeepLTranslation) => deepLTranslation.text
      );
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response &&
        error.response.status === 456
      ) {
        // DeepL無料枠の上限500000文字を超過した場合は456エラーとなるため、Azure Translatorで翻訳するよう切替え
        return undefined;
      } else {
        throw error;
      }
    }
  }

  // 画像URLor翻訳エスケープONの場合は、そのまま英語の文字列を返す
  // 翻訳エスケープOFFの場合は、翻訳した日本語の文字列を返す
  return sentences.map((sentence: Sentence) => {
    const translatedSentence: string | undefined =
      sentence.isIndicatedImg || sentence.isEscapedTranslation
        ? sentence.sentence
        : translatedTexts.shift();

    // 内部矛盾エラーチェック
    if (!translatedSentence) throw new Error("Invalid sentences");

    return translatedSentence;
  });
};

/**
 * 指定した英語の文字列群をAzure Translatorでそれぞれ日本語に翻訳する
 * @param {Sentence[]} sentences 画像URLフラグ/翻訳エスケープフラグを含んだ英語の文字列群
 * @returns {Promise<string[]>} 画像URLフラグ、翻訳エスケープフラグが共にOFFの場合のみ日本語に翻訳した文字列群
 */
export const translateByCognitive = async (
  sentences: Sentence[]
): Promise<string[]> => {
  const cognitiveKey = process.env["REACT_APP_AZURE_COGNITIVE_KEY"];
  if (!cognitiveKey) {
    throw new Error("Unset REACT_APP_AZURE_COGNITIVE_KEY");
  }

  // 画像URLではない、かつ、翻訳エスケープOFFの場合のみ翻訳対象
  const data: { Text: string }[] = sentences.reduce(
    (prevText: { Text: string }[], sentence: Sentence) => {
      if (!sentence.isIndicatedImg && !sentence.isEscapedTranslation) {
        prevText.push({ Text: sentence.sentence });
      }
      return prevText;
    },
    []
  );

  let translatedTexts: string[] = [];
  if (data.length) {
    const cognitiveRes: AxiosResponse<CognitiveResponse, any> =
      await axios.post<CognitiveResponse>(
        "https://api.cognitive.microsofttranslator.com/translate",
        data,
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
    translatedTexts = cognitiveRes.data.map(
      (cognitiveTranslation: CognitiveTranslation) =>
        cognitiveTranslation.translations[0].text
    );
  }

  // 画像URLor翻訳エスケープONの場合は、そのまま英語の文字列を返す
  // 翻訳エスケープOFFの場合は、翻訳した日本語の文字列を返す
  return sentences.map((sentence: Sentence) => {
    const translatedSentence: string | undefined =
      sentence.isIndicatedImg || sentence.isEscapedTranslation
        ? sentence.sentence
        : translatedTexts.shift();

    // 内部矛盾エラーチェック
    if (!translatedSentence) throw new Error("Invalid sentences");

    return translatedSentence;
  });
};
