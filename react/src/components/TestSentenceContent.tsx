import { FC, memo } from "react";
import { NOT_TRANSLATION_MSG } from "../services/deepl";
import { Sentence } from "../types/functions";
import { TestSentenceContentProps } from "../types/props";

export const TestSentenceContent: FC<TestSentenceContentProps> = memo(
  (props) => {
    const { sentences, translatedSentences } = props;

    return (
      <>
        {sentences.map((subject: Sentence, idx: number) => (
          <div key={idx} style={{ paddingBottom: "7px" }}>
            <p>{subject.sentence}</p>
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
