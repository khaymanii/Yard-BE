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
  };
}

async function saveUserSession(userId, session) {
  const cleanAnswers = cleanObject(session.answers);

  await dynamoClient.send(
    new PutItemCommand({
      TableName: "UserFlowSessions",
      Item: {
        userId: { S: userId },
        currentScreen: { S: session.currentScreen },
        answers: { S: JSON.stringify(cleanAnswers) },
        timestamp: { S: new Date().toISOString() },
      },
    })
  );
}

module.exports = {
  getUserSession,
  saveUserSession,
};
