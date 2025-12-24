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

  return (
    text +
    "\n\nReply with one option:\n" +
    screen.options.map((o) => `- ${o}`).join("\n")
  );
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
    days.push(formatted);
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

  // ---- Handle free text inputs (name, listing selection) ----
  if (screen.id === "CONTACT_INFO") {
    session.answers.contact_name = userText;
    session.currentScreen = "CONFIRM_APPOINTMENT";
    await saveUserSession(message.from, session);

    const nextScreen = FLOW.CONFIRM_APPOINTMENT;
    await sendWhatsAppMessage(
      message.from,
      renderScreen(nextScreen, session.answers),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  if (screen.id === "SELECT_LISTING") {
    const listingIndex = parseInt(userText) - 1;

    if (
      isNaN(listingIndex) ||
      listingIndex < 0 ||
      listingIndex >= (session.listings?.length || 0)
    ) {
      await sendWhatsAppMessage(
        message.from,
        "Invalid selection. Please enter a valid listing number.",
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

    // Generate date options dynamically
    const dateOptions = getNextSevenDays();
    const nextScreen = { ...FLOW.APPOINTMENT_DATE, options: dateOptions };
    await sendWhatsAppMessage(
      message.from,
      renderScreen(nextScreen, session.answers),
      config
    );
    return { statusCode: 200, body: "ok" };
  }

  // ---- Handle dynamic date selection ----
  if (screen.id === "APPOINTMENT_DATE") {
    const dateOptions = getNextSevenDays();
    if (dateOptions.some((d) => d.toLowerCase() === normalizedInput)) {
      session.answers.appointment_date = dateOptions.find(
        (d) => d.toLowerCase() === normalizedInput
      );
      session.currentScreen = "APPOINTMENT_TIME";
      await saveUserSession(message.from, session);

      await sendWhatsAppMessage(
        message.from,
        renderScreen(FLOW.APPOINTMENT_TIME, session.answers),
        config
      );
      return { statusCode: 200, body: "ok" };
    } else {
      await sendWhatsAppMessage(
        message.from,
        "Invalid date. Please select from the options provided.",
        config
      );
      return { statusCode: 200, body: "ok" };
    }
  }

  // ---- Validate input ----
  const optionMap = {};
  screen.options?.forEach((o) => (optionMap[o.toLowerCase()] = o));

  if (
    screen.options &&
    screen.options.length > 0 &&
    !optionMap[normalizedInput]
  ) {
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

  // ---- HANDLE SUBMIT: fetch listings & GPT formatting ----
  if (screen.id === "REVIEW" && normalizedInput === "submit") {
    const intent = normalizeSearchParams({
      ...session.answers,
      is_search: true,
      // Keep location in Title Case to match DB format
      location: session.answers.location,
      // Normalize property_type to lowercase to match DB format
      property_type: session.answers.property_type?.toLowerCase(),
      // Parse bedrooms as number
      bedrooms: session.answers.bedrooms
        ? parseInt(session.answers.bedrooms)
        : null,
    });

    console.log("Search Intent:", JSON.stringify(intent));

    const listings = intent.location ? await getListingsFromDB(intent) : [];

    console.log(`Listings Found: ${listings.length}`);
    if (listings.length > 0) {
      console.log("Sample Listing:", JSON.stringify(listings[0]));
    }

    const userQuery = `Show me ${session.answers.bedrooms || "any"}-bedroom ${
      session.answers.property_type || "property"
    } in ${session.answers.location || "any location"}`;

    const reply = await formatResponse(userQuery, listings, config.gptKey);
    await sendWhatsAppMessage(message.from, reply, config);
    await saveSearch(message.from, intent);

    // Store listings in session and move to listing selection
    if (listings.length > 0) {
      session.listings = listings;
      session.currentScreen = "SELECT_LISTING";
      await saveUserSession(message.from, session);

      await sendWhatsAppMessage(
        message.from,
        renderScreen(FLOW.SELECT_LISTING, session.answers),
        config
      );
    } else {
      // No listings found - restart search
      session = { currentScreen: "LOCATION", answers: {} };
      await saveUserSession(message.from, session);

      await sendWhatsAppMessage(
        message.from,
        "No properties found matching your criteria. Let's try another search.",
        config
      );
      await sendWhatsAppMessage(
        message.from,
        renderScreen(FLOW.LOCATION, {}),
        config
      );
    }

    return { statusCode: 200, body: "ok" };
  }

  // ---- HANDLE APPOINTMENT CONFIRMATION ----
  if (screen.id === "CONFIRM_APPOINTMENT" && normalizedInput === "confirm") {
    // Save appointment to database
    const appointmentData = {
      userId: message.from,
      listingId: session.answers.selected_listing_id,
      address: session.answers.selected_listing_address,
      date: session.answers.appointment_date,
      time: session.answers.appointment_time,
      name: session.answers.contact_name,
      timestamp: new Date().toISOString(),
    };

    await saveAppointment(appointmentData);

    session.currentScreen = "APPOINTMENT_CONFIRMED";
    await saveUserSession(message.from, session);

    await sendWhatsAppMessage(
      message.from,
      renderScreen(FLOW.APPOINTMENT_CONFIRMED, session.answers),
      config
    );

    return { statusCode: 200, body: "ok" };
  }

  // ---- Move to next screen ----
  session.currentScreen = screen.next?.[selectedOption] || screen.id;
  await saveUserSession(message.from, {
    currentScreen: session.currentScreen,
    answers: session.answers,
    listings: session.listings,
  });

  screen = FLOW[session.currentScreen];

  // ---- Render next screen ----
  await sendWhatsAppMessage(
    message.from,
    renderScreen(screen, session.answers),
    config
  );
  return { statusCode: 200, body: "ok" };
}

module.exports = { webhookHandler };
