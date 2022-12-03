import { FC, memo } from "react";
import { NOT_TRANSLATION_MSG } from "../services/translation";
import { Sentence } from "../types/functions";
import { TestSentenceContentProps } from "../types/props";

export const TestSentenceContent: FC<TestSentenceContentProps> = memo(
  (props) => {
    const { sentences, translatedSentences } = props;

    return (
      <>
        {sentences.map((sentence: Sentence, idx: number) => (
          <div key={idx} style={{ paddingBottom: "7px" }}>
            {sentence.isIndicatedImg ? (
              <img
                src={sentence.sentence}
                alt={`${idx + 1}th Sentence Picture`}
              />
            ) : (
              <>
                <p>{sentence.sentence}</p>
                <p style={{ fontSize: "14px" }}>
                  {translatedSentences
                    ? translatedSentences[idx]
                    : NOT_TRANSLATION_MSG}
                </p>
              </>
            )}
          </div>
        ))}
      </>
    );
  }
);
