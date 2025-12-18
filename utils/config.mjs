export function getConfig() {
  return {
    whatsappPhoneId: process.env.WHATSAPP_PHONE_ID,
    whatsappToken: process.env.WHATSAPP_TOKEN,
    gptKey: process.env.GPT_API_KEY,
    verifyToken: process.env.VERIFY_TOKEN || "my_secret_token",
    region: process.env.AWS_REGION,
  };
}
