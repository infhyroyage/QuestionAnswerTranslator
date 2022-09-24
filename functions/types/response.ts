export type GetTests = {
  [course: string]: {
    id: string;
    test: string;
    length: number;
  }[];
};
