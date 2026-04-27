import { describe, it, expect } from "vitest";

import {
  buildQuotaSnapshot,
  getQuotaSnapshotState,
  getConnectionQuotaSnapshot,
} from "../../src/lib/usage/quotaSnapshot.ts";

describe("quota authority canonical snapshot", () => {
  it("builds a canonical snapshot from provider usage data", () => {
    const snapshot = buildQuotaSnapshot("github", {
      quotas: {
        primary: {
          used: 100,
          total: 100,
          resetAt: "2026-04-27T12:05:00.000Z",
        },
        session: {
          used: 20,
          total: 100,
          resetAt: "2026-04-27T12:10:00.000Z",
        },
      },
    }, "2026-04-27T12:00:00.000Z");

    expect(snapshot.provider).toBe("github");
    expect(snapshot.fetchedAt).toBe("2026-04-27T12:00:00.000Z");
    expect(snapshot.buckets).toEqual([
      {
        name: "primary",
        used: 100,
        total: 100,
        resetAt: "2026-04-27T12:05:00.000Z",
        remainingPercentage: 0,
      },
      {
        name: "session",
        used: 20,
        total: 100,
        resetAt: "2026-04-27T12:10:00.000Z",
        remainingPercentage: 80,
      },
    ]);
  });

  it("identifies exhausted state and earliest reset from canonical snapshot", () => {
    const snapshot = buildQuotaSnapshot("github", {
      quotas: {
        weekly: {
          used: 10,
          total: 10,
          resetAt: "2026-04-27T12:30:00.000Z",
        },
        primary: {
          used: 100,
          total: 100,
          resetAt: "2026-04-27T12:05:00.000Z",
        },
      },
    }, "2026-04-27T12:00:00.000Z");

    expect(getQuotaSnapshotState(snapshot, Date.parse("2026-04-27T12:00:00.000Z"))).toEqual({
      exhausted: true,
      nextResetAt: "2026-04-27T12:05:00.000Z",
    });
  });

  it("treats expired reset windows as non-exhausted authority state", () => {
    const snapshot = buildQuotaSnapshot("github", {
      quotas: {
        primary: {
          used: 100,
          total: 100,
          resetAt: "2026-04-27T11:59:00.000Z",
        },
      },
    }, "2026-04-27T12:00:00.000Z");

    expect(getQuotaSnapshotState(snapshot, Date.parse("2026-04-27T12:00:00.000Z"))).toEqual({
      exhausted: false,
      nextResetAt: null,
    });
  });

  it("reads canonical snapshot from providerSpecificData on a connection", () => {
    const snapshot = buildQuotaSnapshot("github", {
      quotas: {
        primary: {
          used: 90,
          total: 100,
          resetAt: "2026-04-27T12:05:00.000Z",
        },
      },
    }, "2026-04-27T12:00:00.000Z");

    expect(getConnectionQuotaSnapshot({
      providerSpecificData: {
        quotaSnapshot: snapshot,
      },
    })).toEqual(snapshot);
  });

  it("returns null when a connection has no canonical snapshot", () => {
    expect(getConnectionQuotaSnapshot({ providerSpecificData: {} })).toBeNull();
  });
});
