const { extractIncomingMessage } = require("../utils/parseUserMessage");
const { normalizeSearchParams } = require("../utils/normalizeParams");
const { extractIntent, formatResponse } = require("../services/gptService");
const {
  isMessageProcessed,
  markMessageProcessed,
  getListingsFromDB,
  saveSearch,
  getLastSearch, // 👈 make sure to import
} = require("../services/dynamoService");
const { sendWhatsAppMessage } = require("../services/whatsappService");

async function webhookHandler(event, config) {
  // WhatsApp webhook verification
  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};

    if (
      q["hub.mode"] === "subscribe" &&
      q["hub.verify_token"] === config.verifyToken
    ) {
      return {
        statusCode: 200,
        body: q["hub.challenge"],
      };
    }

    return {
      statusCode: 403,
      body: "Verification failed",
    };
  }

  // Incoming message
  const payload = JSON.parse(event.body || "{}");
  const message = extractIncomingMessage(payload);

  if (!message?.text) {
    return { statusCode: 200, body: "ok" };
  }

  if (message.from === config.whatsappPhoneId) {
    return { statusCode: 200, body: "ok" };
  }

  // Idempotency check
  if (await isMessageProcessed(message.id)) {
    return { statusCode: 200, body: "ok" };
  }

  await markMessageProcessed(message.id);

  const userText = message.text.body.trim();

  // --- Step 2: Load previous memory from DynamoDB ---
  let previousIntent = null;
  const lastSearch = await getLastSearch(message.from);

  if (lastSearch) {
    const age = Date.now() - new Date(lastSearch.timestamp).getTime();
    if (age < 30 * 60 * 1000) {
      // only keep last 30 mins
      previousIntent = lastSearch.query;
    }
  }

  // Pass previousIntent to GPT
  const intent = normalizeSearchParams(
    await extractIntent(userText, config.gptKey, previousIntent)
  );

  let listings = [];

  if (intent.is_search && intent.location) {
    listings = await getListingsFromDB(intent);
    await saveSearch(message.from, intent);
  }

  const reply = await formatResponse(userText, listings, config.gptKey);

  await sendWhatsAppMessage(message.from, reply, config);

  return {
    statusCode: 200,
    body: "ok",
  };
}

module.exports = {
  webhookHandler,
};
