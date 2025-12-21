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
You are an intent extraction engine for a real estate search system.

Return ONLY valid JSON and nothing else.

Rules:
- Do NOT explain.
- Do NOT include markdown.
- Do NOT infer values the user did not explicitly state.
- If a value is not mentioned, return null.
- Normalize all numbers to plain integers (no commas).
- Prices are in Naira unless explicitly stated otherwise.
- Convert phrases like "under", "below", "max" to max_price.
- Convert phrases like "above", "from", "minimum" to min_price.
- If the user is asking to see, list, find, show, search, or browse properties, is_search must be true.
- If the message is conversational (greeting, thanks, unrelated), is_search must be false.
- If is_search is true and no limit is mentioned, default limit to 3.
- Features should be extracted as lowercase keywords (e.g. "parking", "pool", "furnished").
- Location should be the most specific place mentioned. If unclear, return null.

Return JSON in this exact shape:
{
  "is_search": boolean,
  "location": string | null,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "max_price": number | null,
  "min_price": number | null,
  "features": string[],
  "limit": number | null
}
`,
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
            `${i + 1}.
Listing ID: ${h.listingId}
Address: ${h.address}
Location: ${h.location}
Price: $${h.price.toLocaleString()}
Beds: ${h.beds}
Baths: ${h.baths}
Sqft: ${h.sqft}
Property Type: ${h.property_type}
Image: ${h.image}
`
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
