import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fsPromises from "fs/promises";

const execFileResults = [];

function queueExecFileResult(stdout) {
  execFileResults.push({ stdout, stderr: "" });
}

function resetExecFileQueue() {
  execFileResults.length = 0;
}

const execFileMock = vi.fn((...args) => {
  const callback = typeof args[2] === "function" ? args[2] : args[3];
  const next = execFileResults.shift();

  if (!next) {
    callback(new Error("sqlite3 missing"));
    return;
  }

  if (next instanceof Error) {
    callback(next);
    return;
  }

  callback(null, next);
});

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      status: init?.status || 200,
      body,
      json: async () => body,
    })),
  },
}));

vi.mock("os", () => ({
  default: { homedir: vi.fn(() => "/mock/home") },
  homedir: vi.fn(() => "/mock/home"),
}));

vi.mock("fs/promises", () => ({
  access: vi.fn(),
  constants: { R_OK: 4 },
}));

vi.mock("child_process", () => ({
  execFile: execFileMock,
}));

const mockDbInstance = {
  prepare: vi.fn(),
  close: vi.fn(),
  __throwOnConstruct: false,
};

class MockDatabase {
  constructor() {
    if (mockDbInstance.__throwOnConstruct) {
      throw new Error("SQLITE_CANTOPEN");
    }
    return mockDbInstance;
  }
}

vi.mock("better-sqlite3", () => ({
  default: MockDatabase,
  __esModule: true,
}));

let GET;

describe("GET /api/oauth/cursor/auto-import", () => {
  const originalPlatform = process.platform;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetExecFileQueue();
    mockDbInstance.__throwOnConstruct = false;
    Object.defineProperty(process, "platform", { value: "darwin", writable: true });
    const mod = await import("../../src/app/api/oauth/cursor/auto-import/route.js");
    GET = mod.GET;
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, writable: true });
  });

  it("returns checked locations when no macOS cursor db paths are accessible", async () => {
    vi.mocked(fsPromises.access).mockRejectedValue(new Error("ENOENT"));

    const response = await GET();

    expect(response.body.found).toBe(false);
    expect(response.body.error).toContain("Cursor database not found. Checked locations:");
    expect(response.body.error).toContain("/mock/home/Library/Application Support/Cursor/User/globalStorage/state.vscdb");
  });

  it("falls back to manual import if macOS db exists but token extraction cannot open it", async () => {
    vi.mocked(fsPromises.access).mockResolvedValue();
    mockDbInstance.__throwOnConstruct = true;

    const response = await GET();

    expect(response.body.found).toBe(false);
    expect(response.body.windowsManual).toBe(true);
    expect(response.body.dbPath).toContain("state.vscdb");
  });

  it("extracts tokens using exact keys", async () => {
    vi.mocked(fsPromises.access).mockResolvedValue();
    mockDbInstance.__throwOnConstruct = true;
    queueExecFileResult("test-token\n");
    queueExecFileResult("test-machine-id\n");

    const response = await GET();

    expect(response.body.found).toBe(true);
    expect(response.body.accessToken).toBe("test-token");
    expect(response.body.machineId).toBe("test-machine-id");
  });

  it("unwraps JSON-encoded string values", async () => {
    vi.mocked(fsPromises.access).mockResolvedValue();
    mockDbInstance.__throwOnConstruct = true;
    queueExecFileResult('"json-token"\n');
    queueExecFileResult('"json-machine-id"\n');

    const response = await GET();

    expect(response.body.found).toBe(true);
    expect(response.body.accessToken).toBe("json-token");
    expect(response.body.machineId).toBe("json-machine-id");
  });

  it("checks fallback keys like cursorAuth/token and storage.machineId when primary keys are missing", async () => {
    vi.mocked(fsPromises.access).mockResolvedValue();
    mockDbInstance.__throwOnConstruct = true;
    queueExecFileResult("");
    queueExecFileResult("fallback-token\n");
    queueExecFileResult("");
    queueExecFileResult("fallback-machine\n");

    const response = await GET();

    expect(response.body.found).toBe(true);
    expect(response.body.accessToken).toBe("fallback-token");
    expect(response.body.machineId).toBe("fallback-machine");
  });

  it("returns manual import hint when tokens are still missing after both extraction strategies", async () => {
    vi.mocked(fsPromises.access).mockResolvedValue();
    mockDbInstance.__throwOnConstruct = true;
    queueExecFileResult("");
    queueExecFileResult("");
    queueExecFileResult("");
    queueExecFileResult("");
    queueExecFileResult("");

    const response = await GET();

    expect(response.body.found).toBe(false);
    expect(response.body.windowsManual).toBe(true);
    expect(response.body.dbPath).toContain("state.vscdb");
  });

  it("linux also reports checked candidate paths when no db is accessible", async () => {
    Object.defineProperty(process, "platform", { value: "linux", writable: true });
    vi.mocked(fsPromises.access).mockRejectedValue(new Error("ENOENT"));

    const response = await GET();

    expect(response.body.found).toBe(false);
    expect(response.body.error).toContain("Cursor database not found. Checked locations:");
    expect(response.body.error).toContain("/mock/home/.config/Cursor/User/globalStorage/state.vscdb");
    expect(fsPromises.access).toHaveBeenCalled();
  });

  it("freebsd currently falls back to linux-style candidate path probing", async () => {
    Object.defineProperty(process, "platform", { value: "freebsd", writable: true });
    vi.mocked(fsPromises.access).mockRejectedValue(new Error("ENOENT"));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.body.found).toBe(false);
    expect(response.body.error).toContain("Cursor database not found. Checked locations:");
  });
});
