const {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
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
  const res = await dynamoClient.send(
    new GetItemCommand({
      TableName: "UserFlowSessions",
      Key: { userId: { S: userId } },
    })
  );

  if (!res.Item) return null;

  return {
    currentScreen: res.Item.currentScreen.S,
    answers: JSON.parse(res.Item.answers.S || "{}"),
    listings: res.Item.listings?.S
      ? JSON.parse(res.Item.listings.S)
      : undefined, // ← Load listings
  };
}

async function saveUserSession(userId, session) {
  const cleanAnswers = cleanObject(session.answers);

  const item = {
    userId: { S: userId },
    currentScreen: { S: session.currentScreen },
    answers: { S: JSON.stringify(cleanAnswers) },
    timestamp: { S: new Date().toISOString() },
  };

  // ✅ Save listings if they exist
  if (session.listings && session.listings.length > 0) {
    item.listings = { S: JSON.stringify(session.listings) };
  }

  await dynamoClient.send(
    new PutItemCommand({
      TableName: "UserFlowSessions",
      Item: item,
    })
  );
}

module.exports = {
  getUserSession,
  saveUserSession,
};
