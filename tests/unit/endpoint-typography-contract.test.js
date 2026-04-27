import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const read = (p) => fs.readFileSync(path.resolve(ROOT_DIR, p), "utf8");

describe("endpoint typography contract", () => {
  it("keeps canonical page header hierarchy", () => {
    const endpoint = read("src/app/(dashboard)/dashboard/endpoint/EndpointPageClient.tsx");
    expect(endpoint).toContain("text-2xl font-semibold tracking-tight");
    expect(endpoint).toContain("text-sm text-muted-foreground");
    expect(endpoint).toContain("text-xs text-muted-foreground");
  });

  it("keeps endpoint dialogs compact and semantic", () => {
    const endpoint = read("src/app/(dashboard)/dashboard/endpoint/EndpointPageClient.tsx");
    expect(endpoint).toContain("DialogTitle className=\"text-sm font-medium\"");
    expect(endpoint).toContain("DialogDescription className=\"text-xs text-muted-foreground\"");
    expect(endpoint).toContain("className=\"h-10 flex-1 rounded-md border-border/50 text-xs font-medium\"");
    expect(endpoint).toContain("className=\"h-10 flex-1 rounded-md text-xs font-medium shadow-none\"");
  });
});
