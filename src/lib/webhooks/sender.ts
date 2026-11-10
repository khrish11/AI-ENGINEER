import { getWebhooksForEvent } from "./store";

export async function triggerWebhook(event: string, data: any) {
  const webhooks = getWebhooksForEvent(event);

  for (const webhook of webhooks) {
    try {
      // SSRF Protection: Validate webhook URL
      if (!isValidWebhookUrl(webhook.url)) {
        console.error(`Invalid webhook URL for ${webhook.id}: ${webhook.url}`);
        continue;
      }

      const signature = generateSignature(data, webhook.secret);

      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": event,
          "X-Webhook-Signature": signature,
          "X-Webhook-Timestamp": Date.now().toString(),
        },
        body: JSON.stringify(data),
        // Timeout to prevent hanging on malicious endpoints
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        console.error(`Webhook ${webhook.id} returned ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to trigger webhook ${webhook.id}:`, error);
    }
  }
}

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow HTTPS (or localhost for development)
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return false;
    }

    // Block private/internal IPs
    const hostname = parsed.hostname;
    const privateIPs = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|0\.|169\.254\.)/;
    if (privateIPs.test(hostname)) {
      return false;
    }

    // Block metadata endpoints
    if (hostname === "metadata.google.internal" || hostname === "169.254.169.254") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function generateSignature(data: any, secret: string): string {
  const crypto = require("crypto");
  const payload = JSON.stringify(data);
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}
