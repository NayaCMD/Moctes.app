import { describe, expect, it } from "vitest";
import {
  assetAvailabilityCopy,
  availabilityFromProcessingStatus,
} from "./assetAvailability.utils";

describe("asset availability presentation", () => {
  it("maps only persisted lifecycle states to presentation states", () => {
    expect(availabilityFromProcessingStatus("PENDING")).toBe("pending");
    expect(availabilityFromProcessingStatus("PROCESSING")).toBe("processing");
    expect(availabilityFromProcessingStatus("READY")).toBeNull();
    expect(availabilityFromProcessingStatus("QUARANTINED")).toBe(
      "quarantined",
    );
    expect(availabilityFromProcessingStatus("REJECTED")).toBe("rejected");
  });

  it("exposes a safe rejection reason instead of infrastructure details", () => {
    expect(
      assetAvailabilityCopy("rejected", {
        code: "SOURCE_TYPE_MISMATCH",
        message: "internal storage path and scanner output",
      }),
    ).toMatchObject({
      title: "Arquivo não permitido",
      detail: "O conteúdo não corresponde ao formato informado.",
    });
    expect(
      assetAvailabilityCopy("quarantined", {
        code: "MALWARE_DETECTED",
        message: "Eicar-Test-Signature",
      }).detail,
    ).toBe("O arquivo não passou pelas verificações de segurança.");
  });
});
