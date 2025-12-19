// index.mjs
import { webhookHandler } from "./webhook/webhookHandler.mjs"; // adjust if your file is named differently
import { getConfig } from "./utils/config.mjs";

export const handler = async (event) => {
  const config = getConfig();
  try {
    const response = await webhookHandler(event, config);
    return response;
  } catch (err) {
    console.error("Error in Lambda:", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
