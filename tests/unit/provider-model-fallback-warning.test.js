import { describe, it, expect } from "vitest";
import { getProviderModelFallbackWarning } from "../../src/shared/utils/providerModelFallbackWarning";

describe("getProviderModelFallbackWarning", () => {
  it("returns fallback warning from resolved fallback data", () => {
    const warning = getProviderModelFallbackWarning(
      {
        provider: "openai",
        models: [],
        source: "fallback",
        fallbackReason: "Using static list because all live fetches failed",
      },
      null,
    );

    expect(warning).toBe("Using static list because all live fetches failed");
  });

  it("returns warning from resolved warning field when fallbackReason is missing", () => {
    const warning = getProviderModelFallbackWarning(
      {
        provider: "openai",
        models: [],
        source: "fallback",
        warning: "Temporary fallback from cache",
      },
      null,
    );

    expect(warning).toBe("Temporary fallback from cache");
  });

  it("returns derived warning when resolved data is absent but hook error exists", () => {
    const warning = getProviderModelFallbackWarning(null, "Network timeout");

    expect(warning).toBe("Using static model list because live model loading failed: Network timeout");
  });

  it("returns null when data is live and there is no error", () => {
    const warning = getProviderModelFallbackWarning(
      {
        provider: "openai",
        models: [],
        source: "live",
      },
      null,
    );

    expect(warning).toBeNull();
  });

  it("returns null when both resolved data and hook error are absent", () => {
    const warning = getProviderModelFallbackWarning(null, null);

    expect(warning).toBeNull();
  });
});
