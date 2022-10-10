export type EscapeTranslatedIdxes = {
  subjects?: number[];
  choices?: number[];
  explanations?: number[];
};
export type Question = {
  id: string;
  number: number;
  subjects: number[][];
  choices: number[][];
  correctIdx: number;
  explanations: number[][];
  escapeTranslatedIdxes?: EscapeTranslatedIdxes;
  references?: string[];
  testId: string;
};

export type Test = {
  id: string;
  courseName: string;
  testName: string;
  length: number;
};
