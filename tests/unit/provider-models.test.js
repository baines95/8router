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

  beforeEach(async () => {
    vi.clearAllMocks();

    const db = await import("../../src/lib/localDb.js");
    getProviderConnectionById = db.getProviderConnectionById;

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
});
