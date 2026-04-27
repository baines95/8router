// Ensure proxyFetch is loaded to patch globalThis.fetch
import "@/lib/open-sse/index";

import { NextResponse } from "next/server";
import { getProviderConnections, getSettings, updateProviderConnection } from "@/lib/localDb";
import { getUsageForProvider } from "@/lib/open-sse/services/usage";
import { buildQuotaSnapshot } from "@/lib/usage/quotaSnapshot";
import { reconcileConnectionQuotaPause } from "@/sse/services/auth";
import { USAGE_SUPPORTED_PROVIDERS } from "@/shared/constants/providers";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: providerId } = await params;
    const settings = await getSettings();
    const autoPauseByQuota = settings?.providerStrategies?.[providerId]?.autoPauseByQuota === true;

    if (!autoPauseByQuota) {
      return NextResponse.json({ error: "Auto Pause is disabled for this provider" }, { status: 409 });
    }

    if (!USAGE_SUPPORTED_PROVIDERS.includes(providerId)) {
      return NextResponse.json({ error: "Provider does not support quota sync" }, { status: 400 });
    }

    const connections = await getProviderConnections({ provider: providerId });
    const oauthConnections = connections.filter((connection) => connection.authType === "oauth");
    const now = Date.now();

    let changed = 0;
    let disabled = 0;
    let enabled = 0;
    let skipped = 0;
    const errors: Array<{ connectionId: string; message: string }> = [];

    for (const connection of oauthConnections) {
      try {
        const usage = await getUsageForProvider(connection);
        const quotaSnapshot = buildQuotaSnapshot(connection.provider, usage, new Date(now).toISOString());

        await updateProviderConnection(connection.id, {
          providerSpecificData: {
            ...(connection.providerSpecificData || {}),
            quotaSnapshot,
          },
        });

        const result = await reconcileConnectionQuotaPause(connection, {
          autoPauseByQuota,
          quotaSnapshot,
        }, now);

        if (result.action === "disabled") {
          changed += 1;
          disabled += 1;
        } else if (result.action === "enabled") {
          changed += 1;
          enabled += 1;
        } else {
          skipped += 1;
        }
      } catch (error: any) {
        skipped += 1;
        errors.push({
          connectionId: connection.id,
          message: error?.message || "Failed to sync quota state",
        });
      }
    }

    return NextResponse.json({
      providerId,
      changed,
      disabled,
      enabled,
      skipped,
      errors,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to sync quota state" }, { status: 500 });
  }
}
