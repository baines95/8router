"use client";

import { useCallback, useEffect, useState } from "react";

export type ProviderModel = {
  id: string;
  name?: string;
  [key: string]: unknown;
};

export type ProviderModelsResolvedResponse = {
  provider: string;
  models: ProviderModel[];
  source: "live" | "fallback";
  connectionId?: string;
  fallbackReason?: string;
  warning?: string;
  warnings?: string[];
  connectionCount?: number;
  liveSuccessCount?: number;
};

type ProviderModelsErrorResponse = {
  error: string;
};

export async function fetchProviderModels(providerId: string): Promise<ProviderModelsResolvedResponse> {
  const response = await fetch(`/api/providers/${encodeURIComponent(providerId)}/models`, {
    method: "GET",
    cache: "no-store",
  });

  const payload = (await response.json()) as ProviderModelsResolvedResponse | ProviderModelsErrorResponse;

  if (!response.ok) {
    throw new Error((payload as ProviderModelsErrorResponse).error || "Failed to fetch provider models");
  }

  return payload as ProviderModelsResolvedResponse;
}

export function useProviderModels(providerId?: string) {
  const [data, setData] = useState<ProviderModelsResolvedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refresh = useCallback(() => {
    setRefreshIndex((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!providerId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchProviderModels(providerId);
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch provider models");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [providerId, refreshIndex]);

  return { data, loading, error, refresh };
}
