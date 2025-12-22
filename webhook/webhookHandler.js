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
  // Verification
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

  // ---- load session ----
  let session = await getUserSession(message.from);

  // ---- start flow only on greeting or "start" ----
  if (!session) {
    if (!isGreeting(userText) && userText.toLowerCase() !== "start") {
      await sendWhatsAppMessage(
        message.from,
        "Hello 👋\nType *Start* to find a home.",
        config
      );
      return { statusCode: 200, body: "ok" };
    }

    session = { currentScreen: "RECOMMEND", answers: {} };
    await saveUserSession(message.from, session);
  }

  let screen = FLOW[session.currentScreen];

  // ---- process user answer ----
  if (screen.options.length > 0) {
    if (!screen.options.includes(userText)) {
      await sendWhatsAppMessage(
        message.from,
        renderScreen(screen, session.answers),
        config
      );
      return { statusCode: 200, body: "ok" };
    }

    if (screen.storeKey) {
      session.answers[screen.storeKey] = userText;
    }

    session.currentScreen = screen.next[userText];
    await saveUserSession(message.from, session);
    screen = FLOW[session.currentScreen];
  }

  // ---- END: run search ----
  if (screen.id === "END") {
    const intent = normalizeSearchParams({
      ...session.answers,
      is_search: true,
    });

    const listings = intent.location ? await getListingsFromDB(intent) : [];

    const reply = await formatResponse("", listings, config.gptKey);
    await sendWhatsAppMessage(message.from, reply, config);

    await saveSearch(message.from, intent);

    // reset session
    await saveUserSession(message.from, {
      currentScreen: "RECOMMEND",
      answers: {},
    });

    return { statusCode: 200, body: "ok" };
  }

  // ---- show next question ----
  await sendWhatsAppMessage(
    message.from,
    renderScreen(screen, session.answers),
    config
  );

  return { statusCode: 200, body: "ok" };
}

module.exports = { webhookHandler };
