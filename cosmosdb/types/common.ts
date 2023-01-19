export type ImportItem = {
  /**
   * 問題番号(1スタート)
   */
  number: number;

  /**
   * 問題文または画像URL
   */
  subjects: string[];

  /**
   * 選択肢
   */
  choices: string[];

  /**
   * 回答の選択肢のインデックス(複数回答の場合は複数指定)
   */
  correctIdxes: number[];

  /**
   * 解説文
   */
  explanations: string[];

  /**
   * 不正解の選択肢の解説文(正解の選択肢はnull、省略可能)
   */
  incorrectChoicesExplanations?: (string[] | null)[];

  /**
   * 画像URLのインデックス群(省略可能)
   */
  indicateImgIdxes?: {
    /**
     * subjects(省略可能)
     */
    subjects?: number[];

    /**
     * explanations(省略可能)
     */
    explanations?: number[];
  };

  /**
   * 翻訳不必要な文字列のインデックス群(省略可能)
   */
  escapeTranslatedIdxes?: {
    /**
     * subjects(省略可能)
     */
    subjects?: number[];

    /**
     * choices(省略可能)
     */
    choices?: number[];

    /**
     * explanations(省略可能)
     */
    explanations?: number[];

    /**
     * incorrectChoicesExplanations(正解の選択肢はnull、省略可能)
     */
    incorrectChoicesExplanations?: (number[] | null)[];
  };

  /**
   * 解説URL群(省略可能)
   */
  references?: string[];
};
export type ImportDatabaseData = {
  [testName: string]: ImportItem[];
};
export type ImportData = {
  [courseName: string]: ImportDatabaseData;
};

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
  explanations: Explanation[];
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

export type TestName2TestId = {
  [testName: string]: string;
};
export type CourseAndTestName2TestId = {
  [courseName: string]: TestName2TestId;
};

// TODO 消す
export type Item = {
  id: string;
  [key: string]: any;
};
export type DatabaseData = {
  [testName: string]: Item[];
};
export type Data = {
  [courseName: string]: DatabaseData;
};
