import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const read = (p) => fs.readFileSync(path.resolve(ROOT_DIR, p), "utf8");

describe("profile page typography contract", () => {
  it("keeps canonical page title and description hierarchy", () => {
    const page = read("src/app/(dashboard)/dashboard/profile/ProfilePageClient.tsx");
    expect(page).toContain("text-2xl font-semibold tracking-tight");
    expect(page).toContain("text-sm text-muted-foreground");
  });

  it("uses compact section card title/description classes", () => {
    const security = read("src/app/(dashboard)/dashboard/profile/sections/SecuritySection.tsx");
    expect(security).toContain("text-sm font-medium");
    expect(security).toContain("text-xs text-muted-foreground");
  });

  it("renders technical read-only fields with mono tabular style", () => {
    const localMode = read("src/app/(dashboard)/dashboard/profile/sections/LocalModeSection.tsx");
    expect(localMode).toContain("font-mono text-xs tabular-nums");
  });

  it("uses endpoint-style eyebrow header pattern", () => {
    const page = read("src/app/(dashboard)/dashboard/profile/ProfilePageClient.tsx");
    expect(page).toContain("text-xs text-muted-foreground");
    expect(page).toContain("Core Services");
  });

  it("keeps section card title and description compact", () => {
    const routing = read("src/app/(dashboard)/dashboard/profile/sections/RoutingSection.tsx");
    expect(routing).toContain("text-sm font-medium");
    expect(routing).toContain("text-xs text-muted-foreground");
  });

  it("uses compact action buttons in section forms", () => {
    const network = read("src/app/(dashboard)/dashboard/profile/sections/NetworkSection.tsx");
    expect(network).toContain("h-8");
    expect(network).toContain("text-xs");
  });

  it("renders machine/database values as technical mono blocks", () => {
    const localMode = read("src/app/(dashboard)/dashboard/profile/sections/LocalModeSection.tsx");
    expect(localMode).toContain("font-mono text-xs tabular-nums");
    expect(localMode).toContain("readOnly");
  });

  it("keeps backup controls compact", () => {
    const localMode = read("src/app/(dashboard)/dashboard/profile/sections/LocalModeSection.tsx");
    expect(localMode).toContain("h-8");
    expect(localMode).toContain("text-xs");
  });
});
