import { NextResponse } from "next/server";
import {
  getProviderConnections,
  updateProviderConnection,
} from "@/lib/localDb";

function getActiveAutoPause(connection: any) {
  const until = connection?.providerSpecificData?.autoPausedUntil;
  if (!until) return null;

  const untilMs = new Date(until as string).getTime();
  if (!Number.isFinite(untilMs) || untilMs <= Date.now()) return null;

  return {
    model: "__all",
    until,
    reason: connection?.providerSpecificData?.autoPauseReason ?? null,
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const connections = await getProviderConnections();
    const models: any[] = [];

    for (const conn of connections as any[]) {
      const activePause = getActiveAutoPause(conn);
      if (!activePause) continue;

      models.push({
        provider: conn.provider,
        model: activePause.model,
        status: "cooldown",
        cooldownUntil: activePause.until,
        reason: activePause.reason,
      });
    }

    return NextResponse.json({ models });
  } catch (error) {
    console.error("[API] Failed to fetch provider pause availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch provider pause availability" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;
    const provider = body?.provider as string | undefined;
    const model = body?.model as string | undefined;

    if (action !== "clearCooldown" || !provider) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (model && model !== "__all") {
      return NextResponse.json(
        { error: "Model-scoped clear is not supported for provider-level pause state" },
        { status: 400 },
      );
    }

    const connections = await getProviderConnections({ provider });

    await Promise.all(
      connections
        .filter((connection: any) => connection?.providerSpecificData?.autoPausedUntil)
        .map((connection: any) =>
          updateProviderConnection(connection.id, {
            providerSpecificData: {
              ...(connection.providerSpecificData || {}),
              autoPausedUntil: null,
              autoPauseReason: null,
            },
            ...(connection.testStatus === "unavailable"
              ? {
                  testStatus: "active",
                  lastError: undefined,
                  lastErrorAt: undefined,
                  backoffLevel: 0,
                }
              : {}),
          }),
        ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[API] Failed to clear provider pause:", error);
    return NextResponse.json(
      { error: "Failed to clear provider pause" },
      { status: 500 },
    );
  }
}
