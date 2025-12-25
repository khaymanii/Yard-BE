const { extractIncomingMessage } = require("../utils/parseUserMessage");
const { normalizeSearchParams } = require("../utils/normalizeParams");
const { formatResponse } = require("../services/gptService");
const {
  isMessageProcessed,
  markMessageProcessed,
  getListingsFromDB,
  saveSearch,
  saveAppointment,
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

  return text + "\n\n" + screen.options.join("\n");
}

function getNextSevenDays() {
  const days = [];
  const today = new Date();

  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const formatted = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const iso = date.toISOString().split("T")[0];
    days.push({ display: formatted, iso, number: i });
  }

  return days;
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
  const userNumber = parseInt(userText);

  // ---- Load session ----
  let session = await getUserSession(message.from);

  console.log(
    "Session:",
    JSON.stringify({
      screen: session?.currentScreen,
      hasListings: !!session?.listings,
      listingsCount: session?.listings?.length,
      userInput: userText,
    })
  );

  // ---- Global commands (work anywhere) ----
  if (userText.toLowerCase() === "menu") {
    session = { currentScreen: "WELCOME", answers: {} };
    await saveUserSession(message.from, session);
    await sendWhatsAppMessage(
      message.from,
      renderScreen(FLOW.WELCOME, {}),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  if (
    userText.toLowerCase() === "restart" ||
    userText.toLowerCase() === "reset"
  ) {
    session = { currentScreen: "WELCOME", answers: {} };
    await saveUserSession(message.from, session);
    await sendWhatsAppMessage(
      message.from,
      "🔄 Restarted!\n\n" + renderScreen(FLOW.WELCOME, {}),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  if (userText.toLowerCase() === "cancel") {
    session = { currentScreen: "WELCOME", answers: {} };
    await saveUserSession(message.from, session);
    await sendWhatsAppMessage(
      message.from,
      "❌ Cancelled.\n\n" + renderScreen(FLOW.WELCOME, {}),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  // ---- Start flow if no session exists ----
  if (!session && isGreeting(userText.toLowerCase())) {
    session = { currentScreen: "WELCOME", answers: {} };
    await saveUserSession(message.from, session);
    await sendWhatsAppMessage(
      message.from,
      renderScreen(FLOW.WELCOME, {}),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  // ---- Safety fallback if no session ----
  if (!session) {
    session = { currentScreen: "WELCOME", answers: {} };
    await saveUserSession(message.from, session);
    await sendWhatsAppMessage(
      message.from,
      renderScreen(FLOW.WELCOME, {}),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  let screen = FLOW[session.currentScreen];

  // ---- Handle missing screen (corruption) ----
  if (!screen) {
    session = { currentScreen: "SESSION_EXPIRED", answers: {} };
    await saveUserSession(message.from, session);
    await sendWhatsAppMessage(
      message.from,
      renderScreen(FLOW.SESSION_EXPIRED, {}),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  // ---- Handle free text input (name) ----
  if (screen.inputType === "text") {
    if (userText.length < 2) {
      await sendWhatsAppMessage(
        message.from,
        "Please enter a valid name (at least 2 characters).",
        config
      );
      return { statusCode: 200, body: "ok" };
    }

    session.answers[screen.storeKey] = userText;
    session.currentScreen = "CONFIRM_APPOINTMENT";
    await saveUserSession(message.from, session);

    await sendWhatsAppMessage(
      message.from,
      renderScreen(FLOW.CONFIRM_APPOINTMENT, session.answers),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  // ---- Handle listing selection ----
  if (screen.inputType === "number" && screen.id === "SELECT_LISTING") {
    if (!session.listings || session.listings.length === 0) {
      session = { currentScreen: "SESSION_EXPIRED", answers: {} };
      await saveUserSession(message.from, session);
      await sendWhatsAppMessage(
        message.from,
        renderScreen(FLOW.SESSION_EXPIRED, {}),
        config
      );
      return { statusCode: 200, body: "ok" };
    }

    const listingIndex = userNumber - 1;

    if (
      isNaN(userNumber) ||
      userNumber < 1 ||
      userNumber > session.listings.length
    ) {
      await sendWhatsAppMessage(
        message.from,
        `❌ Invalid selection. Please enter a number between 1 and ${session.listings.length}.`,
        config
      );
      return { statusCode: 200, body: "ok" };
    }

    const selectedListing = session.listings[listingIndex];
    session.answers.selected_listing_index = listingIndex;
    session.answers.selected_listing_id = selectedListing.listingId;
    session.answers.selected_listing_address = selectedListing.address;
    session.currentScreen = "APPOINTMENT_DATE";
    await saveUserSession(message.from, session);

    const dateOptions = getNextSevenDays();
    const nextScreen = {
      ...FLOW.APPOINTMENT_DATE,
      options: dateOptions.map((d, i) => `${i + 1}. ${d.display}`),
    };
    await sendWhatsAppMessage(
      message.from,
      renderScreen(nextScreen, session.answers),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  // ---- Handle dynamic date selection ----
  if (screen.inputType === "dynamic_date") {
    const dateOptions = getNextSevenDays();

    if (
      isNaN(userNumber) ||
      userNumber < 1 ||
      userNumber > dateOptions.length
    ) {
      await sendWhatsAppMessage(
        message.from,
        `❌ Invalid selection. Please enter a number between 1 and ${dateOptions.length}.`,
        config
      );
      return { statusCode: 200, body: "ok" };
    }

    const selectedDate = dateOptions[userNumber - 1];
    session.answers.appointment_date_display = selectedDate.display;
    session.answers.appointment_date_iso = selectedDate.iso;
    session.currentScreen = "APPOINTMENT_TIME";
    await saveUserSession(message.from, session);

    await sendWhatsAppMessage(
      message.from,
      renderScreen(FLOW.APPOINTMENT_TIME, session.answers),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  // ---- Handle REVIEW screen (search trigger) ----
  if (screen.id === "REVIEW" && userNumber === 1) {
    const intent = normalizeSearchParams({
      ...session.answers,
      is_search: true,
      location: session.answers.location,
      property_type: session.answers.property_type?.toLowerCase(),
      bedrooms: session.answers.bedrooms
        ? parseInt(session.answers.bedrooms)
        : null,
    });

    console.log("Search Intent:", JSON.stringify(intent));

    const listings = intent.location ? await getListingsFromDB(intent) : [];

    console.log(`Listings Found: ${listings.length}`);

    if (listings.length > 0) {
      const userQuery = `Show me ${session.answers.bedrooms || "any"}-bedroom ${
        session.answers.property_type || "property"
      } in ${session.answers.location || "any location"}`;

      const reply = await formatResponse(userQuery, listings, config.gptKey);
      await sendWhatsAppMessage(message.from, reply, config);
      await saveSearch(message.from, intent);

      session.listings = listings;
      session.currentScreen = "SELECT_LISTING";
      await saveUserSession(message.from, {
        currentScreen: session.currentScreen,
        answers: session.answers,
        listings: session.listings,
      });

      await sendWhatsAppMessage(
        message.from,
        renderScreen(FLOW.SELECT_LISTING, session.answers),
        config
      );
    } else {
      session.currentScreen = "NO_LISTINGS_FOUND";
      await saveUserSession(message.from, session);

      await sendWhatsAppMessage(
        message.from,
        renderScreen(FLOW.NO_LISTINGS_FOUND, {}),
        config
      );
    }

    return { statusCode: 200, body: "ok" };
  }

  // ---- Handle CONFIRM_APPOINTMENT (booking trigger) ----
  if (screen.id === "CONFIRM_APPOINTMENT" && userNumber === 1) {
    const appointmentData = {
      userId: message.from,
      listingId: session.answers.selected_listing_id,
      address: session.answers.selected_listing_address,
      dateDisplay: session.answers.appointment_date_display,
      dateISO: session.answers.appointment_date_iso,
      time: session.answers.appointment_time,
      name: session.answers.contact_name,
      timestamp: new Date().toISOString(),
    };

    await saveAppointment(appointmentData);

    session.currentScreen = "APPOINTMENT_CONFIRMED";
    session.answers = {}; // Clear answers after booking
    await saveUserSession(message.from, session);

    await sendWhatsAppMessage(
      message.from,
      renderScreen(FLOW.APPOINTMENT_CONFIRMED, session.answers),
      config
    );

    return { statusCode: 200, body: "ok" };
  }

  // ---- Validate numbered input ----
  if (screen.numbered) {
    if (isNaN(userNumber)) {
      await sendWhatsAppMessage(
        message.from,
        "❌ Please enter a valid number.\n\n" +
          renderScreen(screen, session.answers),
        config
      );
      return { statusCode: 200, body: "ok" };
    }

    const nextScreen = screen.next?.[userNumber];

    if (!nextScreen) {
      await sendWhatsAppMessage(
        message.from,
        `❌ Invalid option. Please select a number from the options.\n\n` +
          renderScreen(screen, session.answers),
        config
      );
      return { statusCode: 200, body: "ok" };
    }

    // Save answer if screen has storeKey and valueMap
    if (screen.storeKey && screen.valueMap) {
      session.answers[screen.storeKey] = screen.valueMap[userNumber];
    }

    // Move to next screen
    session.currentScreen = nextScreen;
    await saveUserSession(message.from, {
      currentScreen: session.currentScreen,
      answers: session.answers,
      listings: session.listings,
    });

    const newScreen = FLOW[session.currentScreen];
    await sendWhatsAppMessage(
      message.from,
      renderScreen(newScreen, session.answers),
      config
    );

    return { statusCode: 200, body: "ok" };
  }

  // ---- Fallback for unhandled cases ----
  await sendWhatsAppMessage(
    message.from,
    "❌ Something went wrong. Type 'menu' to return to main menu.",
    config
  );
  return { statusCode: 200, body: "ok" };
}

module.exports = { webhookHandler };
