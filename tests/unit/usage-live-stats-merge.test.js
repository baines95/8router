import { describe, it, expect } from "vitest";
import { mergeLiveStats } from "../../src/app/(dashboard)/dashboard/usage/components/liveStats";

describe("mergeLiveStats", () => {
  it("returns previous reference when live payload does not change", () => {
    const prev = {
      totalRequests: 1,
      totalCost: 1,
      totalPromptTokens: 1,
      totalCompletionTokens: 1,
      activeRequests: [{ provider: "a" }],
      recentRequests: [{ provider: "a" }],
      errorProvider: "",
      pending: { a: 1 },
    };

    const next = mergeLiveStats(prev, {
      activeRequests: [{ provider: "a" }],
      recentRequests: [{ provider: "a" }],
      errorProvider: "",
      pending: { a: 1 },
    });

    expect(next).toBe(prev);
  });

  it("returns new object when live payload changes", () => {
    const prev = {
      totalRequests: 1,
      totalCost: 1,
      totalPromptTokens: 1,
      totalCompletionTokens: 1,
      activeRequests: [{ provider: "a" }],
      recentRequests: [{ provider: "a" }],
      errorProvider: "",
      pending: { a: 1 },
    };

    const next = mergeLiveStats(prev, {
      activeRequests: [{ provider: "b" }],
      recentRequests: [{ provider: "a" }],
      errorProvider: "",
      pending: { a: 1 },
    });

    expect(next).not.toBe(prev);
    expect(next.activeRequests[0].provider).toBe("b");
  });
});
