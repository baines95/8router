import { describe, it, expect } from "vitest";
import { getProviderFetchKey, shouldRefreshLiveProviderModels } from "../../src/shared/utils/providerModelLiveFetch.ts";

describe("providerModelLiveFetch", () => {
  it("builds a stable provider fetch key from unique sorted providers", () => {
    const key = getProviderFetchKey([
      { provider: "gemini-cli" },
      { provider: "codex" },
      { provider: "codex" },
    ]);

    expect(key).toBe("codex|gemini-cli");
  });

  it("requires a refresh when modal opens with a new provider set", () => {
    expect(shouldRefreshLiveProviderModels(true, "codex|gemini-cli", null)).toBe(true);
  });

  it("skips refresh when modal reopens with the same provider set", () => {
    expect(shouldRefreshLiveProviderModels(true, "codex|gemini-cli", "codex|gemini-cli")).toBe(false);
  });

  it("skips refresh when there are no providers", () => {
    expect(shouldRefreshLiveProviderModels(true, "", null)).toBe(false);
  });

  it("skips refresh while modal is closed", () => {
    expect(shouldRefreshLiveProviderModels(false, "codex|gemini-cli", null)).toBe(false);
  });
});
