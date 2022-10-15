import { Sentence } from "./functions";

export type TestChoiceContentProps = {
  choices: Sentence[];
  isCorrectedMulti: boolean;
  translatedChoices: string[] | undefined;
  selectedIdxes: number[];
  correctIdxes: number[];
  isDisabledRadioButtons: boolean;
  onChangeRadioButtonInner: (idx: number) => void;
};

export type TestSentenceContentProps = {
  sentences: Sentence[];
  translatedSentences: string[] | undefined;
};

export type TestTranslationErrorContentProps = {
  sentences: Sentence[];
  setTranslatedSentences: React.Dispatch<
    React.SetStateAction<string[] | undefined>
  >;
  setIsNotTranslatedSentences: React.Dispatch<React.SetStateAction<boolean>>;
};
