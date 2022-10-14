export type Subject = number[] | string;
export type Choice = number[] | string;
export type Explanation = number[] | string;
export type IndicateImgIdxes = {
  subjects?: number[];
};
export type EscapeTranslatedIdxes = {
  subjects?: number[];
  choices?: number[];
  explanations?: number[];
};
export type Question = {
  id: string;
  number: number;
  subjects: Subject[];
  choices: Choice[];
  correctIdxes: number[];
  explanations: Explanation[];
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
