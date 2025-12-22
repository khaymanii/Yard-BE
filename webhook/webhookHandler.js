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

// ---- sanitize object for DynamoDB ----
function sanitizeForDynamo(obj) {
  const clean = {};
  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null) {
      // Convert numbers properly
      if (!isNaN(obj[key])) clean[key] = Number(obj[key]);
      else clean[key] = obj[key];
    }
  }
  // Ensure features is always an array
  if (!Array.isArray(clean.features)) clean.features = [];
  return clean;
}

// ---- handler ----
async function webhookHandler(event, config) {
  // ---- Verification ----
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

  if (message.from === config.whatsappPhoneId)
    return { statusCode: 200, body: "ok" };

  if (await isMessageProcessed(message.id))
    return { statusCode: 200, body: "ok" };

  await markMessageProcessed(message.id);

  const userText = message.text.body.trim();
  const normalizedInput = userText.toLowerCase();

  // ---- Load session ----
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

    session = { currentScreen: "RECOMMEND", answers: {} };
    await saveUserSession(message.from, session);

    const screen = FLOW.RECOMMEND;
    await sendWhatsAppMessage(
      message.from,
      renderScreen(screen, session.answers),
      config
    );

    return { statusCode: 200, body: "ok" };
  }

  let screen = FLOW[session.currentScreen];

  // ---- Validate input ----
  const optionMap = {};
  screen.options?.forEach((o) => (optionMap[o.toLowerCase()] = o));

  if (screen.options && !optionMap[normalizedInput]) {
    await sendWhatsAppMessage(
      message.from,
      renderScreen(screen, session.answers),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  const selectedOption = optionMap[normalizedInput];

  // ---- Save answer ----
  if (screen.storeKey) {
    session.answers[screen.storeKey] = selectedOption;
  }

  // ---- Move to next screen ----
  session.currentScreen = screen.next[selectedOption] || null;
  await saveUserSession(message.from, session);

  screen = FLOW[session.currentScreen];

  // ---- END: fetch listings & GPT formatting ----
  if (screen?.id === "END" && normalizedInput === "submit") {
    const intent = normalizeSearchParams({
      ...session.answers,
      is_search: true,
    });

    // fetch listings from DB
    const listings = intent.location ? await getListingsFromDB(intent) : [];

    // build a descriptive query for GPT formatting
    const userQuery = `Show me ${session.answers.bedrooms || "any"}-bedroom ${
      session.answers.property_type || "property"
    } in ${session.answers.location || "any location"}`;

    // format response with GPT
    const reply = await formatResponse(userQuery, listings, config.gptKey);
    await sendWhatsAppMessage(message.from, reply, config);

    // sanitize intent and save to DynamoDB
    await saveSearch(message.from, sanitizeForDynamo(intent));

    // reset session for new conversation
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
