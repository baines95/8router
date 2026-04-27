import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const read = (p) => fs.readFileSync(path.resolve(ROOT_DIR, p), "utf8");

describe("providers and combos typography contract", () => {
  it("keeps providers header/actions compact and semantic", () => {
    const providers = read("src/app/(dashboard)/dashboard/providers/ProvidersClient.tsx");
    expect(providers).toContain("text-2xl font-semibold tracking-tight");
    expect(providers).toContain("className=\"h-8 px-3 text-xs font-medium\"");
    expect(providers).toContain("text-xs text-muted-foreground");
  });

  it("keeps combos header and modal controls in baseline density", () => {
    const combos = read("src/app/(dashboard)/dashboard/combos/CombosPageClient.tsx");
    expect(combos).toContain("text-2xl font-semibold tracking-tight text-foreground");
    expect(combos).toContain("className=\"text-sm font-medium\"");
    expect(combos).toContain("className=\"h-10 flex-1 rounded-md border-border/50 text-xs font-medium\"");
    expect(combos).toContain("className=\"h-10 flex-1 rounded-md text-xs font-medium shadow-none\"");
  });
});
