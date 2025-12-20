function extractLLMText(data) {
  const msg = data?.choices?.[0]?.message;
  if (!msg) return null;

  if (typeof msg.content === "string") return msg.content;

  if (Array.isArray(msg.content)) {
    return msg.content
      .map((c) => c.text)
      .filter(Boolean)
      .join("")
      .trim();
  }

  return null;
}

async function extractIntent(userText, gptKey) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gptKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `
Return ONLY valid JSON:
{
  "is_search": boolean,
  "location": string | null,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "max_price": number | null,
  "min_price": number | null,
  "features": string[],
  "limit": number | null
}`,
          },
          { role: "user", content: userText },
        ],
      }),
    });

    const data = await res.json();
    const text = extractLLMText(data);

    if (!text) return { is_search: false };

    return JSON.parse(text);
  } catch (err) {
    console.error("extractIntent error:", err);
    return { is_search: false };
  }
}

async function formatResponse(userText, listings, gptKey) {
  const houseText = listings.length
    ? listings
        .map(
          (h, i) =>
            `${i + 1}. ${h.address}, ${h.location}
💰 $${h.price.toLocaleString()}
🛏️ ${h.beds} beds | 🚿 ${h.baths} baths
📏 ${h.sqft} sqft
🏠 ${h.property_type}
🖼️ ${h.image}`
        )
        .join("\n\n")
    : "";

  const messages = [
    {
      role: "system",
      content: "You are a friendly WhatsApp real estate assistant.",
    },
  ];

  if (houseText) {
    messages.push({
      role: "system",
      content: `Listings:\n${houseText}`,
    });
  }

  messages.push({ role: "user", content: userText });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gptKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-3.5-turbo",
      temperature: 0.8,
      messages,
    }),
  });

  const data = await res.json();

  return extractLLMText(data) || houseText || "Hey 👋 How can I help?";
}

module.exports = {
  extractIntent,
  formatResponse,
};
