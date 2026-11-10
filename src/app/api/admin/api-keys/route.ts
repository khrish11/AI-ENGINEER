import { NextRequest, NextResponse } from "next/server";
import { generateApiKey, listApiKeys, revokeApiKey, rotateApiKey } from "@/lib/auth/api-keys-service";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdmin(userId: string): Promise<boolean> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user?.role === "admin";
}

// POST /api/admin/api-keys - Generate new API key (admin only)
export async function POST(request: NextRequest) {
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

  const isAdminUser = await isAdmin(session.user.id);
  if (!isAdminUser) {
    return NextResponse.json(
      {
        success: false,
        error: "Admin privileges required",
        code: "FORBIDDEN",
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { userId, name, scopes, expiresAt } = body;

    if (!userId || !name) {
      return NextResponse.json(
        { success: false, error: "userId and name are required" },
        { status: 400 }
      );
    }

    const apiKey = await generateApiKey(userId, name, scopes, expiresAt ? new Date(expiresAt) : undefined);

    return NextResponse.json({
      success: true,
      data: {
        id: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
        name: apiKey.name,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        secretKey: apiKey.secretKey,
        message: "Store this key securely. It will not be shown again.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate API key",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/admin/api-keys - List all API keys (admin only)
export async function GET(request: NextRequest) {
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

  const isAdminUser = await isAdmin(session.user.id);
  if (!isAdminUser) {
    return NextResponse.json(
      {
        success: false,
        error: "Admin privileges required",
        code: "FORBIDDEN",
      },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const keys = await listApiKeys(userId);

    return NextResponse.json({
      success: true,
      data: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        expiresAt: k.expiresAt,
        lastUsedAt: k.lastUsedAt,
        isRevoked: k.isRevoked,
        createdAt: k.createdAt,
      })),
      total: keys.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to list API keys",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/api-keys - Revoke an API key (admin only)
export async function DELETE(request: NextRequest) {
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

  const isAdminUser = await isAdmin(session.user.id);
  if (!isAdminUser) {
    return NextResponse.json(
      {
        success: false,
        error: "Admin privileges required",
        code: "FORBIDDEN",
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { userId, keyId } = body;

    if (!userId || !keyId) {
      return NextResponse.json(
        { success: false, error: "userId and keyId are required" },
        { status: 400 }
      );
    }

    const deleted = await revokeApiKey(userId, keyId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "API key not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to revoke API key",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

