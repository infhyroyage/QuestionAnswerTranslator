export type TestState = {
  testName: string;
  testLength: number;
};

export type Answer = {
  subjectConcatSentence: string;
  choiceSentences: string[];
  correctChoiceSentences: string[];
};

export type TestResultState = TestState & {
  answerProgress: Answer[];
};
