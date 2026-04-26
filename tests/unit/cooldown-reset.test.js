import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/localDb.ts", () => ({
  getProviderConnections: vi.fn(),
  updateProviderConnection: vi.fn(),
  validateApiKey: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("../../src/lib/network/connectionProxy.ts", () => ({
  resolveConnectionProxyConfig: vi.fn(),
}));

vi.mock("../../src/sse/utils/logger.ts", () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

import { BACKOFF_CONFIG } from "../../src/lib/open-sse/config/errorConfig.ts";
import { markAccountUnavailable } from "../../src/sse/services/auth.ts";
import { getProviderConnections, updateProviderConnection } from "../../src/lib/localDb.ts";

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
