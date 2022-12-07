export type TestState = {
  testName: string;
  testLength: number;
};

export type Answer = {
  subjectConcatSentence: string;
  choiceSentences: string[];
  correctChoiceSentences: string[];
};
export type ProgressState = TestState & {
  testId: string;
  answers: Answer[];
};
