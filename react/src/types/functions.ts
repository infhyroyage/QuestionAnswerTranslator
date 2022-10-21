export type Sentence = {
  sentence: string;
  isIndicatedImg: boolean;
  isEscapedTranslation: boolean;
};
export type IncorrectChoices = {
  [choiceIdx: number]: Sentence[];
};
export type ExplanationSentences = {
  overall: Sentence[];
  incorrectChoices: IncorrectChoices;
};

export type Test = {
  id: string;
  test: string;
  length: number;
};

export type GetQuestion = {
  subjects: Sentence[];
  choices: Sentence[];
  isCorrectedMulti: boolean;
};

export type GetQuestionAnswer = {
  correctIdxes: number[];
  explanations: ExplanationSentences;
  references: string[];
};

export type GetTests = {
  [course: string]: Test[];
};

export type Method = "GET";
