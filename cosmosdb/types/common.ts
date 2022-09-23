export type InitialImportItem = {
  [key: string]: any;
};
export type InitialImportDatabaseData = {
  [container: string]: InitialImportItem[];
};
export type InitialImportData = {
  [database: string]: InitialImportDatabaseData;
};

export type ManualImportItem = {
  testName: string;
  [key: string]: any;
};
export type ManualImportDatabaseData = {
  [container: string]: ManualImportItem[];
};
export type ManualImportData = {
  [database: string]: ManualImportDatabaseData;
};

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
