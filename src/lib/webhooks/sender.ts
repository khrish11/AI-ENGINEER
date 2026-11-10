import { getWebhooksForEvent } from "./store";

export async function triggerWebhook(event: string, data: any) {
  const webhooks = getWebhooksForEvent(event);

  for (const webhook of webhooks) {
    try {
      const signature = generateSignature(data, webhook.secret);

      await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": event,
          "X-Webhook-Signature": signature,
          "X-Webhook-Timestamp": Date.now().toString(),
        },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error(`Failed to trigger webhook ${webhook.id}:`, error);
    }
  }
}

function generateSignature(data: any, secret: string): string {
  const crypto = require("crypto");
  const payload = JSON.stringify(data);
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}
