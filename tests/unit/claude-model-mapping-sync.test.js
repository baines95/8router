import { describe, it, expect } from "vitest";
import { getHydratedModelMappings } from "../../src/shared/utils/claudeModelMappingSync.ts";

describe("claudeModelMappingSync", () => {
  const defaultModels = [
    { alias: "opus", envKey: "ANTHROPIC_MODEL", id: "claude-opus-4-1" },
    { alias: "sonnet", envKey: "ANTHROPIC_SMALL_FAST_MODEL", id: "claude-sonnet-4-1" },
  ];

  it("hydrates missing mappings from Claude settings on first sync", () => {
    const hydrated = getHydratedModelMappings({
      defaultModels,
      currentMappings: {},
      existingEnv: {
        ANTHROPIC_MODEL: "codex/gpt-5.4",
      },
      hasHydrated: false,
    });

    expect(hydrated).toEqual({
      opus: "codex/gpt-5.4",
      sonnet: "claude-sonnet-4-1",
    });
  });

  it("does not overwrite a user-selected mapping after initial hydration", () => {
    const hydrated = getHydratedModelMappings({
      defaultModels,
      currentMappings: { opus: "gemini-cli/gemini-3-pro" },
      existingEnv: {
        ANTHROPIC_MODEL: "codex/gpt-5.4",
      },
      hasHydrated: true,
    });

    expect(hydrated).toEqual({});
  });

  it("falls back to default model id only during initial hydration", () => {
    const hydrated = getHydratedModelMappings({
      defaultModels,
      currentMappings: {},
      existingEnv: {},
      hasHydrated: false,
    });

    expect(hydrated).toEqual({
      opus: "claude-opus-4-1",
      sonnet: "claude-sonnet-4-1",
    });
  });
});
