import { Context } from "@azure/functions";

export default async (context: Context): Promise<void> => {
  context.res = {
    status: 200,
    body: {
      message: "OK",
    },
  };
};
