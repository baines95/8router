import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/localDb.ts", () => ({
  getProviderConnections: vi.fn(),
  getProviderConnectionById: vi.fn(),
  updateProviderConnection: vi.fn(),
  validateApiKey: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("../../src/lib/network/connectionProxy.ts", () => ({
  resolveConnectionProxyConfig: vi.fn().mockResolvedValue({
    endpoint: "",
    connectionProxyUrl: "",
    connectionNoProxy: false,
    proxyPoolId: null,
    vercelRelayUrl: "",
  }),
}));

vi.mock("../../src/sse/utils/logger.ts", () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

import * as log from "../../src/sse/utils/logger.ts";
import { BACKOFF_CONFIG } from "../../src/lib/open-sse/config/errorConfig.ts";
import { markAccountUnavailable, getProviderCredentials, clearAccountError, reconcileConnectionQuotaPause } from "../../src/sse/services/auth.ts";
import { getProviderConnections, getProviderConnectionById, updateProviderConnection, getSettings } from "../../src/lib/localDb.ts";
import { createErrorResult, parseUpstreamError } from "../../src/lib/open-sse/utils/error.ts";

describe("markAccountUnavailable cooldown reset timing", () => {
  const nowMs = Date.parse("2026-04-26T10:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(nowMs);
    vi.mocked(getProviderConnections).mockResolvedValue([
      {
        id: "conn-1",
        provider: "openai",
        displayName: "Primary",
        backoffLevel: 0,
      },
    ]);
    vi.mocked(getSettings).mockResolvedValue({});
    vi.mocked(updateProviderConnection).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("uses resetsAtMs when provided and in the future", async () => {
    const resetsAtMs = nowMs + 45_000;

    const result = await markAccountUnavailable(
      "conn-1",
      429,
      "rate limit",
      "openai",
      "gpt-4o-mini",
      resetsAtMs,
    );

    expect(result.shouldFallback).toBe(true);
    expect(result.cooldownMs).toBe(45_000);

    const payload = vi.mocked(updateProviderConnection).mock.calls[0][1];
    const lockExpiry = Date.parse(payload["modelLock_gpt-4o-mini"]);
    expect(lockExpiry - nowMs).toBe(45_000);
  });

  it("caps reset-based cooldown at BACKOFF_CONFIG.max", async () => {
    const resetsAtMs = nowMs + 24 * 60 * 60 * 1000;

    const result = await markAccountUnavailable(
      "conn-1",
      429,
      "rate limit",
      "openai",
      "gpt-4o-mini",
      resetsAtMs,
    );

    expect(result.cooldownMs).toBe(BACKOFF_CONFIG.max);

    const payload = vi.mocked(updateProviderConnection).mock.calls[0][1];
    const lockExpiry = Date.parse(payload["modelLock_gpt-4o-mini"]);
    expect(lockExpiry - nowMs).toBe(BACKOFF_CONFIG.max);
  });

  it("keeps old backoff behavior when resetsAtMs is missing", async () => {
    const result = await markAccountUnavailable(
      "conn-1",
      429,
      "rate limit",
      "openai",
      "gpt-4o-mini",
    );

    expect(result.shouldFallback).toBe(true);
    expect(result.cooldownMs).toBe(1_000);

    const payload = vi.mocked(updateProviderConnection).mock.calls[0][1];
    const lockExpiry = Date.parse(payload["modelLock_gpt-4o-mini"]);
    expect(lockExpiry - nowMs).toBe(1_000);
    expect(log.warn).toHaveBeenCalledWith(
      "AUTH",
      expect.stringContaining(" LOCK provider=openai model=gpt-4o-mini mode=fill-first account=Primary (conn-1) status=429 lockKey=modelLock_gpt-4o-mini cooldownSource=backoff cooldownUntil="),
    );
  });

  it("logs retry-after as cooldown source when resetsAtMs drives the lock", async () => {
    const resetsAtMs = nowMs + 45_000;

    await markAccountUnavailable(
      "conn-1",
      429,
      "rate limit",
      "openai",
      "gpt-4o-mini",
      resetsAtMs,
    );

    expect(log.warn).toHaveBeenCalledWith(
      "AUTH",
      expect.stringContaining(" LOCK provider=openai model=gpt-4o-mini mode=fill-first account=Primary (conn-1) status=429 lockKey=modelLock_gpt-4o-mini cooldownSource=retry-after cooldownUntil="),
    );
  });

  it("keeps old backoff behavior when resetsAtMs is in the past", async () => {
    const result = await markAccountUnavailable(
      "conn-1",
      429,
      "rate limit",
      "openai",
      "gpt-4o-mini",
      nowMs - 1,
    );

    expect(result.cooldownMs).toBe(1_000);

    const payload = vi.mocked(updateProviderConnection).mock.calls[0][1];
    const lockExpiry = Date.parse(payload["modelLock_gpt-4o-mini"]);
    expect(lockExpiry - nowMs).toBe(1_000);
  });

  it("keeps old backoff behavior when resetsAtMs equals now", async () => {
    const result = await markAccountUnavailable(
      "conn-1",
      429,
      "rate limit",
      "openai",
      "gpt-4o-mini",
      nowMs,
    );

    expect(result.cooldownMs).toBe(1_000);

    const payload = vi.mocked(updateProviderConnection).mock.calls[0][1];
    const lockExpiry = Date.parse(payload["modelLock_gpt-4o-mini"]);
    expect(lockExpiry - nowMs).toBe(1_000);
  });

  it("keeps old backoff behavior when resetsAtMs is not finite", async () => {
    const result = await markAccountUnavailable(
      "conn-1",
      429,
      "rate limit",
      "openai",
      "gpt-4o-mini",
      Number.POSITIVE_INFINITY,
    );

    expect(result.cooldownMs).toBe(1_000);

    const payload = vi.mocked(updateProviderConnection).mock.calls[0][1];
    const lockExpiry = Date.parse(payload["modelLock_gpt-4o-mini"]);
    expect(lockExpiry - nowMs).toBe(1_000);
  });
});

describe("upstream reset metadata propagation", () => {
  it("captures resetsAtMs from Retry-After header on upstream 429", async () => {
    const nowMs = Date.parse("2026-04-26T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(nowMs);

    const response = new Response(JSON.stringify({ error: { message: "The usage limit has been reached" } }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "45",
      },
    });

    const parsed = await parseUpstreamError(response);
    const result = createErrorResult(parsed.statusCode, parsed.message, parsed.resetsAtMs);

    expect(parsed.statusCode).toBe(429);
    expect(parsed.resetsAtMs).toBe(nowMs + 45_000);
    expect(result.resetsAtMs).toBe(nowMs + 45_000);

    vi.useRealTimers();
  });
});

describe("account selection semantics regression harness", () => {
  const nowMs = Date.parse("2026-04-26T10:00:00.000Z");
  const autoPauseState = {
    autoPauseByQuota: true,
    autoPausedUntil: new Date(nowMs + 45_000).toISOString(),
    autoPauseReason: "quota",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(nowMs);
    vi.mocked(getSettings).mockResolvedValue({ comboStrategy: "fill-first" });
    vi.mocked(getProviderConnectionById).mockResolvedValue(null);
    vi.mocked(updateProviderConnection).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("mode 1: spec expects fresh chat to keep healthy fallback and avoid jumping back to primary too early", async () => {
    vi.mocked(getProviderConnections).mockResolvedValue([
      { id: "primary", provider: "openai", displayName: "Primary" },
      { id: "fallback", provider: "openai", displayName: "Fallback" },
    ]);

    const firstPick = await getProviderCredentials("openai", new Set(["primary"]), "gpt-4o-mini");
    expect(firstPick?.connectionName).toBe("Fallback");

    const nextChatPick = await getProviderCredentials("openai", null, "gpt-4o-mini");
    expect(nextChatPick?.connectionName).toBe("Fallback");
  });

  it("mode 2: round-robin should skip account on cooldown and select a live account using current selector state", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      comboStrategy: "fill-first",
      providerStrategies: {
        openai: {
          fallbackStrategy: "round-robin",
          stickyRoundRobinLimit: 1,
        },
      },
    });

    vi.mocked(getProviderConnections).mockResolvedValue([
      {
        id: "acc-a",
        provider: "openai",
        displayName: "A",
        lastUsedAt: "2026-04-26T09:59:00.000Z",
        consecutiveUseCount: 1,
      },
      {
        id: "acc-b",
        provider: "openai",
        displayName: "B",
        lastUsedAt: "2026-04-26T09:58:00.000Z",
        consecutiveUseCount: 0,
        "modelLock_gpt-4o-mini": "2099-01-01T00:00:00.000Z",
      },
      {
        id: "acc-c",
        provider: "openai",
        displayName: "C",
        lastUsedAt: "2026-04-26T09:57:00.000Z",
        consecutiveUseCount: 0,
      },
    ]);

    const selected = await getProviderCredentials("openai", null, "gpt-4o-mini");
    expect(selected?.connectionName).toBe("A");
  });

  it("cooldown visibility: success does not clear an active model lock before it expires", async () => {
    const futureLock = new Date(nowMs + 60_000).toISOString();
    vi.mocked(getProviderConnectionById).mockResolvedValue({
      id: "locked-acc",
      provider: "openai",
      displayName: "Locked",
      testStatus: "unavailable",
      lastError: "rate limit",
      "modelLock_gpt-4o-mini": futureLock,
    });

    await clearAccountError(
      "locked-acc",
      {
        _connection: {
          id: "locked-acc",
          testStatus: "unavailable",
          lastError: "rate limit",
          "modelLock_gpt-4o-mini": futureLock,
        },
      },
      "gpt-4o-mini",
    );

    expect(updateProviderConnection).not.toHaveBeenCalledWith(
      "locked-acc",
      expect.objectContaining({ "modelLock_gpt-4o-mini": null }),
    );
    expect(updateProviderConnection).not.toHaveBeenCalled();

    vi.mocked(getProviderConnections).mockResolvedValue([
      {
        id: "locked-acc",
        provider: "openai",
        displayName: "Locked",
        "modelLock_gpt-4o-mini": futureLock,
      },
      {
        id: "healthy-acc",
        provider: "openai",
        displayName: "Healthy",
      },
    ]);

    const selected = await getProviderCredentials("openai", null, "gpt-4o-mini");
    expect(selected?.connectionName).toBe("Healthy");
  });

  it("re-reads latest connection state before clearing status so stale snapshots do not wipe newer locks", async () => {
    const expiredLock = new Date(nowMs - 1_000).toISOString();
    const futureLock = new Date(nowMs + 60_000).toISOString();

    vi.mocked(getProviderConnectionById).mockResolvedValue({
      id: "conn-1",
      provider: "openai",
      displayName: "Primary",
      testStatus: "unavailable",
      lastError: "newer rate limit",
      "modelLock_gpt-4o-mini": futureLock,
    });

    await clearAccountError(
      "conn-1",
      {
        _connection: {
          id: "conn-1",
          provider: "openai",
          displayName: "Primary",
          testStatus: "unavailable",
          lastError: "stale error",
          "modelLock_gpt-4o-mini": expiredLock,
        },
      },
      "gpt-4o-mini",
    );

    expect(getProviderConnectionById).toHaveBeenCalledWith("conn-1");
    expect(updateProviderConnection).not.toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        testStatus: "active",
        lastError: null,
        lastErrorAt: null,
        backoffLevel: 0,
      }),
    );
    expect(updateProviderConnection).not.toHaveBeenCalled();
  });

  it("logs cleared lock keys when success clears expired locks", async () => {
    vi.mocked(getProviderConnectionById).mockResolvedValue({
      id: "conn-1",
      provider: "openai",
      displayName: "Primary",
      testStatus: "unavailable",
      lastError: "rate limit",
      "modelLock_gpt-4o-mini": new Date(nowMs - 1_000).toISOString(),
      "modelLock_gpt-4.1": new Date(nowMs - 500).toISOString(),
      modelLock_gpt_4o: new Date(nowMs + 60_000).toISOString(),
    });

    await clearAccountError(
      "conn-1",
      {
        _connection: {
          id: "conn-1",
          provider: "openai",
          displayName: "Primary",
          testStatus: "unavailable",
          lastError: "rate limit",
          "modelLock_gpt-4o-mini": new Date(nowMs - 1_000).toISOString(),
          "modelLock_gpt-4.1": new Date(nowMs - 500).toISOString(),
          modelLock_gpt_4o: new Date(nowMs + 60_000).toISOString(),
        },
      },
      "gpt-4o-mini",
    );

    expect(log.info).toHaveBeenCalledWith(
      "AUTH",
      expect.stringContaining(" CLEAR provider=openai model=gpt-4o-mini mode=fill-first account=Primary (conn-1) cleared=2 clearedKeys=modelLock_gpt-4o-mini,modelLock_gpt-4.1 remainingActiveLocks=1"),
    );
  });

  it("provider-level auto-pause disables the account when retry-after is available", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      comboStrategy: "fill-first",
      providerStrategies: {
        openai: {
          autoPauseByQuota: true,
        },
      },
    });
    vi.mocked(getProviderConnections).mockResolvedValue([
      {
        id: "conn-1",
        provider: "openai",
        displayName: "Primary",
        backoffLevel: 0,
      },
    ]);

    await markAccountUnavailable(
      "conn-1",
      429,
      "rate limit",
      "openai",
      "gpt-4o-mini",
      nowMs + 45_000,
    );

    expect(updateProviderConnection).toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        isActive: false,
        providerSpecificData: expect.objectContaining({
          autoPausedUntil: expect.any(String),
          autoPauseReason: "quota",
        }),
      }),
    );
  });

  it("provider-level auto-pause does not disable the account when the setting is off", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      comboStrategy: "fill-first",
      providerStrategies: {
        openai: {
          autoPauseByQuota: false,
        },
      },
    });
    vi.mocked(getProviderConnections).mockResolvedValue([
      {
        id: "conn-1",
        provider: "openai",
        displayName: "Primary",
        backoffLevel: 0,
      },
    ]);

    await markAccountUnavailable(
      "conn-1",
      429,
      "rate limit",
      "openai",
      "gpt-4o-mini",
      nowMs + 45_000,
    );

    expect(updateProviderConnection).not.toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        isActive: false,
      }),
    );
  });

  it("provider-level auto-pause does not disable the account when provider setting is missing", async () => {
    vi.mocked(getSettings).mockResolvedValue({ comboStrategy: "fill-first" });
    vi.mocked(getProviderConnections).mockResolvedValue([
      {
        id: "conn-1",
        provider: "openai",
        displayName: "Primary",
        backoffLevel: 0,
      },
    ]);

    await markAccountUnavailable(
      "conn-1",
      429,
      "rate limit",
      "openai",
      "gpt-4o-mini",
      nowMs + 45_000,
    );

    expect(updateProviderConnection).not.toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        isActive: false,
      }),
    );
  });

  it("legacy per-connection auto-pause flag no longer disables the account by itself", async () => {
    vi.mocked(getSettings).mockResolvedValue({ comboStrategy: "fill-first" });
    vi.mocked(getProviderConnections).mockResolvedValue([
      {
        id: "conn-1",
        provider: "openai",
        displayName: "Primary",
        backoffLevel: 0,
        providerSpecificData: {
          autoPauseByQuota: true,
        },
      },
    ]);

    await markAccountUnavailable(
      "conn-1",
      429,
      "rate limit",
      "openai",
      "gpt-4o-mini",
      nowMs + 45_000,
    );

    expect(updateProviderConnection).not.toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        isActive: false,
      }),
    );
  });

  it("auto-paused accounts are re-enabled when their quota pause expires", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      comboStrategy: "fill-first",
      providerStrategies: {
        openai: {
          autoPauseByQuota: true,
        },
      },
    });
    vi.mocked(getProviderConnections)
      .mockResolvedValueOnce([
        {
          id: "paused-acc",
          provider: "openai",
          displayName: "Paused",
          isActive: false,
          providerSpecificData: {
            ...autoPauseState,
            autoPausedUntil: new Date(nowMs - 1_000).toISOString(),
          },
        },
        {
          id: "healthy-acc",
          provider: "openai",
          displayName: "Healthy",
          isActive: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "paused-acc",
          provider: "openai",
          displayName: "Paused",
          isActive: true,
          providerSpecificData: {
            autoPausedUntil: null,
            autoPauseReason: null,
          },
        },
        {
          id: "healthy-acc",
          provider: "openai",
          displayName: "Healthy",
          isActive: true,
        },
      ]);

    const selected = await getProviderCredentials("openai", new Set(["healthy-acc"]), "gpt-4o-mini");

    expect(updateProviderConnection).toHaveBeenCalledWith(
      "paused-acc",
      expect.objectContaining({
        isActive: true,
        providerSpecificData: expect.objectContaining({
          autoPauseByQuota: true,
          autoPausedUntil: null,
          autoPauseReason: null,
        }),
      }),
    );
    expect(selected?.connectionName).toBe("Paused");
  });

  it("manual-off accounts are not re-enabled by the quota automation path", async () => {
    vi.mocked(getProviderConnections).mockResolvedValue([
      {
        id: "manual-off",
        provider: "openai",
        displayName: "Manual Off",
        isActive: false,
        providerSpecificData: {
          autoPauseByQuota: false,
          autoPausedUntil: new Date(nowMs - 1_000).toISOString(),
          autoPauseReason: "quota",
        },
      },
      {
        id: "healthy-acc",
        provider: "openai",
        displayName: "Healthy",
        isActive: true,
      },
    ]);

    const selected = await getProviderCredentials("openai", new Set(["manual-off"]), "gpt-4o-mini");

    expect(updateProviderConnection).not.toHaveBeenCalledWith(
      "manual-off",
      expect.objectContaining({ isActive: true }),
    );
    expect(selected?.connectionName).toBe("Healthy");
  });

  it("logs balanced scan skip and select events for selection", async () => {
    const futureLock = new Date(nowMs + 60_000).toISOString();

    vi.mocked(getProviderConnections).mockResolvedValue([
      {
        id: "locked-acc",
        provider: "openai",
        displayName: "Locked",
        "modelLock_gpt-4o-mini": futureLock,
      },
      {
        id: "healthy-acc",
        provider: "openai",
        displayName: "Healthy",
      },
    ]);

    await getProviderCredentials("openai", null, "gpt-4o-mini");

    expect(log.info).toHaveBeenCalledWith(
      "AUTH",
      expect.stringContaining("🧭 [r=")
    );
    expect(log.info).toHaveBeenCalledWith(
      "AUTH",
      expect.stringContaining(" SCAN provider=openai model=gpt-4o-mini mode=fill-first accounts=2 usable=1 skipped=1"),
    );
    expect(log.info).toHaveBeenCalledWith(
      "AUTH",
      expect.stringContaining("✅ [r=")
    );
    expect(log.info).toHaveBeenCalledWith(
      "AUTH",
      expect.stringContaining(" SELECT account=Healthy (healthy-")
    );
    expect(log.debug).toHaveBeenCalledWith(
      "AUTH",
      expect.stringContaining("⏭️ [r=")
    );
    expect(log.debug).toHaveBeenCalledWith(
      "AUTH",
      expect.stringContaining(" SKIP count=1 [Locked (locked-a):model-locked@")
    );
    expect(log.info).not.toHaveBeenCalledWith(
      "AUTH",
      expect.stringContaining("[AUTH r=")
    );
  });

  it("reconcileConnectionQuotaPause disables exhausted accounts until reset time", async () => {
    await reconcileConnectionQuotaPause(
      {
        id: "conn-1",
        provider: "openai",
        isActive: true,
      },
      {
        autoPauseByQuota: true,
        quotas: [
          {
            name: "primary",
            used: 100,
            total: 100,
            resetAt: "2026-04-26T10:05:00.000Z",
          },
        ],
      },
      nowMs,
    );

    expect(updateProviderConnection).toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        isActive: false,
        providerSpecificData: expect.objectContaining({
          autoPausedUntil: "2026-04-26T10:05:00.000Z",
          autoPauseReason: "quota",
        }),
      }),
    );
  });

  it("reconcileConnectionQuotaPause re-enables quota-paused accounts after reset time passes", async () => {
    await reconcileConnectionQuotaPause(
      {
        id: "conn-1",
        provider: "openai",
        isActive: false,
        providerSpecificData: {
          autoPausedUntil: "2026-04-26T09:59:00.000Z",
          autoPauseReason: "quota",
        },
      },
      {
        autoPauseByQuota: true,
        quotas: [
          {
            name: "primary",
            used: 100,
            total: 100,
            resetAt: "2026-04-26T09:59:00.000Z",
          },
        ],
      },
      nowMs,
    );

    expect(updateProviderConnection).toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        isActive: true,
        providerSpecificData: expect.objectContaining({
          autoPausedUntil: null,
          autoPauseReason: null,
        }),
      }),
    );
  });

  it("reconcileConnectionQuotaPause does not re-enable manual-off accounts", async () => {
    await reconcileConnectionQuotaPause(
      {
        id: "conn-1",
        provider: "openai",
        isActive: false,
        providerSpecificData: {},
      },
      {
        autoPauseByQuota: true,
        quotas: [
          {
            name: "primary",
            used: 100,
            total: 100,
            resetAt: "2026-04-26T09:59:00.000Z",
          },
        ],
      },
      nowMs,
    );

    expect(updateProviderConnection).not.toHaveBeenCalled();
  });

  it("reconcileConnectionQuotaPause does nothing when provider auto-pause is off", async () => {
    await reconcileConnectionQuotaPause(
      {
        id: "conn-1",
        provider: "openai",
        isActive: true,
      },
      {
        autoPauseByQuota: false,
        quotas: [
          {
            name: "primary",
            used: 100,
            total: 100,
            resetAt: "2026-04-26T10:05:00.000Z",
          },
        ],
      },
      nowMs,
    );

    expect(updateProviderConnection).not.toHaveBeenCalled();
  });

  it("reconcileConnectionQuotaPause returns disable summary when it auto-pauses an account", async () => {
    await expect(
      reconcileConnectionQuotaPause(
        {
          id: "conn-1",
          provider: "openai",
          isActive: true,
        },
        {
          autoPauseByQuota: true,
          quotas: [
            {
              name: "primary",
              used: 100,
              total: 100,
              resetAt: "2026-04-26T10:05:00.000Z",
            },
          ],
        },
        nowMs,
      ),
    ).resolves.toEqual({ action: "disabled", autoPausedUntil: "2026-04-26T10:05:00.000Z" });
  });

  it("reconcileConnectionQuotaPause returns enable summary when it auto-resumes an account", async () => {
    await expect(
      reconcileConnectionQuotaPause(
        {
          id: "conn-1",
          provider: "openai",
          isActive: false,
          providerSpecificData: {
            autoPausedUntil: "2026-04-26T09:59:00.000Z",
            autoPauseReason: "quota",
          },
        },
        {
          autoPauseByQuota: true,
          quotas: [
            {
              name: "primary",
              used: 100,
              total: 100,
              resetAt: "2026-04-26T09:59:00.000Z",
            },
          ],
        },
        nowMs,
      ),
    ).resolves.toEqual({ action: "enabled", autoPausedUntil: null });
  });

  it("reconcileConnectionQuotaPause returns a no-op summary when nothing changes", async () => {
    await expect(
      reconcileConnectionQuotaPause(
        {
          id: "conn-1",
          provider: "openai",
          isActive: true,
        },
        {
          autoPauseByQuota: true,
          quotas: [
            {
              name: "primary",
              used: 40,
              total: 100,
            },
          ],
        },
        nowMs,
      ),
    ).resolves.toEqual({ action: "none", autoPausedUntil: null });
  });
});
