export type Sentence = {
  sentence: string;
  isEscapedTranslation: boolean;
};

export type Test = {
  id: string;
  test: string;
  length: number;
};

export type GetQuestion = {
  subjects: Sentence[];
  choices: Sentence[];
};

export type GetQuestionAnswer = {
  correctIdx: number;
  explanations: Sentence[];
  references: string[];
};

export type GetTests = {
  [course: string]: Test[];
};

export type Method = "GET";
