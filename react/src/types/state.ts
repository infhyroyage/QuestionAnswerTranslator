export type TestState = {
  testName: string;
  testLength: number;
};

export type Answer = {
  subject: string;
  choice: string;
  correctChoice: string;
};

export type TestResultState = TestState & {
  answerProgress: Answer[];
};
