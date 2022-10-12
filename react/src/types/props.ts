import { Sentence } from "./functions";

export type TestChoiceContentProps = {
  choices: Sentence[];
  translatedChoices: string[] | undefined;
  selectedIdx: string;
  correctIdx: string;
  isDisabledRadioButtons: boolean;
  onChangeRadioButtonInner: (idx: string) => void;
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
