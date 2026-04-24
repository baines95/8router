import { describe, it, expect } from "vitest";
import { parseBackupPayload } from "../../src/app/(dashboard)/dashboard/profile/hooks/useBackupSettings";

describe("parseBackupPayload", () => {
  it("parses valid json string", () => {
    const payload = parseBackupPayload('{"ok":true}');
    expect(payload).toEqual({ ok: true });
  });

  it("throws on invalid json", () => {
    expect(() => parseBackupPayload("not-json")).toThrow();
  });
});
