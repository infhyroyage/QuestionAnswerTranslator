export type TestChoiceContentProps = {
  choices: string[];
  translatedChoices: string[] | undefined;
  selectedIdx: string;
  correctIdx: string;
  isDisabledRadioButtons: boolean;
  onChangeRadioButtonInner: (idx: string) => void;
};

export type TestSentenceContentProps = {
  sentences: string[];
  translatedSentences: string[] | undefined;
};

export type TestTranslationErrorContentProps = {
  sentences: string[];
  setTranslatedSentences: React.Dispatch<
    React.SetStateAction<string[] | undefined>
  >;
  setIsNotTranslatedSentences: React.Dispatch<React.SetStateAction<boolean>>;
};
