import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const read = (p) => fs.readFileSync(path.resolve(ROOT_DIR, p), "utf8");

describe("console log typography contract", () => {
  it("keeps canonical page header hierarchy", () => {
    const file = read("src/app/(dashboard)/dashboard/console-log/ConsoleLogClient.tsx");
    expect(file).toContain("text-2xl font-semibold tracking-tight");
    expect(file).toContain("text-sm text-muted-foreground");
  });

  it("uses compact clear action sizing", () => {
    const file = read("src/app/(dashboard)/dashboard/console-log/ConsoleLogClient.tsx");
    expect(file).toContain("h-8");
    expect(file).toContain("text-xs");
  });

  it("renders log surface as mono technical block", () => {
    const file = read("src/app/(dashboard)/dashboard/console-log/ConsoleLogClient.tsx");
    expect(file).toContain("font-mono");
    expect(file).toContain("tabular-nums");
  });

  it("uses muted empty state and non-uppercase-heavy styling", () => {
    const file = read("src/app/(dashboard)/dashboard/console-log/ConsoleLogClient.tsx");
    expect(file).toContain("text-xs text-muted-foreground");
    expect(file.includes("tracking-[0.3em]")).toBe(false);
  });
});
