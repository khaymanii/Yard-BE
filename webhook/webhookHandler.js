const { extractIncomingMessage } = require("../utils/parseUserMessage");
const { normalizeSearchParams } = require("../utils/normalizeParams");
const { extractIntent, formatResponse } = require("../services/gptService");
const {
  isMessageProcessed,
  markMessageProcessed,
  getListingsFromDB,
  saveSearch,
} = require("../services/dynamoService");
const { sendWhatsAppMessage } = require("../services/whatsappService");

// Import flow config & session helpers
const FLOW = require("../services/flow"); // your flow JSON transformed into JS object
const { getUserSession, saveUserSession } = require("../services/flowSession");

async function webhookHandler(event, config) {
  // --- WhatsApp webhook verification ---
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

  // --- Parse incoming message ---
  const payload = JSON.parse(event.body || "{}");
  const message = extractIncomingMessage(payload);
  if (!message?.text) return { statusCode: 200, body: "ok" };

  // Ignore messages from own number
  if (message.from === config.whatsappPhoneId)
    return { statusCode: 200, body: "ok" };

  // Idempotency check
  if (await isMessageProcessed(message.id))
    return { statusCode: 200, body: "ok" };
  await markMessageProcessed(message.id);

  const userText = message.text.body.trim();

  // --- Load or initialize user session ---
  let session = (await getUserSession(message.from)) || {
    currentScreen: "RECOMMEND",
    answers: {},
  };
  let currentScreen = FLOW[session.currentScreen];

  // --- Handle user input for the current screen ---
  if (currentScreen.inputType) {
    // Save user's answer
    session.answers[currentScreen.storeKey] = userText;

    // Determine next screen
    if (currentScreen.next[userText]) {
      session.currentScreen = currentScreen.next[userText];
    } else if (currentScreen.next.default) {
      session.currentScreen = currentScreen.next.default;
    }

    // Save updated session
    await saveUserSession(message.from, session);
    currentScreen = FLOW[session.currentScreen];
  }

  // --- Generate reply ---
  let reply;

  if (currentScreen.id === "END") {
    // Run GPT search at final screen
    const intent = normalizeSearchParams(session.answers);
    const listings =
      intent.is_search && intent.location
        ? await getListingsFromDB(intent)
        : [];
    reply = await formatResponse("", listings, config.gptKey);

    // Save search if applicable
    if (intent.is_search) await saveSearch(message.from, intent);

    // Reset session after completion
    session = { currentScreen: "RECOMMEND", answers: {} };
    await saveUserSession(message.from, session);
  } else {
    // If intermediate screen, show its text or dynamic function
    reply =
      typeof currentScreen.text === "function"
        ? currentScreen.text(session.answers)
        : currentScreen.text;
  }

  // --- Send reply ---
  await sendWhatsAppMessage(message.from, reply, config);

  return { statusCode: 200, body: "ok" };
}

module.exports = { webhookHandler };
