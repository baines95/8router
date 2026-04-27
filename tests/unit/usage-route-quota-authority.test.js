import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/localDb.ts", () => ({
  getProviderConnectionById: vi.fn(),
  updateProviderConnection: vi.fn(),
}));

vi.mock("../../src/lib/open-sse/services/usage.ts", () => ({
  getUsageForProvider: vi.fn(),
}));

vi.mock("../../src/lib/open-sse/executors/index", () => ({
  getExecutor: vi.fn(() => ({
    needsRefresh: vi.fn(() => false),
    refreshCredentials: vi.fn(),
  })),
}));

import { GET } from "../../src/app/api/usage/[connectionId]/route.ts";
import { getProviderConnectionById, updateProviderConnection } from "../../src/lib/localDb.ts";
import { getUsageForProvider } from "../../src/lib/open-sse/services/usage.ts";

describe("usage route quota authority persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists canonical quota snapshot onto the connection after fetching usage", async () => {
    vi.mocked(getProviderConnectionById).mockResolvedValue({
      id: "conn-1",
      provider: "github",
      authType: "oauth",
      accessToken: "token",
      providerSpecificData: {
        existing: true,
      },
    });

    vi.mocked(getUsageForProvider).mockResolvedValue({
      quotas: {
        primary: {
          used: 100,
          total: 100,
          resetAt: "2026-04-27T12:05:00.000Z",
        },
      },
    });

    const response = await GET(new Request("http://localhost/api/usage/conn-1"), {
      params: Promise.resolve({ connectionId: "conn-1" }),
    });

    expect(response.status).toBe(200);
    expect(updateProviderConnection).toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        providerSpecificData: expect.objectContaining({
          existing: true,
          quotaSnapshot: {
            provider: "github",
            fetchedAt: expect.any(String),
            buckets: [
              {
                name: "primary",
                used: 100,
                total: 100,
                resetAt: "2026-04-27T12:05:00.000Z",
                remainingPercentage: 0,
              },
            ],
          },
        }),
      }),
    );
  });
});
