import { describe, it, expect } from "vitest";
import { createSettingMutation } from "../../src/app/(dashboard)/dashboard/profile/hooks/useSettingMutation";

describe("createSettingMutation", () => {
  it("returns success state on ok response", async () => {
    const fn = createSettingMutation(async () => ({
      ok: true,
      json: async () => ({ value: true }),
    }));

    const result = await fn({ value: true });

    expect(result.type).toBe("success");
  });

  it("returns error state on non-ok response", async () => {
    const fn = createSettingMutation(async () => ({
      ok: false,
      json: async () => ({ error: "bad request" }),
    }));

    const result = await fn({ value: false });

    expect(result).toEqual({ type: "error", message: "bad request" });
  });
});
