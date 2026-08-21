import { describe, expect, it, vi } from "vitest";
import { retryImport } from "./lazyImport";

describe("retryImport", () => {
  it("retries one transient chunk-loading failure", async () => {
    const load = vi
      .fn<() => Promise<{ value: string }>>()
      .mockRejectedValueOnce(new Error("temporary chunk failure"))
      .mockResolvedValueOnce({ value: "loaded" });

    await expect(retryImport(load, 0)).resolves.toEqual({ value: "loaded" });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
