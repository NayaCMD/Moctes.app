import { describe, expect, it } from "vitest";
import { measureSerializedBytes, round } from "./performanceMetrics";

describe("performance metrics", () => {
  it("measures serialized state as UTF-8 bytes", () => {
    expect(measureSerializedBytes({ value: "a" })).toBe(13);
    expect(measureSerializedBytes({ value: "ação" })).toBe(
      new TextEncoder().encode('{"value":"ação"}').byteLength,
    );
  });

  it("rounds metrics consistently", () => {
    expect(round(59.987)).toBe(59.99);
    expect(round(0.123_456, 4)).toBe(0.1235);
  });
});
