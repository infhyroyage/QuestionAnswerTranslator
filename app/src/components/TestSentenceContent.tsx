import { FC, memo } from "react";
import { NOT_TRANSLATION_MSG } from "../services/deepl";
import { TestSentenceContentProps } from "../types/props";

export const TestSentenceContent: FC<TestSentenceContentProps> = memo(
  (props) => {
    const { sentences, translatedSentences } = props;

    return (
      <>
        {sentences.map((subject: string, idx: number) => (
          <div key={idx} style={{ paddingBottom: "7px" }}>
            <p>{subject}</p>
            <p style={{ fontSize: "14px" }}>
              {translatedSentences
                ? translatedSentences[idx]
                : NOT_TRANSLATION_MSG}
            </p>
          </div>
        ))}
      </>
    );
  }
);
