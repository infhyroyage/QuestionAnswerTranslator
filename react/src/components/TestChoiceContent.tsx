import { ChangeEvent, FC, memo } from "react";
import { NOT_TRANSLATION_MSG } from "../services/deepl";
import { Sentence } from "../types/functions";
import { TestChoiceContentProps } from "../types/props";

export const TestChoiceContent: FC<TestChoiceContentProps> = memo(
  (props: TestChoiceContentProps) => {
    const {
      choices,
      isCorrectedMulti, // TODO 複数選択問題はラジオボタンではなくチェックボックスにする
      translatedChoices,
      selectedIdxes,
      correctIdxes,
      isDisabledRadioButtons,
      onChangeRadioButtonInner,
    } = props;

    return (
      <>
        {choices.map((choice: Sentence, idx: number) => {
          const fontWeight =
            correctIdxes.length > 0 && correctIdxes[0] === idx
              ? "bold"
              : "normal";
          const color =
            correctIdxes.length > 0 &&
            correctIdxes[0] !== selectedIdxes[0] &&
            selectedIdxes[0] === idx
              ? "red"
              : "black";
          return (
            <div key={`choice_${idx}`} style={{ display: "flex" }}>
              <input
                type="radio"
                value={idx}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onChangeRadioButtonInner(Number(e.target.value))
                }
                checked={selectedIdxes[0] === idx}
                disabled={isDisabledRadioButtons}
                style={{ marginRight: "14px" }}
              />
              <div onClick={() => onChangeRadioButtonInner(idx)}>
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
