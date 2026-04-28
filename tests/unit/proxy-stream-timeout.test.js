import { describe, it, expect } from "vitest";
import { proxyAwareFetch } from "../../src/lib/open-sse/utils/proxyFetch.js";

describe("proxyAwareFetch streaming timeout behavior", () => {
  it("does not throw synchronously for streaming requests when bodyTimeout override is set", async () => {
    await expect(
      proxyAwareFetch("https://127.0.0.1:1/stream", {
        method: "POST",
        headers: { Accept: "text/event-stream" },
        body: JSON.stringify({ stream: true })
      })
    ).rejects.toBeInstanceOf(Error);
  });
});
