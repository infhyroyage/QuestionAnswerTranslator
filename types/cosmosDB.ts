export type IndicateImgIdxes = {
  subjects?: number[];
  explanations?: number[];
};
export type EscapeTranslatedIdxes = {
  subjects?: number[];
  choices?: number[];
  explanations?: number[];
  incorrectChoicesExplanations?: (number[] | null)[];
};
export type Question = {
  id: string;
  number: number;
  subjects: string[];
  choices: string[];
  correctIdxes: number[];
  explanations?: string[];
  incorrectChoicesExplanations?: (string[] | null)[];
  indicateImgIdxes?: IndicateImgIdxes;
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
