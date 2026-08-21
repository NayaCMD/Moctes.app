import { describe, expect, it } from "vitest";
import {
  beginRenderMeasurement,
  cancelRenderMeasurement,
  endRenderMeasurement,
  recordComponentRender,
} from "./performanceInstrumentation";

describe("performance render instrumentation", () => {
  it("counts renders only inside the active measurement", () => {
    cancelRenderMeasurement();
    recordComponentRender("DocumentPage");
    beginRenderMeasurement("drag");
    recordComponentRender("DocumentPage");
    recordComponentRender("ElementFrame");
    recordComponentRender("ElementFrame");

    expect(endRenderMeasurement("drag")).toEqual({
      DocumentPage: 1,
      ElementFrame: 2,
    });
    recordComponentRender("ElementFrame");
    expect(endRenderMeasurement("drag")).toEqual({});
  });

  it("does not consume a measurement with a different label", () => {
    beginRenderMeasurement("opening");
    recordComponentRender("DocumentPage");

    expect(endRenderMeasurement("resize")).toEqual({});
    expect(endRenderMeasurement("opening")).toEqual({ DocumentPage: 1 });
  });
});
