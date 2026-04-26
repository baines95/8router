import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const TARGET_FILES = [
  "src/app/(dashboard)/dashboard/profile/sections/LocalModeSection.tsx",
  "src/app/(dashboard)/dashboard/profile/sections/SecuritySection.tsx",
  "src/app/(dashboard)/dashboard/profile/sections/RoutingSection.tsx",
  "src/app/(dashboard)/dashboard/profile/sections/NetworkSection.tsx",
  "src/app/(dashboard)/dashboard/profile/sections/ObservabilitySection.tsx",
  "src/app/(dashboard)/dashboard/usage/UsagePageClient.tsx",
  "src/app/(dashboard)/dashboard/endpoint/EndpointPageClient.tsx",
];

function extractPhosphorImports(source) {
  const marker = 'from "@phosphor-icons/react"';
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return [];

  const beforeMarker = source.slice(0, markerIndex);
  const importStart = beforeMarker.lastIndexOf("import");
  if (importStart === -1) return [];

  const importStmt = source.slice(importStart, markerIndex);
  const openBraceIndex = importStmt.indexOf("{");
  const closeBraceIndex = importStmt.lastIndexOf("}");

  if (openBraceIndex === -1 || closeBraceIndex === -1 || closeBraceIndex <= openBraceIndex) {
    return [];
  }

  const names = importStmt.slice(openBraceIndex + 1, closeBraceIndex);

  return names
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/\s+as\s+/)[0].trim());
}

describe("phosphor imports", () => {
  it("uses non-deprecated *Icon exports in dashboard files", () => {
    const violations = [];

    for (const relativeFile of TARGET_FILES) {
      const fullPath = path.join(REPO_ROOT, relativeFile);
      const source = fs.readFileSync(fullPath, "utf8");
      const imports = extractPhosphorImports(source);

      for (const importedName of imports) {
        const isAllowed = importedName === "IconProps" || importedName.endsWith("Icon");
        if (!isAllowed) {
          violations.push(`${relativeFile}: ${importedName}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
