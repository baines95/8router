export interface ProviderConnectionLike {
  provider: string;
}

export type ProviderModelsResponse = {
  provider: string;
  source: "live" | "fallback";
  models: Array<{ id: string; name?: string }>;
};

export type LiveProviderModelMap = Record<string, ProviderModelsResponse["models"]>;

export const getProviderFetchKey = (connections: ProviderConnectionLike[]): string => [...new Set(connections.map((connection) => connection.provider))]
  .sort()
  .join("|");

export const shouldRefreshLiveProviderModels = (
  isOpen: boolean,
  currentKey: string,
  previousKey: string | null,
): boolean => isOpen && currentKey.length > 0 && currentKey !== previousKey;

export const isProviderModelsResponse = (value: unknown): value is ProviderModelsResponse => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ProviderModelsResponse>;
  return typeof candidate.provider === "string"
    && (candidate.source === "live" || candidate.source === "fallback")
    && Array.isArray(candidate.models)
    && candidate.models.every((item) => typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string");
};

const fetchJson = async (input: string): Promise<unknown> => {
  const response = await fetch(input, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${input}: ${response.status}`);
  }

  return response.json();
};

export const loadLiveProviderModels = async (connections: ProviderConnectionLike[]): Promise<LiveProviderModelMap> => {
  const providerIds = [...new Set(connections.map((connection) => connection.provider))];
  const entries = await Promise.all(providerIds.map(async (providerId) => {
    try {
      const payload = await fetchJson(`/api/providers/${providerId}/models`);
      if (!isProviderModelsResponse(payload)) return null;
      return [providerId, payload.models] as const;
    } catch {
      return null;
    }
  }));

  return Object.fromEntries(entries.filter((entry): entry is readonly [string, ProviderModelsResponse["models"]] => entry !== null));
};
