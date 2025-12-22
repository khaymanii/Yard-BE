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

  // ---- Restart flow on greeting or "start" ----
  if (!session || isGreeting(normalizedInput) || normalizedInput === "start") {
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
  if (!screen) {
    // Safety fallback
    session = { currentScreen: "LOCATION", answers: {} };
    await saveUserSession(message.from, session);
    await sendWhatsAppMessage(
      message.from,
      renderScreen(FLOW.LOCATION, session.answers),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

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

  const selectedOption = normalizedInput;

  // ---- Save answer if applicable ----
  if (screen.storeKey) {
    session.answers[screen.storeKey] = optionMap[normalizedInput];
  }

  // ---- Move to next screen ----
  session.currentScreen = screen.next?.[selectedOption] || screen.id;
  await saveUserSession(message.from, {
    currentScreen: session.currentScreen,
    answers: session.answers,
  });

  screen = FLOW[session.currentScreen];

  // ---- END: fetch listings & GPT formatting ----
  if (screen?.id === "END" && normalizedInput === "submit") {
    const intent = normalizeSearchParams({
      ...session.answers,
      is_search: true,
    });
    const listings = intent.location ? await getListingsFromDB(intent) : [];

    const userQuery = `Show me ${session.answers.bedrooms || "any"}-bedroom ${
      session.answers.property_type || "property"
    } in ${session.answers.location || "any location"}`;

    const reply = await formatResponse(userQuery, listings, config.gptKey);
    await sendWhatsAppMessage(message.from, reply, config);
    await saveSearch(message.from, intent);

    // reset session to RECOMMEND for next search
    const sessionToSave = {
      ...(session.currentScreen
        ? { currentScreen: session.currentScreen }
        : {}),
      answers: session.answers || {},
    };
    await saveUserSession(message.from, sessionToSave);

    return { statusCode: 200, body: "ok" };
  }

  // ---- Render next screen ----
  await sendWhatsAppMessage(
    message.from,
    renderScreen(screen, session.answers),
    config
  );
  return { statusCode: 200, body: "ok" };
}

module.exports = { webhookHandler };
