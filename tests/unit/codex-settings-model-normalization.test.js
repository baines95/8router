import { beforeEach, describe, expect, it, vi } from "vitest";

const files = new Map();

vi.mock("child_process", () => ({
  exec: vi.fn((_command, callback) => callback(null, { stdout: "/usr/local/bin/codex\n", stderr: "" })),
}));

vi.mock("fs/promises", () => ({
  default: {
    access: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
    readFile: vi.fn(async (file) => {
      if (!files.has(String(file))) throw new Error("ENOENT");
      return files.get(String(file));
    }),
    writeFile: vi.fn(async (file, content) => {
      files.set(String(file), String(content));
    }),
  },
  access: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async (file) => {
    if (!files.has(String(file))) throw new Error("ENOENT");
    return files.get(String(file));
  }),
  writeFile: vi.fn(async (file, content) => {
    files.set(String(file), String(content));
  }),
}));

const { POST } = await import("../../src/app/api/cli-tools/codex-settings/route.js");

function requestWithModel(model, subagentModel) {
  return new Request("http://localhost/api/cli-tools/codex-settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      subagentModel,
      baseUrl: "http://localhost:20128",
      apiKey: "sk-test",
    }),
  });
}

function writtenConfig() {
  const configEntry = [...files.entries()].find(([file]) => file.endsWith(".codex/config.toml"));
  return configEntry?.[1] || "";
}

describe("Codex settings model normalization", () => {
  beforeEach(() => {
    files.clear();
    vi.clearAllMocks();
  });

  it("writes bare Codex models with the cx provider prefix", async () => {
    const response = await POST(requestWithModel("gpt-5.4", "gpt-5.5"));

    expect(response.status).toBe(200);
    expect(writtenConfig()).toContain('model = "cx/gpt-5.4"');
    expect(writtenConfig()).toContain('model = "cx/gpt-5.5"');
  });

  it("preserves already-prefixed model selections", async () => {
    const response = await POST(requestWithModel("openai/gpt-5.4", "cx/gpt-5.5"));

    expect(response.status).toBe(200);
    expect(writtenConfig()).toContain('model = "openai/gpt-5.4"');
    expect(writtenConfig()).toContain('model = "cx/gpt-5.5"');
  });
});
