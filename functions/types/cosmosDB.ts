export type Question = {
  id: string;
  number: number;
  subjects: number[][];
  choices: number[][];
  correctIdx: number;
  explanations: number[][];
  testId: string;
};

export type Test = {
  id: string;
  courseName: string;
  testName: string;
  length: number;
};
