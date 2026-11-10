import { NextResponse } from "next/server";
import { createWebhook, listWebhooks, deleteWebhook } from "@/lib/webhooks/webhook-service";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/webhooks - Register a new webhook (authenticated user)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { url, events } = body;

    if (!url || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { success: false, error: "url and events array are required" },
        { status: 400 }
      );
    }

    // Validate events
    const validEvents = ["lesson.updated", "resource.added", "resource.verified", "project.added"];
    const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid events: ${invalidEvents.join(", ")}. Valid events: ${validEvents.join(", ")}` },
        { status: 400 }
      );
    }

    const webhook = await createWebhook(session.user.id, url, events);

    return NextResponse.json({
      success: true,
      data: {
        webhookId: webhook.id,
        url: webhook.url,
        events: webhook.events,
        message: "Webhook registered successfully",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to register webhook", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET /api/webhooks - List user's webhooks
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      },
      { status: 401 }
    );
  }

  try {
    const webhooks = await listWebhooks(session.user.id);

    return NextResponse.json({
      success: true,
      data: webhooks.map((w) => ({
        webhookId: w.id,
        url: w.url,
        events: w.events,
        isActive: w.isActive,
        lastTriggeredAt: w.lastTriggeredAt,
        failureCount: w.failureCount,
        createdAt: w.createdAt,
      })),
      total: webhooks.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to list webhooks", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/webhooks - Delete a webhook
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { webhookId } = body;

    if (!webhookId) {
      return NextResponse.json(
        { success: false, error: "webhookId is required" },
        { status: 400 }
      );
    }

    const deleted = await deleteWebhook(session.user.id, webhookId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Webhook not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Webhook deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete webhook", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
