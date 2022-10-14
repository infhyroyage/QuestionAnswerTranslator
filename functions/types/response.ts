export type Sentence = {
  sentence: string;
  isEscapedTranslation: boolean;
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
  explanations: Sentence[];
  references: string[];
};

export type GetTests = {
  [course: string]: {
    id: string;
    test: string;
    length: number;
  }[];
};
