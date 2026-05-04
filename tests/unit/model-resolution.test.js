import { describe, expect, it } from "vitest";

import { getModelInfoCore } from "../../src/lib/open-sse/services/model.js";

describe("model resolution", () => {
  it("resolves configured aliases before GPT provider inference", async () => {
    const modelInfo = await getModelInfoCore("gpt-5.4", {
      "gpt-5.4": "cx/gpt-5.4",
    });

    expect(modelInfo).toEqual({ provider: "codex", model: "gpt-5.4" });
  });

  it("routes bare Codex models to Codex only for Codex clients", async () => {
    const modelInfo = await getModelInfoCore("gpt-5.4", {}, { clientTool: "codex" });

    expect(modelInfo).toEqual({ provider: "codex", model: "gpt-5.4" });
  });

  it("keeps bare GPT models routed to OpenAI for non-Codex clients", async () => {
    const modelInfo = await getModelInfoCore("gpt-5.4", {}, { clientTool: null });

    expect(modelInfo).toEqual({ provider: "openai", model: "gpt-5.4" });
  });

  it("keeps explicit provider prefixes authoritative", async () => {
    await expect(getModelInfoCore("openai/gpt-5.4", {}, { clientTool: "codex" }))
      .resolves.toEqual({ provider: "openai", model: "gpt-5.4" });
    await expect(getModelInfoCore("cx/gpt-5.4", {}, { clientTool: null }))
      .resolves.toEqual({ provider: "codex", model: "gpt-5.4" });
  });
});
