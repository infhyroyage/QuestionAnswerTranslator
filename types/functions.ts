export type Sentence = {
  sentence: string;
  isIndicatedImg: boolean;
  isEscapedTranslation: boolean;
};
export type IncorrectChoices = {
  [choiceIdx: string]: Sentence[];
};
export type ExplanationSentences = {
  overall: Sentence[];
  incorrectChoices: IncorrectChoices;
};

export type GetHealthcheck = {
  message: "OK";
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

export type GetTest = {
  testName: string;
  length: number;
};

export type Test = {
  id: string;
  testName: string;
};
export type GetTests = {
  [course: string]: Test[];
};

export type PostEn2JaReq = string[];
export type PostEn2JaRes = string[];

export type Methods = ["GET", "POST"];
