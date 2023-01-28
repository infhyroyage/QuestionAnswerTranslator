import { FC, memo } from "react";
import { useRecoilState } from "recoil";
import {
  translateByCognitive,
  translateByDeepL,
} from "../services/translation";
import { translation } from "../store/translation";
import { TestTranslationErrorContentProps } from "../../../types/props";

export const TestTranslationErrorContent: FC<TestTranslationErrorContentProps> =
  memo((props: TestTranslationErrorContentProps) => {
    const [translatedState, setTranslatedState] = useRecoilState(translation);

    const { sentences, setTranslatedSentences, setIsNotTranslatedSentences } =
      props;

    const retryTranslation = async () => {
      setIsNotTranslatedSentences(false);
      setTranslatedSentences([]);

      let translationsByDeepL: string[] | undefined;
      let translationsByCognitive: string[];
      try {
        if (translatedState.isTranslatedByAzureCognitive) {
          translationsByCognitive = await translateByCognitive(sentences);
          setTranslatedSentences(translationsByCognitive);
        } else {
          translationsByDeepL = await translateByDeepL(sentences);
          if (translationsByDeepL === undefined) {
            translationsByCognitive = await translateByCognitive(sentences);
            setTranslatedSentences(translationsByCognitive);
            setTranslatedState({
              isTranslatedByAzureCognitive: true,
            });
          } else {
            setTranslatedSentences(translationsByDeepL);
          }
        }
      } catch (e) {
        setTranslatedSentences(undefined);
        setIsNotTranslatedSentences(true);
      }
    };

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "7px",
          marginBottom: "7px",
        }}
      >
        <p style={{ width: "calc(100% - 200px)", color: "red" }}>
          DeepLとの通信エラーにより翻訳エラーが発生しました
        </p>
        <button onClick={retryTranslation} style={{ width: "120px" }}>
          翻訳リトライ
        </button>
      </div>
    );
  });
