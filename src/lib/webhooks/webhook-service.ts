import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { isValidWebhookUrl } from "./sender";

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  lastTriggeredAt: Date | null;
  failureCount: number;
  lastFailureAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function createWebhook(
  userId: string,
  url: string,
  events: string[]
): Promise<Webhook> {
  const secret = randomBytes(32).toString("hex");

  if (!(await isValidWebhookUrl(url))) {
    throw new Error("Invalid webhook URL");
  }

  const [webhook] = await db
    .insert(webhooks)
    .values({
      userId,
      url,
      events: events.join(","),
      secret,
    })
    .returning();

  return {
    ...webhook,
    events: events,
  };
}

export async function listWebhooks(userId: string): Promise<Webhook[]> {
  const webhooksList = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.userId, userId))
    .orderBy(desc(webhooks.createdAt));

  return webhooksList.map((w) => ({
    ...w,
    events: w.events.split(",") as string[],
  }));
}

export async function deleteWebhook(userId: string, webhookId: string): Promise<boolean> {
  const result = await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)));

  return result.length > 0;
}

export async function getWebhooksForEvent(event: string): Promise<Array<Webhook & { secret: string }>> {
  const webhooksList = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.isActive, true));

  return webhooksList
    .filter((w) => w.events.split(",").includes(event))
    .map((w) => ({
      ...w,
      events: w.events.split(",") as string[],
    }));
}

export async function recordWebhookTrigger(webhookId: string): Promise<void> {
  await db
    .update(webhooks)
    .set({
      lastTriggeredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, webhookId));
}

export async function recordWebhookFailure(webhookId: string): Promise<void> {
  await db
    .update(webhooks)
    .set({
      failureCount: sql`${webhooks.failureCount} + 1`,
      lastFailureAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, webhookId));
}
