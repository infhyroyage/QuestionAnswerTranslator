import { useState } from "react";

export const useTestInputer = () => {
  const [selectedIdxes, setSelectedIdxes] = useState<number[]>([]);
  const [isDisabledChoiceInput, setIsDisabledChoiceInput] =
    useState<boolean>(false);
  const [isDisabledSubmitButton, setIsDisabledSubmitButton] =
    useState<boolean>(true);

  const initializeTestInputer = () => {
    setSelectedIdxes([]);
    setIsDisabledSubmitButton(true);
    setIsDisabledChoiceInput(false);
  };

  const disableTestInputer = () => {
    setIsDisabledSubmitButton(true);
    setIsDisabledChoiceInput(true);
  };

  const onChangeChoiceInput = (idx: number, isCorrectedMulti: boolean) => {
    // 回答済の場合はNOP
    if (isDisabledChoiceInput) return;

    // 1度でも回答内容を入力したため回答ボタンを活性化
    setIsDisabledSubmitButton(false);

    if (isCorrectedMulti) {
      const updatedSelectedIdxes: number[] = selectedIdxes.includes(idx)
        ? selectedIdxes.filter((selectedIdx: number) => selectedIdx !== idx)
        : [...selectedIdxes, idx];
      setSelectedIdxes(
        updatedSelectedIdxes.sort((a, b) => (a === b ? 0 : a < b ? -1 : 1))
      );
    } else {
      setSelectedIdxes([idx]);
    }
  };

  return {
    selectedIdxes,
    isDisabledChoiceInput,
    isDisabledSubmitButton,
    initializeTestInputer,
    disableTestInputer,
    onChangeChoiceInput,
  };
};
