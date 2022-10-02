import { useState } from "react";

export const useTestInputer = () => {
  const [selectedIdx, setSelectedIdx] = useState<string>("");
  const [isDisabledRadioButtons, setIsDisabledRadioButtons] =
    useState<boolean>(false);
  const [isDisabledSubmitButton, setIsDisabledSubmitButton] =
    useState<boolean>(true);

  const initializeTestInputer = () => {
    setSelectedIdx("");
    setIsDisabledSubmitButton(true);
    setIsDisabledRadioButtons(false);
  };

  const disableTestInputer = () => {
    setIsDisabledSubmitButton(true);
    setIsDisabledRadioButtons(true);
  };

  const onChangeRadioButtonInner = (idx: string) => {
    // 回答済の場合はNOP
    if (isDisabledRadioButtons) return;

    setIsDisabledSubmitButton(false);
    setSelectedIdx(idx);
  };

  return {
    selectedIdx,
    isDisabledRadioButtons,
    isDisabledSubmitButton,
    initializeTestInputer,
    disableTestInputer,
    onChangeRadioButtonInner,
  };
};
