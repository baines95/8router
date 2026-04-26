import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/open-sse/utils/proxyFetch", () => ({
  proxyAwareFetch: vi.fn(),
}));

import { BaseExecutor } from "../../src/lib/open-sse/executors/base";
import { proxyAwareFetch } from "../../src/lib/open-sse/utils/proxyFetch";
import { DEFAULT_RETRY_CONFIG } from "../../src/lib/open-sse/config/runtimeConfig";

function makeResponse(status, body = "{}") {
  return new Response(body, { status, headers: { "Content-Type": "application/json" } });
}

describe("retry policy config", () => {
  it("defines status-aware retry policies for 502/503/504 with attempts and delay", () => {
    for (const status of [502, 503, 504]) {
      expect(DEFAULT_RETRY_CONFIG[status]).toEqual(
        expect.objectContaining({
          attempts: expect.any(Number),
          delayMs: expect.any(Number),
        })
      );
    }
  });
});

describe("BaseExecutor retry behavior", () => {
  let setTimeoutSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(proxyAwareFetch).mockReset();
    setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });

  it.each([
    [502, 111],
    [503, 222],
    [504, 333],
  ])("retries HTTP %s using policy delay %sms", async (status, delayMs) => {
    vi.mocked(proxyAwareFetch)
      .mockResolvedValueOnce(makeResponse(status))
      .mockResolvedValueOnce(makeResponse(200));

    const executor = new BaseExecutor("test", {
      baseUrl: "https://example.com/v1/chat/completions",
      retry: {
        [status]: { attempts: 1, delayMs },
      },
    });

    const execution = executor.execute({
      model: "test-model",
      body: { messages: [{ role: "user", content: "hello" }] },
      stream: false,
      credentials: { apiKey: "sk-test" },
      proxyOptions: null,
    });

    await vi.runAllTimersAsync();
    const result = await execution;

    expect(result.response.status).toBe(200);
    expect(proxyAwareFetch).toHaveBeenCalledTimes(2);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), delayMs);
  });

  it("retries once on network exception using network retry policy", async () => {
    vi.mocked(proxyAwareFetch)
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(makeResponse(200));

    const executor = new BaseExecutor("test", {
      baseUrl: "https://example.com/v1/chat/completions",
      retry: {
        network: { attempts: 1, delayMs: 150 },
      },
    });

    const execution = executor.execute({
      model: "test-model",
      body: { messages: [{ role: "user", content: "hello" }] },
      stream: false,
      credentials: { apiKey: "sk-test" },
      proxyOptions: null,
    });

    const guarded = execution.catch((error) => error);
    await vi.runAllTimersAsync();
    const result = await guarded;

    expect(result.response.status).toBe(200);
    expect(proxyAwareFetch).toHaveBeenCalledTimes(2);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 150);
  });

  it("keeps HTTP 502 retry quota independent from network retry quota on same URL", async () => {
    vi.mocked(proxyAwareFetch)
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(makeResponse(502))
      .mockResolvedValueOnce(makeResponse(200));

    const executor = new BaseExecutor("test", {
      baseUrl: "https://example.com/v1/chat/completions",
      retry: {
        network: { attempts: 1, delayMs: 120 },
        502: { attempts: 1, delayMs: 220 },
      },
    });

    const execution = executor.execute({
      model: "test-model",
      body: { messages: [{ role: "user", content: "hello" }] },
      stream: false,
      credentials: { apiKey: "sk-test" },
      proxyOptions: null,
    });

    await vi.runAllTimersAsync();
    const result = await execution;

    expect(result.response.status).toBe(200);
    expect(proxyAwareFetch).toHaveBeenCalledTimes(3);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 120);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 220);
  });

  it("does not retry 429 on same URL and falls back to next URL", async () => {
    vi.mocked(proxyAwareFetch)
      .mockResolvedValueOnce(makeResponse(429))
      .mockResolvedValueOnce(makeResponse(200));

    const executor = new BaseExecutor("test", {
      baseUrls: [
        "https://primary.example.com/v1/chat/completions",
        "https://fallback.example.com/v1/chat/completions",
      ],
      retry: {
        429: { attempts: 3, delayMs: 999 },
      },
    });

    const result = await executor.execute({
      model: "test-model",
      body: { messages: [{ role: "user", content: "hello" }] },
      stream: false,
      credentials: { apiKey: "sk-test" },
      proxyOptions: null,
    });

    expect(result.response.status).toBe(200);
    expect(proxyAwareFetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(proxyAwareFetch).mock.calls[0][0]).toBe(
      "https://primary.example.com/v1/chat/completions"
    );
    expect(vi.mocked(proxyAwareFetch).mock.calls[1][0]).toBe(
      "https://fallback.example.com/v1/chat/completions"
    );
    expect(setTimeout).not.toHaveBeenCalledWith(expect.any(Function), 999);
  });

  it("does not retry non-retriable status and returns response without fallback", async () => {
    vi.mocked(proxyAwareFetch).mockResolvedValueOnce(makeResponse(400));

    const executor = new BaseExecutor("test", {
      baseUrls: [
        "https://primary.example.com/v1/chat/completions",
        "https://fallback.example.com/v1/chat/completions",
      ],
      retry: {
        400: { attempts: 0, delayMs: 0 },
      },
    });

    const result = await executor.execute({
      model: "test-model",
      body: { messages: [{ role: "user", content: "hello" }] },
      stream: false,
      credentials: { apiKey: "sk-test" },
      proxyOptions: null,
    });

    expect(result.response.status).toBe(400);
    expect(proxyAwareFetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(proxyAwareFetch).mock.calls[0][0]).toBe(
      "https://primary.example.com/v1/chat/completions"
    );
    expect(setTimeout).not.toHaveBeenCalled();
  });
});
