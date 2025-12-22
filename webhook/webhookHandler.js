// webhook/webhookHandler.js

const { extractIncomingMessage } = require("../utils/parseUserMessage");
const { normalizeSearchParams } = require("../utils/normalizeParams");
const { formatResponse } = require("../services/gptService");
const {
  isMessageProcessed,
  markMessageProcessed,
  getListingsFromDB,
  saveSearch,
} = require("../services/dynamoService");
const { sendWhatsAppMessage } = require("../services/whatsappService");
const FLOW = require("../services/flow");
const { getUserSession, saveUserSession } = require("../services/flowSession");

// ---- helpers ----
function isGreeting(text) {
  return ["hi", "hello", "hey", "good day", "good morning"].includes(
    text.toLowerCase()
  );
}

function renderScreen(screen, answers) {
  const text =
    typeof screen.text === "function" ? screen.text(answers) : screen.text;

  if (!screen.options || screen.options.length === 0) return text;

  return (
    text +
    "\n\nReply with one option:\n" +
    screen.options.map((o) => `- ${o}`).join("\n")
  );
}

// ---- handler ----
async function webhookHandler(event, config) {
  // ---- Verification for WhatsApp webhook ----
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

  // ---- Extract incoming message ----
  const payload = JSON.parse(event.body || "{}");
  const message = extractIncomingMessage(payload);
  if (!message?.text) return { statusCode: 200, body: "ok" };

  // Ignore messages sent from bot itself
  if (message.from === config.whatsappPhoneId)
    return { statusCode: 200, body: "ok" };

  // Check if already processed
  if (await isMessageProcessed(message.id))
    return { statusCode: 200, body: "ok" };
  await markMessageProcessed(message.id);

  const userText = message.text.body.trim();
  const normalizedInput = userText.toLowerCase();

  // ---- Load user session ----
  let session = await getUserSession(message.from);

  // ---- Entry point ----
  if (!session) {
    if (!isGreeting(normalizedInput) && normalizedInput !== "start") {
      await sendWhatsAppMessage(
        message.from,
        "Hello 👋\nType *Start* to find a home.",
        config
      );
      return { statusCode: 200, body: "ok" };
    }

    // Start session
    session = { currentScreen: "LOCATION", answers: {} };
    await saveUserSession(message.from, session);

    const screen = FLOW.LOCATION;
    await sendWhatsAppMessage(
      message.from,
      renderScreen(screen, session.answers),
      config
    );

    return { statusCode: 200, body: "ok" };
  }

  let screen = FLOW[session.currentScreen];

  // ---- Handle screens with options ----
  const optionMap = {};
  screen.options?.forEach((o) => (optionMap[o.toLowerCase()] = o));

  if (screen.options && !optionMap[normalizedInput]) {
    // Invalid input, resend same screen
    await sendWhatsAppMessage(
      message.from,
      renderScreen(screen, session.answers),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  const selectedOption = optionMap[normalizedInput];

  // ---- Save answer if screen has storeKey ----
  if (screen.storeKey) {
    session.answers[screen.storeKey] = selectedOption;
  }

  // ---- Move to next screen ----
  session.currentScreen = screen.next?.[selectedOption] || null;
  await saveUserSession(message.from, session);

  screen = FLOW[session.currentScreen];

  // ---- END: fetch listings & GPT formatting ----
  if (screen?.id === "END" && normalizedInput === "submit") {
    // Prepare search params
    const searchParams = {
      location: session.answers.location,
      property_type: session.answers.property_type,
      bedrooms: session.answers.bedrooms
        ? Number(session.answers.bedrooms.replace("+", "")) // handle "4+" as 4
        : undefined,
      bathrooms: session.answers.bathrooms
        ? Number(session.answers.bathrooms)
        : undefined,
      min_price: session.answers.min_price
        ? Number(session.answers.min_price)
        : undefined,
      max_price: session.answers.max_price
        ? Number(session.answers.max_price)
        : undefined,
    };

    // Fetch listings from DB
    const listings = await getListingsFromDB(searchParams);

    // Build descriptive query for GPT formatting
    const userQuery = `Show me ${searchParams.bedrooms || "any"}-bedroom ${
      searchParams.property_type || "property"
    } in ${searchParams.location || "any location"}`;

    // Format response
    const reply = await formatResponse(userQuery, listings, config.gptKey);
    await sendWhatsAppMessage(message.from, reply, config);

    // Save search history
    await saveSearch(message.from, searchParams);

    // Reset session
    await saveUserSession(message.from, {
      currentScreen: "RECOMMEND",
      answers: {},
    });

    return { statusCode: 200, body: "ok" };
  }

  // ---- Render next screen ----
  if (screen) {
    await sendWhatsAppMessage(
      message.from,
      renderScreen(screen, session.answers),
      config
    );
  }

  return { statusCode: 200, body: "ok" };
}

module.exports = { webhookHandler };
