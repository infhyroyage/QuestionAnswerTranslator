export type TestState = {
  testName: string;
  testLength: number;
};

export type Answer = {
  choiceSentences: string[];
  correctChoiceSentences: string[];
};
export type ProgressState = TestState & {
  testId: string;
  answers: Answer[];
};
