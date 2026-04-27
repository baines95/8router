export interface QuotaSnapshotBucket {
  name: string;
  used: number;
  total: number;
  resetAt: string | null;
  remainingPercentage: number;
}

export interface QuotaSnapshot {
  provider: string;
  fetchedAt: string;
  buckets: QuotaSnapshotBucket[];
}

export interface QuotaSnapshotApiResponse {
  plan?: string;
  quotaSnapshot: QuotaSnapshot;
}

function calculateRemainingPercentage(used: number, total: number): number {
  if (!total || total === 0) return 0;
  if (!used || used < 0) return 100;
  if (used >= total) return 0;

  return Math.round(((total - used) / total) * 100);
}

function normalizeBucket(name: string, quota: any): QuotaSnapshotBucket {
  const used = Number(quota?.used) || 0;
  const total = Number(quota?.total) || 0;

  return {
    name,
    used,
    total,
    resetAt: typeof quota?.resetAt === "string" ? quota.resetAt : null,
    remainingPercentage:
      typeof quota?.remainingPercentage === "number"
        ? Math.round(quota.remainingPercentage)
        : calculateRemainingPercentage(used, total),
  };
}

export function buildQuotaSnapshot(provider: string, usage: any, fetchedAt: string): QuotaSnapshot {
  const quotas = usage?.quotas && typeof usage.quotas === "object" ? usage.quotas : {};

  return {
    provider,
    fetchedAt,
    buckets: Object.entries(quotas).map(([name, quota]) => normalizeBucket(name, quota)),
  };
}

export function getQuotaSnapshotState(snapshot: QuotaSnapshot | null | undefined, now: number = Date.now()): {
  exhausted: boolean;
  nextResetAt: string | null;
} {
  if (!snapshot?.buckets?.length) {
    return {
      exhausted: false,
      nextResetAt: null,
    };
  }

  const exhaustedBuckets = snapshot.buckets.filter((bucket) => {
    if (bucket.total <= 0 || bucket.used < bucket.total || !bucket.resetAt) {
      return false;
    }

    const resetMs = Date.parse(bucket.resetAt);
    return Number.isFinite(resetMs) && resetMs > now;
  });

  if (exhaustedBuckets.length === 0) {
    return {
      exhausted: false,
      nextResetAt: null,
    };
  }

  exhaustedBuckets.sort((a, b) => Date.parse(a.resetAt || "") - Date.parse(b.resetAt || ""));

  return {
    exhausted: true,
    nextResetAt: exhaustedBuckets[0]?.resetAt ?? null,
  };
}

export function getConnectionQuotaSnapshot(connection: any): QuotaSnapshot | null {
  const snapshot = connection?.providerSpecificData?.quotaSnapshot;

  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    typeof snapshot.provider !== "string" ||
    typeof snapshot.fetchedAt !== "string" ||
    !Array.isArray(snapshot.buckets)
  ) {
    return null;
  }

  return snapshot as QuotaSnapshot;
}
