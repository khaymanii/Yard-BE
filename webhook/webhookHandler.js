const { extractIncomingMessage } = require("../utils/parseUserMessage");
const { normalizeSearchParams } = require("../utils/normalizeParams");
const { extractIntent, formatResponse } = require("../services/gptService");
const {
  isMessageProcessed,
  markMessageProcessed,
  getListingsFromDB,
  saveSearch,
  getLastSearch,
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

  // Ignore messages sent by your own WhatsApp number
  if (message.from === config.whatsappPhoneId) {
    return { statusCode: 200, body: "ok" };
  }

  // Idempotency check
  if (await isMessageProcessed(message.id)) {
    return { statusCode: 200, body: "ok" };
  }

  await markMessageProcessed(message.id);

  const userText = message.text.body.trim();

  // --- Load previous memory from DynamoDB ---
  let previousIntent = null;
  const lastSearch = await getLastSearch(message.from);

  if (lastSearch) {
    const age = Date.now() - new Date(lastSearch.timestamp).getTime();
    if (age < 30 * 60 * 1000) {
      // Keep last 30 mins only
      previousIntent = lastSearch.query;
    }
  }

  // --- Extract intent from GPT and merge with previous memory ---
  const newIntent = await extractIntent(
    userText,
    config.gptKey,
    previousIntent
  );

  // Merge previous intent only for missing values
  const intent = normalizeSearchParams({
    ...previousIntent,
    ...newIntent,
  });

  // --- Fetch listings if it's a search ---
  let listings = [];
  if (intent.is_search && intent.location) {
    listings = await getListingsFromDB(intent);
    await saveSearch(message.from, intent);
  }

  // --- Generate reply ---
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
