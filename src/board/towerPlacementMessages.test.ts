import { describe, expect, it } from "vitest";
import type { Square } from "../rules/primary/v2/board.ts";
import type {
  TowerLegalityResult,
  TowerLegalityViolation,
} from "../rules/primary/v2/placement.ts";
import {
  describeClosedToTowersHint,
  describeTowerLaneBlocked,
  describeTowerLaneRefusal,
  describeTowerLegalityViolation,
  TOWER_SPACING_BLOCKED_MESSAGE,
  towerLiveRegionMessage,
} from "./towerPlacementMessages.ts";

const A3: Square = { column: "A", row: 3 };
const D3: Square = { column: "D", row: 3 };
const H3: Square = { column: "H", row: 3 };

describe("describeTowerLaneRefusal", () => {
  it("names the refused square and Tower, and explains why", () => {
    const message = describeTowerLaneRefusal(A3);
    expect(message).toContain("A3");
    expect(message).toContain("Tower");
    expect(message.toLowerCase()).toContain("lane");
  });

  it("never says 'ply'", () => {
    expect(describeTowerLaneRefusal(A3).toLowerCase()).not.toContain("ply");
  });
});

describe("describeClosedToTowersHint", () => {
  it("names every closed square and Towers, plural", () => {
    const message = describeClosedToTowersHint([A3, D3, H3]);
    expect(message).toContain("A3");
    expect(message).toContain("D3");
    expect(message).toContain("H3");
    expect(message).toContain("Towers");
    expect(message.toLowerCase()).toContain("lane");
  });

  it("joins squares with a natural-language 'or'", () => {
    expect(describeClosedToTowersHint([A3, D3, H3])).toContain("A3, D3 or H3");
  });

  it("names a single closed square without a comma", () => {
    expect(describeClosedToTowersHint([A3])).toContain("A3");
  });

  it("is the empty string for no closed squares (Battle)", () => {
    expect(describeClosedToTowersHint([])).toBe("");
  });
});

describe("TOWER_SPACING_BLOCKED_MESSAGE", () => {
  it("names Towers and explains the spacing rule", () => {
    expect(TOWER_SPACING_BLOCKED_MESSAGE).toContain("Towers");
    expect(TOWER_SPACING_BLOCKED_MESSAGE.toLowerCase()).toContain(
      "next to each other",
    );
  });
});

describe("describeTowerLaneBlocked", () => {
  it("names the one violating square, singular", () => {
    const message = describeTowerLaneBlocked([A3]);
    expect(message).toContain("A3");
    expect(message).toContain("One of your Towers");
  });

  it("names every violating square, plural, joined with 'and' (they are simultaneously true)", () => {
    const message = describeTowerLaneBlocked([A3, D3]);
    expect(message).toContain("A3 and D3");
    expect(message).toContain("Some of your Towers");
    expect(message).not.toContain("A3 or D3");
  });
});

describe("describeTowerLegalityViolation", () => {
  it("returns the spacing message for a spacing violation", () => {
    const violation: TowerLegalityViolation = {
      rule: "spacing",
      squares: [A3, D3],
    };
    expect(describeTowerLegalityViolation(violation)).toBe(
      TOWER_SPACING_BLOCKED_MESSAGE,
    );
  });

  it("returns the lane block message for a lane violation", () => {
    const violation: TowerLegalityViolation = { rule: "lane", squares: [A3] };
    expect(describeTowerLegalityViolation(violation)).toBe(
      describeTowerLaneBlocked([A3]),
    );
  });

  it("the spacing and lane sentences are distinguishable strings (Gate A)", () => {
    const spacing = describeTowerLegalityViolation({
      rule: "spacing",
      squares: [A3, D3],
    });
    const lane = describeTowerLegalityViolation({
      rule: "lane",
      squares: [A3],
    });
    expect(spacing).not.toBe(lane);
  });
});

describe("towerLiveRegionMessage", () => {
  const LEGAL: TowerLegalityResult = { legal: true };
  const SPACING_VIOLATION: TowerLegalityResult = {
    legal: false,
    rule: "spacing",
    squares: [A3, D3],
  };
  const LANE_VIOLATION: TowerLegalityResult = {
    legal: false,
    rule: "lane",
    squares: [A3],
  };

  it("is empty when nothing applies", () => {
    expect(
      towerLiveRegionMessage({
        refusal: null,
        closedSquares: [],
        legality: LEGAL,
      }),
    ).toBe("");
  });

  it("shows the confirm-time block when legality reports a violation", () => {
    expect(
      towerLiveRegionMessage({
        refusal: null,
        closedSquares: [],
        legality: SPACING_VIOLATION,
      }),
    ).toBe(describeTowerLegalityViolation(SPACING_VIOLATION));
    expect(
      towerLiveRegionMessage({
        refusal: null,
        closedSquares: [],
        legality: LANE_VIOLATION,
      }),
    ).toBe(describeTowerLegalityViolation(LANE_VIOLATION));
  });

  it("the closed-squares hint wins over the confirm-time block", () => {
    const message = towerLiveRegionMessage({
      refusal: null,
      closedSquares: [A3, D3],
      legality: SPACING_VIOLATION,
    });
    expect(message).toBe(describeClosedToTowersHint([A3, D3]));
    expect(message).not.toBe(describeTowerLegalityViolation(SPACING_VIOLATION));
  });

  it("a refusal wins over both the hint and the confirm-time block", () => {
    const refusal = describeTowerLaneRefusal(A3);
    const message = towerLiveRegionMessage({
      refusal,
      closedSquares: [A3, D3],
      legality: SPACING_VIOLATION,
    });
    expect(message).toBe(refusal);
  });
});
