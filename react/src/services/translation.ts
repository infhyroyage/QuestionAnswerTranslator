import axios, { AxiosResponse } from "axios";
import { stringify } from "qs";
import {
  CognitiveResponse,
  CognitiveTranslation,
  DeepLResponse,
  DeepLTranslation,
} from "../types/translation";
import { Sentence } from "../types/functions";

/**
 * 翻訳エラー発生時のエラーメッセージ
 */
export const NOT_TRANSLATION_MSG = "翻訳できませんでした";

/**
 * 指定した英語の文字列群を、DeepL翻訳/Azure Translatorでそれぞれ日本語に翻訳する
 * @param {Sentence[]} sentences 翻訳エスケープフラグを含んだ英語の文字列群
 * @returns {Promise<string[]>} 日本語(翻訳エスケープONの場合は英語)の文字列群
 */
export const translate = async (sentences: Sentence[]): Promise<string[]> => {
  // 画像URLではない、かつ、翻訳エスケープOFFの場合のみ翻訳対象
  const texts: string[] = sentences.reduce(
    (prevText: string[], sentence: Sentence) => {
      if (!sentence.isIndicatedImg && !sentence.isEscapedTranslation) {
        prevText.push(sentence.sentence);
      }
      return prevText;
    },
    []
  );

  let translatedTexts: string[] = [];
  if (texts.length) {
    // DeepLで翻訳
    const deepLAuthKey = process.env["REACT_APP_DEEPL_AUTH_KEY"];
    if (!deepLAuthKey) {
      throw new Error("Unset REACT_APP_DEEPL_AUTH_KEY");
    }
    const deepLRes: AxiosResponse<DeepLResponse, any> =
      await axios.get<DeepLResponse>(
        "https://api-free.deepl.com/v2/translate",
        {
          params: {
            auth_key: deepLAuthKey,
            text: texts,
            source_lang: "EN",
            target_lang: "JA",
            split_sentences: "0",
          },
          paramsSerializer: (params) =>
            stringify(params, { arrayFormat: "repeat" }),
        }
      );
    if (deepLRes.status !== 456) {
      translatedTexts = deepLRes.data.translations.map(
        (deepLTranslation: DeepLTranslation) => deepLTranslation.text
      );
    } else {
      // TODO: Custom Hook化してGlobal Stateを用いて切り替え
      // DeepL無料枠の上限500000文字を超過した場合は456エラーとなるため、Azure Translatorで翻訳
      const cognitiveKey = process.env["REACT_APP_AZURE_COGNITIVE_KEY"];
      if (!cognitiveKey) {
        throw new Error("Unset REACT_APP_AZURE_COGNITIVE_KEY");
      }
      const cognitiveRes: AxiosResponse<CognitiveResponse, any> =
        await axios.post<CognitiveResponse>(
          "https://api.cognitive.microsofttranslator.com/translate",
          {
            headers: {
              "Ocp-Apim-Subscription-Key": cognitiveKey,
              "Ocp-Apim-Subscription-Region": "japaneast",
              "Content-type": "application/json",
            },
            params: {
              "api-version": "3.0",
              from: "en",
              to: "ja",
            },
            data: texts.map((text: string) => {
              return { Text: text };
            }),
            responseType: "json",
          }
        );
      translatedTexts = cognitiveRes.data.map(
        (cognitiveTranslation: CognitiveTranslation) =>
          cognitiveTranslation.translations[0].text
      );
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
