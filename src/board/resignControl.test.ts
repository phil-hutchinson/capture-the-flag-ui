import { describe, expect, it } from "vitest";
import {
  cancelResignConfirmation,
  describeResignConfirmation,
  initialResignConfirmState,
  startResignConfirmation,
} from "./resignControl.ts";

describe("resignControl - two-step confirmation state", () => {
  it("starts not confirming", () => {
    expect(initialResignConfirmState()).toEqual({ confirming: false });
  });

  it("pressing Resign the first time opens the confirmation", () => {
    expect(startResignConfirmation()).toEqual({ confirming: true });
  });

  it("pressing Cancel closes the confirmation again", () => {
    expect(cancelResignConfirmation()).toEqual({ confirming: false });
  });

  it("cancelling after confirming returns to the initial state", () => {
    const confirming = startResignConfirmation();
    expect(cancelResignConfirmation()).toEqual(initialResignConfirmState());
    // Cancelling never depends on the state it is cancelling from - it is
    // always a reset to "not confirming".
    expect(confirming.confirming).toBe(true);
  });
});

describe("resignControl - describeResignConfirmation", () => {
  it("names the opponent - the side that would win - never the resigning side", () => {
    expect(describeResignConfirmation("white")).toBe(
      "Resign the game? Blue wins immediately. This can't be undone.",
    );
    expect(describeResignConfirmation("black")).toBe(
      "Resign the game? Red wins immediately. This can't be undone.",
    );
  });

  it("never phrases the confirmation as an offer or something the opponent accepts or declines", () => {
    for (const side of ["white", "black"] as const) {
      const sentence = describeResignConfirmation(side);
      expect(sentence).not.toMatch(/accept/i);
      expect(sentence).not.toMatch(/decline/i);
      expect(sentence).not.toMatch(/offer/i);
    }
  });
});
