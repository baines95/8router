import { describe, it, expect } from "vitest";
import { validateProxyUrl } from "../../src/app/(dashboard)/dashboard/profile/hooks/useProxySettings";

describe("validateProxyUrl", () => {
  it("rejects empty string", () => {
    expect(validateProxyUrl("   ")).toBe(false);
  });

  it("accepts non-empty string", () => {
    expect(validateProxyUrl("http://127.0.0.1:7897")).toBe(true);
  });
});
