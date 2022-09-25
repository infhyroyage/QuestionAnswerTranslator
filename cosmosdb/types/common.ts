export type Item = {
  id: string;
  [key: string]: any;
};
export type DatabaseData = {
  [container: string]: Item[];
};
export type Data = {
  [database: string]: DatabaseData;
};

export type TestName2TestId = {
  [testName: string]: string;
};
