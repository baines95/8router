import type { ProviderModelsResolvedResponse } from "@/shared/hooks/useProviderModels";

export function getProviderModelFallbackWarning(
  resolved: ProviderModelsResolvedResponse | null,
  hookError: string | null,
): string | null {
  if (resolved?.source === "fallback") {
    return resolved.fallbackReason || resolved.warning || null;
  }

  if (!resolved && hookError) {
    return `Using static model list because live model loading failed: ${hookError}`;
  }

  return null;
}
