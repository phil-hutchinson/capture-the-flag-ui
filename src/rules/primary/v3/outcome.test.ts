import { describe, expect, it } from "vitest";
import type { Square } from "./board.ts";
import { computeOutcome, INACTIVITY_LIMIT } from "./outcome.ts";
import {
  EMPTY_POSITION,
  placePiece,
  type FlagPiece,
  type NumberedPiece,
  type PositionState,
} from "./position.ts";

const A1: Square = { column: "A", row: 1 };
const A2: Square = { column: "A", row: 2 };
const B1: Square = { column: "B", row: 1 };
const B2: Square = { column: "B", row: 2 };

const whiteRank5: NumberedPiece = { side: "white", kind: "numbered", rank: 5 };
const blackRank3: NumberedPiece = { side: "black", kind: "numbered", rank: 3 };
const whiteFlag: FlagPiece = { side: "white", kind: "flag" };
const blackFlag: FlagPiece = { side: "black", kind: "flag" };

/** A position with both Flags and one numbered piece each - fully "ongoing" unless noted otherwise. */
function basePosition(): PositionState {
  let position = placePiece(EMPTY_POSITION, A1, whiteFlag);
  position = placePiece(position, A2, whiteRank5);
  position = placePiece(position, B1, blackFlag);
  position = placePiece(position, B2, blackRank3);
  return position;
}

describe("outcome (ruleset major 3): endings detected from the position", () => {
  it("is ongoing when both sides have their Flag and a numbered piece", () => {
    expect(computeOutcome(basePosition(), "white", 0)).toEqual({
      kind: "ongoing",
    });
  });

  it("§5.1 Flag capture wins for whoever still has a Flag, regardless of what else is on the board", () => {
    // Black's Flag is gone - White wins, even though it is White to move next
    // (this mirrors how `computeOutcome` is called: after every move,
    // including the opponent's).
    const position = placePiece(basePosition(), B1, whiteRank5);
    expect(computeOutcome(position, "black", 0)).toEqual({
      kind: "win",
      winner: "white",
      reason: "flagCapture",
    });

    // White's Flag is gone - Black wins.
    let missingWhiteFlag = placePiece(EMPTY_POSITION, A2, whiteRank5);
    missingWhiteFlag = placePiece(missingWhiteFlag, B1, blackFlag);
    missingWhiteFlag = placePiece(missingWhiteFlag, B2, blackRank3);
    expect(computeOutcome(missingWhiteFlag, "white", 0)).toEqual({
      kind: "win",
      winner: "black",
      reason: "flagCapture",
    });
  });

  it("§5.2 Attrition: a side holding only its Flag loses immediately", () => {
    // White has no numbered piece left; Black still has one.
    let position = placePiece(EMPTY_POSITION, A1, whiteFlag);
    position = placePiece(position, B1, blackFlag);
    position = placePiece(position, B2, blackRank3);
    expect(computeOutcome(position, "white", 0)).toEqual({
      kind: "win",
      winner: "black",
      reason: "attrition",
    });
  });

  it("a side with one numbered piece and its Flag is still ongoing (not attrition)", () => {
    expect(computeOutcome(basePosition(), "black", 0)).toEqual({
      kind: "ongoing",
    });
  });

  it("§5.3 Mutual attrition: both sides holding only their Flag draws, and is not a win for either side checked", () => {
    let position = placePiece(EMPTY_POSITION, A1, whiteFlag);
    position = placePiece(position, B1, blackFlag);

    // The precedence must hold regardless of which side is "active" - this
    // is exactly the ordering the plan calls out: mutual attrition must not
    // resolve as a win for whichever side `computeOutcome` happens to check
    // first.
    expect(computeOutcome(position, "white", 0)).toEqual({
      kind: "draw",
      reason: "mutualAttrition",
    });
    expect(computeOutcome(position, "black", 0)).toEqual({
      kind: "draw",
      reason: "mutualAttrition",
    });
  });

  it("Flag capture outranks a simultaneous attrition", () => {
    // Black has lost both its Flag and its last numbered piece in the same
    // move (e.g. the winning piece captured the Flag and Black's only other
    // piece happened to already be gone) - this must resolve as a Flag
    // capture, not as attrition.
    let position = placePiece(EMPTY_POSITION, A1, whiteFlag);
    position = placePiece(position, A2, whiteRank5);
    expect(computeOutcome(position, "black", 0)).toEqual({
      kind: "win",
      winner: "white",
      reason: "flagCapture",
    });
  });

  it("§5.4 Inactivity: ongoing below the limit, a draw exactly at it - 40, not 39 or 50", () => {
    expect(computeOutcome(basePosition(), "white", 39)).toEqual({
      kind: "ongoing",
    });
    expect(computeOutcome(basePosition(), "white", 40)).toEqual({
      kind: "draw",
      reason: "inactivity",
    });
    expect(INACTIVITY_LIMIT).toBe(40);
  });

  it("attrition and mutual attrition are checked before inactivity, even once the counter has reached the limit", () => {
    let position = placePiece(EMPTY_POSITION, A1, whiteFlag);
    position = placePiece(position, B1, blackFlag);
    position = placePiece(position, B2, blackRank3);
    expect(computeOutcome(position, "white", 40)).toEqual({
      kind: "win",
      winner: "black",
      reason: "attrition",
    });
  });
});
