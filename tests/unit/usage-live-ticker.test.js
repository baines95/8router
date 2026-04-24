import { describe, it, expect, vi, afterEach } from "vitest";
import { createSharedTicker } from "../../src/app/(dashboard)/dashboard/usage/components/liveTicker";

describe("createSharedTicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses one interval for multiple subscribers and clears when last unsubscribes", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const ticker = createSharedTicker(5000);
    const unsubA = ticker.subscribe(() => {});
    const unsubB = ticker.subscribe(() => {});

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    unsubA();
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    unsubB();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});
