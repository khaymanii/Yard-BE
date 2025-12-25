const {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} = require("@aws-sdk/client-dynamodb");

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

// ✅ helper: remove undefined/null values
function cleanObject(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null)
  );
}

async function getUserSession(userId) {
  try {
    const res = await dynamoClient.send(
      new GetItemCommand({
        TableName: "UserFlowSessions",
        Key: { userId: { S: userId } },
      })
    );

    if (!res.Item) return null;

    return {
      currentScreen: res.Item.currentScreen?.S || "WELCOME",
      answers: res.Item.answers?.S ? JSON.parse(res.Item.answers.S) : {},
      listings: res.Item.listings?.S
        ? JSON.parse(res.Item.listings.S)
        : undefined,
    };
  } catch (error) {
    console.error("Error getting user session:", error);
    return null;
  }
}

async function saveUserSession(userId, session) {
  try {
    // If session is null, delete the session
    if (!session) {
      await dynamoClient.send(
        new DeleteItemCommand({
          TableName: "UserFlowSessions",
          Key: { userId: { S: userId } },
        })
      );
      return;
    }

    const cleanAnswers = cleanObject(session.answers || {});

    const item = {
      userId: { S: userId },
      currentScreen: { S: session.currentScreen || "WELCOME" },
      answers: { S: JSON.stringify(cleanAnswers) },
      timestamp: { S: new Date().toISOString() },
      ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) }, // 24h expiry
    };

    // ✅ Save listings if they exist
    if (
      session.listings &&
      Array.isArray(session.listings) &&
      session.listings.length > 0
    ) {
      item.listings = { S: JSON.stringify(session.listings) };
    }

    await dynamoClient.send(
      new PutItemCommand({
        TableName: "UserFlowSessions",
        Item: item,
      })
    );
  } catch (error) {
    console.error("Error saving user session:", error);
    throw error;
  }
}

module.exports = {
  getUserSession,
  saveUserSession,
};
