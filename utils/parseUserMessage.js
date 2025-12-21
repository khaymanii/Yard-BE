function extractIncomingMessage(payload) {
  const value = payload?.entry?.[0]?.changes?.[0]?.value;

  // ❌ Ignore delivery / read status updates
  if (value?.statuses) return null;

  const message = value?.messages?.[0];

  // ❌ Ignore anything that isn't a text message
  if (!message || message.type !== "text") return null;

  return message;
}

module.exports = {
  extractIncomingMessage,
};
