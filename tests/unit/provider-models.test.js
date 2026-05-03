import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      status: init?.status || 200,
      body,
      json: async () => body,
    })),
  },
}));

vi.mock("../../src/lib/localDb.js", () => ({
  getProviderConnectionById: vi.fn(),
  getProviderConnections: vi.fn(),
}));

vi.mock("../../src/shared/constants/providers.js", async () => {
  const actual = await vi.importActual("../../src/shared/constants/providers.js");
  return {
    ...actual,
    isOpenAICompatibleProvider: vi.fn((provider) => provider === "openai"),
    isAnthropicCompatibleProvider: vi.fn(() => false),
  };
});

describe("GET /api/providers/[id]/models", () => {
  let GET;
  let getProviderConnectionById;
  let getProviderConnections;

  beforeEach(async () => {
    vi.clearAllMocks();

    const db = await import("../../src/lib/localDb.js");
    getProviderConnectionById = db.getProviderConnectionById;
    getProviderConnections = db.getProviderConnections;

    const routeModule = await import("../../src/app/api/providers/[id]/models/route.js");
    GET = routeModule.GET;
  });

  it("returns dynamic models when provider fetch succeeds", async () => {
    getProviderConnectionById.mockResolvedValue({
      id: "conn-openai",
      provider: "openai",
      apiKey: "test-key",
      providerSpecificData: { baseUrl: "https://api.openai.com/v1" },
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "gpt-dynamic-1", name: "GPT Dynamic 1" }] }),
    }));

    const response = await GET(new Request("http://localhost/api/providers/conn-openai/models"), {
      params: Promise.resolve({ id: "conn-openai" }),
    });

    expect(response.status).toBe(200);
    expect(response.body.models).toEqual([{ id: "gpt-dynamic-1", name: "GPT Dynamic 1" }]);
    expect(response.body.warning).toBeUndefined();
  });

  it("falls back to static models with warning when dynamic fetch fails", async () => {
    getProviderConnectionById.mockResolvedValue({
      id: "conn-openai",
      provider: "openai",
      apiKey: "test-key",
      providerSpecificData: { baseUrl: "https://api.openai.com/v1" },
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "service unavailable",
    }));

    const response = await GET(new Request("http://localhost/api/providers/conn-openai/models"), {
      params: Promise.resolve({ id: "conn-openai" }),
    });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe("openai");
    expect(Array.isArray(response.body.models)).toBe(true);
    expect(response.body.models.length).toBeGreaterThan(0);
    expect(response.body.models.some((m) => m.id === "gpt-5.4")).toBe(true);
    expect(response.body.warning).toContain("Failed to fetch models");
  });

  it("deduplicates live union models across two active provider accounts", async () => {
    getProviderConnectionById.mockResolvedValue(null);

    getProviderConnections.mockResolvedValue([
      { id: "openai-a", provider: "openai", isActive: true, apiKey: "key-a", providerSpecificData: { baseUrl: "https://api.openai.com/v1" } },
      { id: "openai-b", provider: "openai", isActive: true, apiKey: "key-b", providerSpecificData: { baseUrl: "https://api.openai.com/v1" } },
    ]);

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: "gpt-5" }, { id: "gpt-5-mini" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: "gpt-5" }, { id: "gpt-5.4" }] }) });

    const response = await GET({}, { params: Promise.resolve({ id: "openai" }) });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe("live");
    expect(response.body.models.filter((m) => m.id === "gpt-5")).toHaveLength(1);
    expect(response.body.models.some((m) => m.id === "gpt-5-mini")).toBe(true);
    expect(response.body.models.some((m) => m.id === "gpt-5.4")).toBe(true);
  });

  it("returns live source when one account fails and one succeeds", async () => {
    getProviderConnectionById.mockResolvedValue(null);

    getProviderConnections.mockResolvedValue([
      { id: "openai-a", provider: "openai", isActive: true, apiKey: "key-a", providerSpecificData: { baseUrl: "https://api.openai.com/v1" } },
      { id: "openai-b", provider: "openai", isActive: true, apiKey: "key-b", providerSpecificData: { baseUrl: "https://api.openai.com/v1" } },
    ]);

    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection timeout"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: "gpt-5" }] }) });

    const response = await GET({}, { params: Promise.resolve({ id: "openai" }) });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe("live");
    expect(response.body.models.some((m) => m.id === "gpt-5")).toBe(true);
  });

  it("starts provider-level live fetches for all active accounts before awaiting results", async () => {
    getProviderConnectionById.mockResolvedValue(null);

    getProviderConnections.mockResolvedValue([
      { id: "openai-a", provider: "openai", isActive: true, apiKey: "key-a", providerSpecificData: { baseUrl: "https://api.openai.com/v1" } },
      { id: "openai-b", provider: "openai", isActive: true, apiKey: "key-b", providerSpecificData: { baseUrl: "https://api.openai.com/v1" } },
    ]);

    let resolveFirst;
    const firstFetchPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const secondFetchPromise = Promise.resolve({
      ok: true,
      json: async () => ({ data: [{ id: "gpt-4.1-mini" }] }),
    });

    global.fetch = vi
      .fn()
      .mockImplementationOnce(() => firstFetchPromise)
      .mockImplementationOnce(() => secondFetchPromise);

    const responsePromise = GET({}, { params: Promise.resolve({ id: "openai" }) });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(2);

    resolveFirst({
      ok: true,
      json: async () => ({ data: [{ id: "gpt-4.1" }] }),
    });

    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(response.body.source).toBe("live");
  });

  it("parses real codex model payloads that use slug and display_name", async () => {
    getProviderConnectionById.mockResolvedValue({
      id: "conn-codex",
      provider: "codex",
      accessToken: "codex-token",
      providerSpecificData: {},
    });

    global.fetch = vi.fn(async (url, options) => {
      if (url === "https://chatgpt.com/backend-api/codex/models?client_version=1.0.0") {
        expect(options?.headers?.Authorization).toBe("Bearer codex-token");
        return {
          ok: true,
          json: async () => ({
            models: [{ slug: "gpt-5.5", display_name: "GPT-5.5" }],
          }),
        };
      }

      throw new Error(`Unexpected URL: ${String(url)}`);
    });

    const response = await GET(new Request("http://localhost/api/providers/conn-codex/models"), {
      params: Promise.resolve({ id: "conn-codex" }),
    });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe("live");
    expect(response.body.models).toEqual([
      { id: "gpt-5.5", name: "GPT-5.5", slug: "gpt-5.5", display_name: "GPT-5.5" },
      {
        id: "gpt-5.5-review",
        name: "GPT-5.5 Review",
        slug: "gpt-5.5",
        display_name: "GPT-5.5",
        upstreamModelId: "gpt-5.5",
        quotaFamily: "review",
      },
    ]);
  });

  it("falls back to static models with fallback reason when all live fetches fail", async () => {
    getProviderConnectionById.mockResolvedValue(null);

    getProviderConnections.mockResolvedValue([
      { id: "openai-a", provider: "openai", isActive: true, apiKey: "key-a", providerSpecificData: { baseUrl: "https://api.openai.com/v1" } },
      { id: "openai-b", provider: "openai", isActive: true, apiKey: "key-b", providerSpecificData: { baseUrl: "https://api.openai.com/v1" } },
    ]);

    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Rate limited"))
      .mockRejectedValueOnce(new Error("Network down"));

    const response = await GET({}, { params: Promise.resolve({ id: "openai" }) });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe("fallback");
    expect(response.body.models.length).toBeGreaterThan(0);
    expect(response.body.fallbackReason).toContain("all live fetches failed");
  });

});
