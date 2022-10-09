import { Context } from "@azure/functions";
import { GetHealthcheck } from "../types/response";

export default async (context: Context): Promise<void> => {
  const body: GetHealthcheck = {
    message: "OK",
  };

  context.res = { status: 200, body };
};
