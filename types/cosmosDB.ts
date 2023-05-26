export type Subject = number[] | string;
export type Choice = number[] | string;
export type Explanation = number[] | string;
export type IncorrectChoiceExplanation = number[] | string;
export type IncorrectChoiceExplanations = IncorrectChoiceExplanation[] | null;
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
  subjects: Subject[];
  choices: Choice[];
  correctIdxes: number[];
  explanations?: Explanation[];
  incorrectChoicesExplanations?: IncorrectChoiceExplanations[];
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

export type Flag = {
  id: string;
  year: number;
  month: number;
};
