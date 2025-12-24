const {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
} = require("@aws-sdk/client-dynamodb");

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-west-1",
});

async function isMessageProcessed(messageId) {
  const res = await dynamoClient.send(
    new GetItemCommand({
      TableName: "ProcessedMessages",
      Key: {
        messageId: { S: messageId },
      },
    })
  );

  return !!res.Item;
}

async function markMessageProcessed(messageId) {
  await dynamoClient.send(
    new PutItemCommand({
      TableName: "ProcessedMessages",
      Item: {
        messageId: { S: messageId },
        timestamp: { S: new Date().toISOString() },
        ttl: {
          N: String(Math.floor(Date.now() / 1000) + 86400), // 24 hours
        },
      },
    })
  );
}

async function saveSearch(userId, params) {
  await dynamoClient.send(
    new PutItemCommand({
      TableName: "UserSearchHistory",
      Item: {
        userId: { S: userId },
        timestamp: { S: new Date().toISOString() },
        query: { S: JSON.stringify(params) },
      },
    })
  );
}

async function getLastSearch(userId) {
  const res = await dynamoClient.send(
    new QueryCommand({
      TableName: "UserSearchHistory",
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: {
        ":u": { S: userId },
      },
      ScanIndexForward: false,
      Limit: 1,
    })
  );

  if (!res.Items || res.Items.length === 0) return null;

  const item = res.Items[0];

  return {
    timestamp: item.timestamp.S,
    query: JSON.parse(item.query.S),
  };
}

async function getListingsFromDB(searchParams) {
  const { location, bedrooms, bathrooms, max_price, min_price, property_type } =
    searchParams;

  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: "HouseListings",
      KeyConditionExpression: "#loc = :location",
      ExpressionAttributeNames: {
        "#loc": "location",
      },
      ExpressionAttributeValues: {
        ":location": { S: location },
      },
    })
  );

  let listings = (result.Items || []).map((item) => ({
    location: item.location.S,
    listingId: item.listingId.S,
    address: item.address.S,
    price: Number(item.price.N),
    beds: Number(item.beds.N),
    baths: Number(item.baths.N),
    sqft: Number(item.sqft.N),
    features: item.features?.SS || [],
    image: item.image?.S,
    property_type: item.property_type?.S,
  }));

  if (bedrooms) listings = listings.filter((h) => h.beds >= bedrooms);
  if (bathrooms) listings = listings.filter((h) => h.baths >= bathrooms);
  if (max_price) listings = listings.filter((h) => h.price <= max_price);
  if (min_price) listings = listings.filter((h) => h.price >= min_price);
  if (property_type)
    listings = listings.filter((h) => h.property_type === property_type);

  return listings;
}

async function saveAppointment(appointmentData) {
  await dynamoClient.send(
    new PutItemCommand({
      TableName: "Appointments",
      Item: {
        userId: { S: appointmentData.userId },
        appointmentId: { S: `${appointmentData.userId}-${Date.now()}` },
        listingId: { S: appointmentData.listingId },
        address: { S: appointmentData.address },
        date: { S: appointmentData.date },
        time: { S: appointmentData.time },
        name: { S: appointmentData.name },
        timestamp: { S: appointmentData.timestamp },
        status: { S: "pending" },
      },
    })
  );
}

module.exports = {
  isMessageProcessed,
  markMessageProcessed,
  saveSearch,
  getListingsFromDB,
  getLastSearch,
  saveAppointment,
};
