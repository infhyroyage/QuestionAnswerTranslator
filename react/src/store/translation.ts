import { atom } from "recoil";

export const translation = atom({
  key: "translation",
  default: { isTranslatedByAzureCognitive: false },
});
