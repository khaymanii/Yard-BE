import { extractIncomingMessage } from "../utils/parseUserMessage.mjs";
import { normalizeSearchParams } from "../utils/normalizeParams.mjs";
import { extractIntent, formatResponse } from "../services/gptService.mjs";
import {
  isMessageProcessed,
  markMessageProcessed,
  getListingsFromDB,
  saveSearch,
} from "../services/dynamoService.mjs";
import { sendWhatsAppMessage } from "../services/whatsappService.mjs";

export async function webhookHandler(event, config) {
  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    if (
      q["hub.mode"] === "subscribe" &&
      q["hub.verify_token"] === config.verifyToken
    ) {
      return { statusCode: 200, body: q["hub.challenge"] };
    }
    return { statusCode: 403, body: "Verification failed" };
  }

  const payload = JSON.parse(event.body || "{}");
  const message = extractIncomingMessage(payload);
  if (!message?.text) return { statusCode: 200, body: "ok" };

  if (await isMessageProcessed(message.id))
    return { statusCode: 200, body: "ok" };
  await markMessageProcessed(message.id);

  const userText = message.text.body.trim();
  const intent = normalizeSearchParams(
    await extractIntent(userText, config.gptKey)
  );

  let listings = [];
  if (intent.is_search && intent.location) {
    listings = await getListingsFromDB(intent);
    await saveSearch(message.from, intent);
  }

  const reply = await formatResponse(userText, listings, config.gptKey);
  await sendWhatsAppMessage(message.from, reply, config);

  return { statusCode: 200, body: "ok" };
}
