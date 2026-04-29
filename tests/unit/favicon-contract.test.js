import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..");
const read = (p) => fs.readFileSync(path.resolve(ROOT_DIR, p), "utf8");
const exists = (p) => fs.existsSync(path.resolve(ROOT_DIR, p));

const COMMAND_BOLD_PATH = "M180,140H164V116h16a40,40,0,1,0-40-40V92H116V76a40,40,0,1,0-40,40H92v24H76a40,40,0,1,0,40,40V164h24v16a40,40,0,1,0,40-40ZM164,76a16,16,0,1,1,16,16H164ZM60,76a16,16,0,0,1,32,0V92H76A16,16,0,0,1,60,76ZM92,180a16,16,0,1,1-16-16H92Zm24-64h24v24H116Zm64,80a16,16,0,0,1-16-16V164h16a16,16,0,0,1,0,32Z";

describe("favicon contract", () => {
  it("declares the canonical favicon SVG in app metadata", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('icon: "/favicon.svg"');
  });

  it("does not keep a stale app favicon.ico that can override metadata icons", () => {
    expect(exists("src/app/favicon.ico")).toBe(false);
  });

  it("uses the same Command bold path as the sidebar logo", () => {
    const favicon = read("public/favicon.svg");
    expect(favicon).toContain(COMMAND_BOLD_PATH);
  });
});
