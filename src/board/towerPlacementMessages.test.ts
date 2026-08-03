import { describe, expect, it } from "vitest";
import type { Square } from "../rules/primary/v2/board.ts";
import type { TowerLegalityViolation } from "../rules/primary/v2/placement.ts";
import {
  describeClosedToTowersHint,
  describeTowerLaneBlocked,
  describeTowerLaneRefusal,
  describeTowerLegalityViolation,
  TOWER_SPACING_BLOCKED_MESSAGE,
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

  it("names every violating square, plural", () => {
    const message = describeTowerLaneBlocked([A3, D3]);
    expect(message).toContain("A3");
    expect(message).toContain("D3");
    expect(message).toContain("Some of your Towers");
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
