import { describe, expect, it } from "@rstest/core";
import {
  describeKernelStatus,
  kernelButtonLabel,
} from "../src/ui/kernel_status";

describe("describeKernelStatus", () => {
  it("maps each kernel state to a Colab-style footer line", () => {
    expect(describeKernelStatus("idle", null).title).toBe("Not connected");
    expect(describeKernelStatus("loading", null).title).toBe("Connecting…");
    expect(describeKernelStatus("ready", null)).toEqual({
      title: "Connected",
      hint: "Pyodide",
    });
    expect(describeKernelStatus("busy", null)).toEqual({
      title: "Running",
      hint: "Click to interrupt",
    });
    expect(kernelButtonLabel("busy")).toBe(
      "Kernel running — click to interrupt",
    );
    expect(kernelButtonLabel("ready")).toBe("Kernel ready — click to restart");
    expect(describeKernelStatus("error", "boom").hint).toBe("boom");
    expect(describeKernelStatus("error", null).hint).toBe("Click to retry");
  });
});
