import { FC, memo } from "react";
import { translate } from "../services/translation";
import { TestTranslationErrorContentProps } from "../types/props";

export const TestTranslationErrorContent: FC<TestTranslationErrorContentProps> =
  memo((props: TestTranslationErrorContentProps) => {
    const { sentences, setTranslatedSentences, setIsNotTranslatedSentences } =
      props;

    const retryTranslation = async () => {
      setIsNotTranslatedSentences(false);
      setTranslatedSentences([]);

      try {
        const translatedSentences: string[] = await translate(sentences);
        setTranslatedSentences(translatedSentences);
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
