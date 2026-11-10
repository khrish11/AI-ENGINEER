import { NextRequest, NextResponse } from "next/server";
import { generateApiKey, listApiKeys, revokeApiKey, rotateApiKey } from "@/lib/auth/api-keys-service";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/user/api-keys - Generate new API key (authenticated user)
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

  try {
    const body = await request.json();
    const { name, scopes, expiresAt } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "name is required" },
        { status: 400 }
      );
    }

    const apiKey = await generateApiKey(session.user.id, name, scopes, expiresAt ? new Date(expiresAt) : undefined);

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

// GET /api/user/api-keys - List user's API keys
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
    const keys = await listApiKeys(session.user.id);

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

// DELETE /api/user/api-keys - Revoke an API key
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

  try {
    const body = await request.json();
    const { keyId } = body;

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: "keyId is required" },
        { status: 400 }
      );
    }

    const deleted = await revokeApiKey(session.user.id, keyId);

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
