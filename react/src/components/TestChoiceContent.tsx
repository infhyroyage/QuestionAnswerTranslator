import { ChangeEvent, FC, memo } from "react";
import { NOT_TRANSLATION_MSG } from "../services/translation";
import { Sentence } from "../types/functions";
import { TestChoiceContentProps } from "../types/props";

export const TestChoiceContent: FC<TestChoiceContentProps> = memo(
  (props: TestChoiceContentProps) => {
    const {
      choices,
      isCorrectedMulti,
      translatedChoices,
      selectedIdxes,
      correctIdxes,
      isDisabledChoiceInput,
      onChangeChoiceInput,
    } = props;

    return (
      <>
        {choices.map((choice: Sentence, idx: number) => {
          // 未回答の場合、すべての選択肢は黒字
          // 回答して正解した場合、正解の選択肢は黒太字、それ以外の選択肢は黒字
          // 回答して不正解の場合、正解の選択肢は黒太字、誤って選択した選択肢は赤字、それ以外の選択肢は黒字
          const fontWeight =
            correctIdxes.length > 0 && correctIdxes.includes(idx)
              ? "bold"
              : "normal";
          const color =
            correctIdxes.length > 0 &&
            correctIdxes.toString() !== selectedIdxes.toString() &&
            selectedIdxes.includes(idx) &&
            !correctIdxes.includes(idx)
              ? "red"
              : "black";

          return (
            <div key={`choice_${idx}`} style={{ display: "flex" }}>
              <input
                type={isCorrectedMulti ? "checkbox" : "radio"}
                value={idx}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onChangeChoiceInput(Number(e.target.value), isCorrectedMulti)
                }
                checked={selectedIdxes.includes(idx)}
                disabled={isDisabledChoiceInput}
                style={{ marginRight: "14px" }}
              />
              <div onClick={() => onChangeChoiceInput(idx, isCorrectedMulti)}>
                {choice.isIndicatedImg ? (
                  <img
                    src={choice.sentence}
                    alt={`${idx + 1}th Choice Picture`}
                  />
                ) : (
                  <>
                    <p style={{ fontWeight, color }}>{choice.sentence}</p>
                    <p style={{ fontWeight, color, fontSize: "14px" }}>
                      {translatedChoices
                        ? translatedChoices[idx]
                        : NOT_TRANSLATION_MSG}
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </>
    );
  }
);
