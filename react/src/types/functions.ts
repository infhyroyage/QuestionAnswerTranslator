export type GetQuestion = {
  subjects: string[];
  choices: string[];
};

export type GetQuestionAnswer = {
  correctIdx: number;
  explanations: string[];
};

export type Test = {
  id: string;
  test: string;
  length: number;
};
export type GetTests = {
  [course: string]: Test[];
};

export type Method = "GET";
