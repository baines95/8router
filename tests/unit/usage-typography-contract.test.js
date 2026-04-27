import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const read = (p) => fs.readFileSync(path.resolve(ROOT_DIR, p), "utf8");

describe("usage page typography contract", () => {
  it("keeps compact controls and canonical heading classes", () => {
    const page = read("src/app/(dashboard)/dashboard/usage/UsagePageClient.tsx");
    expect(page).toContain("text-2xl font-semibold tracking-tight");
    expect(page).toContain("text-sm text-muted-foreground");
    expect(page).toContain("className=\"h-7 text-xs\"");
  });

  it("keeps dense secondary rows at text-xs muted", () => {
    const table = read("src/app/(dashboard)/dashboard/usage/components/UsageTable.tsx");
    expect(table).toContain("text-xs text-muted-foreground");
  });

  it("renders endpoint-style eyebrow hierarchy on usage page", () => {
    const page = read("src/app/(dashboard)/dashboard/usage/UsagePageClient.tsx");
    expect(page).toContain("text-xs text-muted-foreground");
    expect(page).toContain("Core Services");
  });

  it("uses compact chart tick and tooltip typography", () => {
    const chart = read("src/app/(dashboard)/dashboard/usage/components/UsageChart.tsx");
    expect(chart).toContain("fontSize: 10");
    expect(chart).toContain("fontWeight: 500");
  });

  it("uses muted text-xs secondary rows instead of uppercase-heavy labels", () => {
    const table = read("src/app/(dashboard)/dashboard/usage/components/UsageTable.tsx");
    expect(table).toContain("text-xs text-muted-foreground");
    expect(table.includes("uppercase tracking-[0.2em]")).toBe(false);
  });
});
