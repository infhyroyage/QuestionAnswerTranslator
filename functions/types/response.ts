export type GetHealthcheck = {
  message: "OK";
};

export type GetQuestion = {
  subjects: string[];
  choices: string[];
};

export type GetQuestionAnswer = {
  correctIdx: number;
  explanations: string[];
  references: string[];
};

export type GetTests = {
  [course: string]: {
    id: string;
    test: string;
    length: number;
  }[];
};
