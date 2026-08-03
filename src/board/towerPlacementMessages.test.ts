import { describe, expect, it } from "vitest";
import type { Square } from "../rules/primary/v2/board.ts";
import type {
  TowerLegalityResult,
  TowerLegalityViolation,
} from "../rules/primary/v2/placement.ts";
import {
  AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE,
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

describe("AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE", () => {
  it("names Towers, explains why, and says what to do", () => {
    expect(AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE).toContain("Towers");
    expect(AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE.toLowerCase()).toContain(
      "touching",
    );
    expect(AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE.toLowerCase()).toContain("clear");
  });

  it("never says 'ply' or names an edition id", () => {
    const lower = AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE.toLowerCase();
    expect(lower).not.toContain("ply");
    expect(lower).not.toContain("2-0");
    expect(lower).not.toContain("2-1");
  });

  it("is a distinguishable sentence from every other Tower message (Gate A)", () => {
    expect(AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE).not.toBe(
      TOWER_SPACING_BLOCKED_MESSAGE,
    );
    expect(AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE).not.toBe(
      describeTowerLaneRefusal(A3),
    );
    expect(AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE).not.toBe(
      describeClosedToTowersHint([A3]),
    );
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
        autoFillExhausted: null,
        closedSquares: [],
        legality: LEGAL,
      }),
    ).toEqual({ text: "", seq: 0 });
  });

  it("shows the confirm-time block when legality reports a violation", () => {
    expect(
      towerLiveRegionMessage({
        refusal: null,
        autoFillExhausted: null,
        closedSquares: [],
        legality: SPACING_VIOLATION,
      }),
    ).toEqual({
      text: describeTowerLegalityViolation(SPACING_VIOLATION),
      seq: 0,
    });
    expect(
      towerLiveRegionMessage({
        refusal: null,
        autoFillExhausted: null,
        closedSquares: [],
        legality: LANE_VIOLATION,
      }),
    ).toEqual({ text: describeTowerLegalityViolation(LANE_VIOLATION), seq: 0 });
  });

  it("the closed-squares hint wins over the confirm-time block", () => {
    const message = towerLiveRegionMessage({
      refusal: null,
      autoFillExhausted: null,
      closedSquares: [A3, D3],
      legality: SPACING_VIOLATION,
    });
    expect(message).toEqual({
      text: describeClosedToTowersHint([A3, D3]),
      seq: 0,
    });
    expect(message.text).not.toBe(
      describeTowerLegalityViolation(SPACING_VIOLATION),
    );
  });

  it("an exhausted Auto-fill attempt wins over the hint and the confirm-time block (story 00000025's Step 8)", () => {
    const message = towerLiveRegionMessage({
      refusal: null,
      autoFillExhausted: { seq: 1 },
      closedSquares: [A3, D3],
      legality: SPACING_VIOLATION,
    });
    expect(message).toEqual({
      text: AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE,
      seq: 1,
    });
  });

  it("a refusal wins over an exhausted Auto-fill attempt, the hint, and the confirm-time block", () => {
    const refusal = { text: describeTowerLaneRefusal(A3), seq: 3 };
    const message = towerLiveRegionMessage({
      refusal,
      autoFillExhausted: { seq: 5 },
      closedSquares: [A3, D3],
      legality: SPACING_VIOLATION,
    });
    expect(message).toEqual(refusal);
  });

  it("carries the refusal's seq through unchanged (peer review finding #5)", () => {
    // A repeat refusal of the same square produces identical text but a
    // higher seq - the token `PlacementStatus` uses to force a fresh
    // announcement even though the text alone did not change.
    const first = towerLiveRegionMessage({
      refusal: { text: describeTowerLaneRefusal(A3), seq: 1 },
      autoFillExhausted: null,
      closedSquares: [],
      legality: LEGAL,
    });
    const second = towerLiveRegionMessage({
      refusal: { text: describeTowerLaneRefusal(A3), seq: 2 },
      autoFillExhausted: null,
      closedSquares: [],
      legality: LEGAL,
    });
    expect(first.text).toBe(second.text);
    expect(first.seq).not.toBe(second.seq);
  });

  it("carries the exhausted-Auto-fill seq through unchanged, mirroring the refusal (Step 8)", () => {
    // Repeated Auto-fill exhaustion produces identical text but a higher
    // seq, exactly like a repeated refusal - so a second identical failure
    // still forces a fresh announcement.
    const first = towerLiveRegionMessage({
      refusal: null,
      autoFillExhausted: { seq: 1 },
      closedSquares: [],
      legality: LEGAL,
    });
    const second = towerLiveRegionMessage({
      refusal: null,
      autoFillExhausted: { seq: 2 },
      closedSquares: [],
      legality: LEGAL,
    });
    expect(first.text).toBe(second.text);
    expect(first.seq).not.toBe(second.seq);
  });
});
