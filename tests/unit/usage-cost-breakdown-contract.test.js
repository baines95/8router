import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const read = (p) => fs.readFileSync(path.resolve(ROOT_DIR, p), "utf8");

describe("usage cost breakdown contract", () => {
  it("stores input/output cost fields in daily summary counters", () => {
    const usageDb = read("src/lib/usageDb.ts");

    expect(usageDb).toContain("inputCost");
    expect(usageDb).toContain("outputCost");
    expect(usageDb).toContain("target[key].inputCost += values.inputCost || 0");
    expect(usageDb).toContain("target[key].outputCost += values.outputCost || 0");
  });

  it("aggregates input/output cost into byModel stats for usage table cost mode", () => {
    const usageDb = read("src/lib/usageDb.ts");

    expect(usageDb).toContain("stats.byModel[statsKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, inputCost: 0, outputCost: 0");
    expect(usageDb).toContain("stats.byModel[statsKey].inputCost += mData.inputCost || 0");
    expect(usageDb).toContain("stats.byModel[statsKey].outputCost += mData.outputCost || 0");
  });
});
