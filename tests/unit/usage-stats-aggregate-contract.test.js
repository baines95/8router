import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const read = (p) => fs.readFileSync(path.resolve(ROOT_DIR, p), "utf8");

describe("usage stats aggregate contract", () => {
  it("does not leave placeholder aggregation comments in getUsageStats", () => {
    const usageDb = read("src/lib/usageDb.ts");

    expect(usageDb.includes("rest of stats aggregation, simplified for brevity")).toBe(false);
    expect(usageDb.includes("24h logic... (also maintained)")).toBe(false);
  });

  it("aggregates account, api key, and endpoint maps from daily summary", () => {
    const usageDb = read("src/lib/usageDb.ts");

    expect(usageDb).toContain("for (const [accountId, aData] of Object.entries(day.byAccount || {}))");
    expect(usageDb).toContain("for (const [apiKeyKey, kData] of Object.entries(day.byApiKey || {}))");
    expect(usageDb).toContain("for (const [endpointKey, eData] of Object.entries(day.byEndpoint || {}))");
  });

  it("aggregates 24h stats from raw history entries", () => {
    const usageDb = read("src/lib/usageDb.ts");

    expect(usageDb).toContain("for (const entry of history)");
    expect(usageDb).toContain("if (period === \"24h\")");
    expect(usageDb).toContain("stats.byAccount[connectionId]");
    expect(usageDb).toContain("stats.byApiKey[apiStatsKey]");
    expect(usageDb).toContain("stats.byEndpoint[endpointStatsKey]");
  });
});
