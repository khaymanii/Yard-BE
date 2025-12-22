const {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb");

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

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
    answers: JSON.parse(res.Item.answers.S),
  };
}

async function saveUserSession(userId, session) {
  await dynamoClient.send(
    new PutItemCommand({
      TableName: "UserFlowSessions",
      Item: {
        userId: { S: userId },
        currentScreen: { S: session.currentScreen },
        answers: { S: JSON.stringify(session.answers) },
        timestamp: { S: new Date().toISOString() },
      },
    })
  );
}

module.exports = { getUserSession, saveUserSession };
