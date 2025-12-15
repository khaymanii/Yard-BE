import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

// AWS Clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

/** Get configuration from environment variables */
function getConfig() {
  return {
    whatsappPhoneId: process.env.WHATSAPP_PHONE_ID,
    whatsappToken: process.env.WHATSAPP_TOKEN,
    gptKey: process.env.GPT_API_KEY,
    realtorKey: process.env.REALTOR_API_KEY,
    verifyToken: process.env.VERIFY_TOKEN || "my_secret_token"
  };
}

/** ===============================
 * GPT INTENT EXTRACTION (NEW)
 * =============================== */
async function extractIntentWithGPT(userText: string, gptKey: string) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gptKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You are an intent extraction engine for a real estate WhatsApp bot.

Extract structured search intent from the user's message.
Return ONLY valid JSON. Do not add explanations.

JSON format:
{
  "location": string | null,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "max_price": number | null,
  "min_price": number | null,
  "property_type": "house" | "apartment" | "condo" | null,
  "features": string[],
  "limit": number | null
}`
          },
          {
            role: "user",
            content: userText
          }
        ]
      })
    }
  );

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

function normalizeSearchParams(params: any) {
  return {
    location: params.location || "",
    bedrooms: params.bedrooms ? Number(params.bedrooms) : null,
    bathrooms: params.bathrooms ? Number(params.bathrooms) : null,
    max_price: params.max_price ? Number(params.max_price) : null,
    min_price: params.min_price ? Number(params.min_price) : null,
    property_type: params.property_type || null,
    features: Array.isArray(params.features) ? params.features : [],
    limit: params.limit || 5
  };
}

/** Regex fallback (kept for safety) */
function parseUserMessage(text: string) {
  if (!text) text = "";

  return {
    location: text.match(/in ([A-Za-z\s]+)/i)?.[1]?.trim() || "",
    bedrooms: text.match(/(\d+)[\s-]?bed/i)?.[1] || null,
    bathrooms: text.match(/(\d+)[\s-]?bath/i)?.[1] || null,
    max_price: text.match(/under (\d+)/i)?.[1] || null,
    min_price: null,
    property_type: null,
    features: [],
    limit: 5
  };
}

/** Deduplication helpers */
async function isMessageProcessed(messageId: string) {
  const result = await dynamoClient.send(
    new GetItemCommand({
      TableName: "ProcessedMessages",
      Key: { messageId: { S: messageId } }
    })
  );
  return !!result.Item;
}

async function markMessageProcessed(messageId: string) {
  await dynamoClient.send(
    new PutItemCommand({
      TableName: "ProcessedMessages",
      Item: {
        messageId: { S: messageId },
        timestamp: { S: new Date().toISOString() },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) }
      }
    })
  );
}

async function saveSearch(userId: string, params: any) {
  await dynamoClient.send(
    new PutItemCommand({
      TableName: "UserSearchHistory",
      Item: {
        userId: { S: userId },
        timestamp: { S: new Date().toISOString() },
        query: { S: JSON.stringify(params) }
      }
    })
  );
}
async function sendWhatsAppMessage(to: string, message: string, config: any) {
  const response = await fetch(
    `https://graph.facebook.com/v22.0/${config.whatsappPhoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.whatsappToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message }
      })
    }
  );
  
  // Add response checking
  const result = await response.json();
  console.log("WhatsApp API response:", result);
  
  if (!response.ok) {
    console.error("WhatsApp API error:", result);
    throw new Error(`WhatsApp API failed: ${JSON.stringify(result)}`);
  }
  
  return result;
}

/** ===============================
 * MAIN LAMBDA HANDLER
 * =============================== */
