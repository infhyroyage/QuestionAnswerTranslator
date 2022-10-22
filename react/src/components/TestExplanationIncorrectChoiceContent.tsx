import React, { FC, memo } from "react";
import { NOT_TRANSLATION_MSG } from "../services/deepl";
import { Sentence } from "../types/functions";
import { TestExplanationIncorrectChoiceContentProps } from "../types/props";

export const TestExplanationIncorrectChoiceContent: FC<TestExplanationIncorrectChoiceContentProps> =
  memo((props: TestExplanationIncorrectChoiceContentProps) => {
    const {
      choices,
      translatedChoices,
      incorrectChoices,
      translatedIncorrectChoices,
    } = props;

    return (
      <>
        <h3>不正解の選択肢</h3>
        {Object.keys(incorrectChoices).map((choiceIdx: string) => (
          <div
            key={`incorrectChoice_${choiceIdx}`}
            style={{ paddingBottom: "7px" }}
          >
            <p style={{ fontWeight: "bold" }}>
              {choices[Number(choiceIdx)].sentence}
            </p>
            <p style={{ fontWeight: "bold", fontSize: "14px" }}>
              {translatedChoices
                ? translatedChoices[Number(choiceIdx)]
                : NOT_TRANSLATION_MSG}
            </p>
            {incorrectChoices[Number(choiceIdx)].map(
              (incorrectChoice: Sentence, idx: number) => (
                <React.Fragment key={`incorrectChoice_${choiceIdx}_${idx}`}>
                  <p>{incorrectChoice.sentence}</p>
                  <p style={{ fontSize: "14px" }}>
                    {translatedIncorrectChoices
                      ? translatedIncorrectChoices.shift()
                      : NOT_TRANSLATION_MSG}
                  </p>
                </React.Fragment>
              )
            )}
          </div>
        ))}
      </>
    );
  });
