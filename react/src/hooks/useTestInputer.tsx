import { useState } from "react";

export const useTestInputer = () => {
  const [selectedIdxes, setSelectedIdxes] = useState<string[]>([]);
  const [isDisabledRadioButtons, setIsDisabledRadioButtons] =
    useState<boolean>(false);
  const [isDisabledSubmitButton, setIsDisabledSubmitButton] =
    useState<boolean>(true);

  const initializeTestInputer = () => {
    setSelectedIdxes([]);
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
    setSelectedIdxes([idx]);
  };

  return {
    selectedIdxes,
    isDisabledRadioButtons,
    isDisabledSubmitButton,
    initializeTestInputer,
    disableTestInputer,
    onChangeRadioButtonInner,
  };
};
