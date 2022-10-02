import { ChangeEvent, FC, memo } from "react";
import { NOT_TRANSLATION_MSG } from "../services/deepl";
import { TestChoiceContentProps } from "../types/props";

export const TestChoiceContent: FC<TestChoiceContentProps> = memo(
  (props: TestChoiceContentProps) => {
    const {
      choices,
      translatedChoices,
      selectedIdx,
      correctIdx,
      isDisabledRadioButtons,
      onChangeRadioButtonInner,
    } = props;

    return (
      <>
        {choices.map((choice: string, idx: number) => {
          const fontWeight =
            correctIdx !== "" && correctIdx === `${idx}` ? "bold" : "normal";
          const color =
            correctIdx !== "" &&
            correctIdx !== selectedIdx &&
            selectedIdx === `${idx}`
              ? "red"
              : "black";
          return (
            <div key={`choice_${idx}`} style={{ display: "flex" }}>
              <input
                type="radio"
                value={`${idx}`}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onChangeRadioButtonInner(e.target.value)
                }
                checked={selectedIdx === `${idx}`}
                disabled={isDisabledRadioButtons}
                style={{ marginRight: "14px" }}
              />
              <div onClick={() => onChangeRadioButtonInner(`${idx}`)}>
                <p style={{ fontWeight, color }}>{choice}</p>
                <p style={{ fontWeight, color, fontSize: "14px" }}>
                  {translatedChoices
                    ? translatedChoices[idx]
                    : NOT_TRANSLATION_MSG}
                </p>
              </div>
            </div>
          );
        })}
      </>
    );
  }
);
