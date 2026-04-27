import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const read = (p) => fs.readFileSync(path.resolve(ROOT_DIR, p), "utf8");

describe("cli tools / mitm / proxy pools typography contract", () => {
  it("keeps cli tools header and section labels in baseline density", () => {
    const cliTools = read("src/app/(dashboard)/dashboard/cli-tools/CLIToolsPageClient.tsx");
    expect(cliTools).toContain("text-2xl font-semibold tracking-tight text-foreground");
    expect(cliTools).toContain("text-xs text-muted-foreground\">Popular Tools");
    expect(cliTools).toContain("text-xs text-muted-foreground\">MITM Tools & Proxies");
    expect(cliTools).not.toContain("text-[10px] font-bold uppercase tracking-widest");
  });

  it("keeps mitm header hierarchy compact and semantic", () => {
    const mitm = read("src/app/(dashboard)/dashboard/mitm/MitmPageClient.tsx");
    expect(mitm).toContain("text-xs text-muted-foreground");
    expect(mitm).toContain("text-2xl font-semibold tracking-tight");
    expect(mitm).toContain("text-sm text-muted-foreground");
    expect(mitm).not.toContain("text-3xl font-medium tracking-tight");
  });

  it("keeps proxy pools actions and status labels non-hardcore", () => {
    const proxyPools = read("src/app/(dashboard)/dashboard/proxy-pools/ProxyPoolsPageClient.tsx");
    expect(proxyPools).toContain("text-2xl font-semibold tracking-tight text-foreground");
    expect(proxyPools).toContain("className=\"h-8 rounded-md border-border/50 bg-background px-3 text-xs font-medium\"");
    expect(proxyPools).toContain("className=\"h-10 flex-1 rounded-md border-border/50 text-xs font-medium\"");
    expect(proxyPools).toContain("className=\"h-10 flex-1 rounded-md text-xs font-medium shadow-none\"");
    expect(proxyPools).not.toContain("tracking-widest");
    expect(proxyPools).not.toContain("font-black");
  });
});
