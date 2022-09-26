export type Translation = {
  detected_source_language: string;
  text: string;
};

export type DeepLResponse = {
  translations: Translation[];
};
