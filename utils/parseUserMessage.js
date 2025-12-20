function extractIncomingMessage(payload) {
  return payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] || null;
}

module.exports = {
  extractIncomingMessage,
};
