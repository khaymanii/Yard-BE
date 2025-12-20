const { webhookHandler } = require("./webhook/webhookHandler");
const { getConfig } = require("./utils/config");

exports.handler = async (event) => {
  const config = getConfig();

  try {
    return await webhookHandler(event, config);
  } catch (err) {
    console.error("Error in Lambda:", err);

    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};