export const handler = async (event: any) => {
  console.log("Event received:", JSON.stringify(event, null, 2)); // <--- log full event

  const config = getConfig();
  console.log("Config loaded:", {
    whatsappPhoneId: config.whatsappPhoneId,
    whatsappToken: config.whatsappToken ? "SET" : "MISSING",
    verifyToken: config.verifyToken
  }); // <--- check env variables

  // Webhook verification
  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    console.log("GET query parameters:", q); // <--- log GET params
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] === config.verifyToken) {
      console.log("Webhook verified successfully");
      return { statusCode: 200, body: q["hub.challenge"] };
    }
    console.log("Webhook verification failed");
    return { statusCode: 403, body: "Verification failed" };
  }

  if (event.httpMethod !== "POST") {
    console.log("Invalid HTTP method:", event.httpMethod);
    return { statusCode: 405, body: "Method not allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
    console.log("Payload parsed successfully:", payload);
  } catch (err) {
    console.error("Error parsing payload:", err);
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  console.log("Extracted message:", message);

  if (!message) {
    console.log("No message found in payload");
    return { statusCode: 200, body: "No message" };
  }

  if (await isMessageProcessed(message.id)) {
    console.log("Duplicate message ignored:", message.id);
    return { statusCode: 200, body: "Duplicate ignored" };
  }

  await markMessageProcessed(message.id);
  console.log("Message marked as processed:", message.id);

  const from = message.from;
  const userText = message.text?.body || "";
  console.log("From:", from, "UserText:", userText);

  // GPT intent extraction with regex fallback
  let intent;
  try {
    intent = await extractIntentWithGPT(userText, config.gptKey);
    console.log("GPT intent extracted:", intent);
  } catch (e) {
    console.warn("GPT intent extraction failed, using regex fallback:", e);
    intent = parseUserMessage(userText);
    console.log("Fallback intent:", intent);
  }

  const searchParams = normalizeSearchParams(intent);
  console.log("Normalized search params:", searchParams);

  if (!searchParams.location) {
    console.log("Location missing, prompting user");
    await sendWhatsAppMessage(
      from,
      "Please tell me the location you want to search (e.g. '2 bed in New York under 500k').",
      config
    );
    return { statusCode: 200, body: "Location missing" };
  }

  await saveSearch(from, searchParams);
  console.log("Search saved for user:", from);

  // Realtor API
  const realtorUrl = "https://realtor-search.p.rapidapi.com/agents/v2/listings";
  let houses = [];

  try {
    const requestBody: any = {
      location: searchParams.location,
      status: ["for_sale"],
      sort: { direction: "desc", field: "list_date" },
      limit: searchParams.limit
    };

    if (searchParams.bedrooms) requestBody.beds_min = searchParams.bedrooms;
    if (searchParams.bathrooms) requestBody.baths_min = searchParams.bathrooms;
    if (searchParams.max_price) requestBody.price_max = searchParams.max_price;

    console.log("Sending request to Realtor API:", requestBody);
    const realtorRes = await fetch(realtorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-key": config.realtorKey,
        "x-rapidapi-host": "realtor-search.p.rapidapi.com"
      },
      body: JSON.stringify(requestBody)
    });

    if (realtorRes.ok) {
      const realtorData = await realtorRes.json();
      houses = realtorData?.data?.home_search?.results || [];
      console.log("Realtor API response:", houses);
    } else {
      console.error("Realtor API returned error status:", realtorRes.status);
      await sendWhatsAppMessage(from, "I'm having trouble searching right now. Please try again.", config);
      return { statusCode: 200, body: "API error" };
    }
  } catch (err) {
    console.error("Realtor API fetch error:", err);
    await sendWhatsAppMessage(from, "Search error occurred. Please try again.", config);
    return { statusCode: 200, body: "API error" };
  }

  let aiResponse = `I couldn't find any houses matching your criteria in ${searchParams.location}.

Try adjusting your search:
• Different location or nearby city
• Increase your budget
• Reduce bedroom/bathroom requirements

Need help? Just ask! 😊`;

  if (houses.length > 0) {
    const houseSummary = houses
      .slice(0, 5)
      .map((h: any, idx: number) =>
        `${idx + 1}. ${h.location?.address?.line || 'Address not available'}
💰 $${h.list_price?.toLocaleString() || 'N/A'}
🛏️ ${h.description?.beds || 'N/A'} beds | 🚿 ${h.description?.baths || 'N/A'} baths
📏 ${h.description?.sqft?.toLocaleString() || 'N/A'} sqft`
      )
      .join("");

    console.log("House summary to send:", houseSummary);

    try {
      const gptRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.gptKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are Yard, an AI-powered Housing Agent for WhatsApp. Format responses to be concise and mobile-friendly."
            },
            {
              role: "user",
              content: `Format these listings:\n\n${houseSummary}`
            }
          ]
        })
      });

      if (gptRes.ok) {
        const gptData = await gptRes.json();
        aiResponse = gptData?.choices?.[0]?.message?.content || houseSummary;
        console.log("GPT formatted response:", aiResponse);
      } else {
        console.error("GPT API returned error:", gptRes.status);
      }
    } catch (e) {
      console.error("GPT fetch error:", e);
      aiResponse = houseSummary;
    }
  }

  console.log("Sending WhatsApp message:", aiResponse);
  const sent = await sendWhatsAppMessage(from, aiResponse, config);
  console.log("Message sent result:", sent);

  return { statusCode: 200, body: "ok" };
};

