import { describe, expect, it } from "vitest";
import {
  configureRules,
  STANDARD_BATTLE_CONFIGURATION,
  STANDARD_SKIRMISH_CONFIGURATION,
} from "./configuration.ts";
import { BATTLE_EDITION } from "./edition.ts";
import type { BoardState, PlacedPiece } from "./gameState.ts";
import { computeOutcome, INACTIVITY_LIMIT } from "./outcome.ts";
import type { PieceTypeId } from "./pieces.ts";

// Fixtures in this file use only pieces whose id and rank are identical in
// both the 1.1 and 1.2 catalogs (champion, knight, militia, tower, flag) -
// see this story's implementation-plan.md "Cross-step test constraint": the
// piece catalog itself is not replaced until Step 5, and these fixtures must
// stay valid unchanged through that step.

/** Builds a `BoardState` from a list of `[squareKey, side, pieceType]` triples. */
function board(
  pieces: readonly [string, PlacedPiece["side"], PieceTypeId][],
): BoardState {
  const result: Record<string, PlacedPiece> = {};
  for (const [key, side, pieceType] of pieces) {
    result[key] = { side, pieceType };
  }
  return result;
}

/** A normal mid-game board: both Flags present, both sides with a mobile piece. */
function ordinaryBoard(): BoardState {
  return board([
    ["A1", "white", "flag"],
    ["L12", "black", "flag"],
    ["D5", "white", "champion"],
    ["D9", "black", "militia"],
  ]);
}

describe("computeOutcome - ongoing", () => {
  it("is ongoing for an ordinary mid-game position with nothing in range", () => {
    const outcome = computeOutcome(
      ordinaryBoard(),
      "white",
      0,
      STANDARD_BATTLE_CONFIGURATION,
    );
    expect(outcome).toEqual({ kind: "ongoing" });
  });
});

describe("computeOutcome - §5.1 Flag capture", () => {
  it("is a loss for the active side when their own Flag is gone", () => {
    const state = board([["L12", "black", "flag"]]); // no White Flag
    const outcome = computeOutcome(
      state,
      "white",
      0,
      STANDARD_BATTLE_CONFIGURATION,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "black",
      reason: "flagCapture",
    });
  });

  it("is a win for the active side when the opponent's Flag is gone", () => {
    const state = board([["A1", "white", "flag"]]); // no Black Flag
    const outcome = computeOutcome(
      state,
      "white",
      0,
      STANDARD_BATTLE_CONFIGURATION,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "white",
      reason: "flagCapture",
    });
  });

  it("precedes no-legal-move: an active side missing its own Flag loses even if it also has no legal ply", () => {
    // White's only mobile piece is sealed in by its own Towers (no legal
    // ply), and White's Flag is gone - flag capture (1) must fire first,
    // reporting flagCapture rather than noLegalMove.
    const state = board([
      ["A1", "white", "champion"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
      ["L12", "black", "flag"],
    ]);
    const outcome = computeOutcome(
      state,
      "white",
      0,
      STANDARD_BATTLE_CONFIGURATION,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "black",
      reason: "flagCapture",
    });
  });
});

describe("computeOutcome - §5.2 no legal move", () => {
  // A single mobile White piece (champion) sealed into a corner by two
  // friendly Towers (immobile, so they never contribute a legal ply of
  // their own). Both Flags are present (elsewhere, in the open) so §5.1
  // does not fire, and no enemy piece is anywhere on the board - the
  // champion has no empty destination (both neighbors are friendly Towers)
  // and no attack (neither neighbor is an enemy).
  function noLegalMoveBoard(): BoardState {
    return board([
      ["A1", "white", "champion"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
      ["D1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
  }

  it("is a loss for the active side when it has no legal ply at all", () => {
    const outcome = computeOutcome(
      noLegalMoveBoard(),
      "white",
      0,
      STANDARD_BATTLE_CONFIGURATION,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "black",
      reason: "noLegalMove",
    });
  });

  it("is unaffected by the inactivity counter's value", () => {
    const outcome = computeOutcome(
      noLegalMoveBoard(),
      "white",
      INACTIVITY_LIMIT,
      STANDARD_BATTLE_CONFIGURATION,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "black",
      reason: "noLegalMove",
    });
  });

  it("does not fire for the side merely waiting its turn, only for the side actually to move", () => {
    // Swap the boxed-in champion to Black's side of the same shape; it is
    // White to move (an unrelated, ordinary champion elsewhere), so the
    // boxed-in side (Black) is not the active side and the game is ongoing.
    const state = board([
      ["A1", "black", "champion"],
      ["A2", "black", "tower"],
      ["B1", "black", "tower"],
      ["D1", "black", "flag"],
      ["L12", "white", "flag"],
      ["H5", "white", "militia"],
    ]);
    const outcome = computeOutcome(
      state,
      "white",
      0,
      STANDARD_BATTLE_CONFIGURATION,
    );
    expect(outcome).toEqual({ kind: "ongoing" });
  });
});

// Story 00000027, Step 5: `DIAGONAL_ATTACK_PATH=open_path` narrows the
// diagonal loop `hasAnyLegalPly` is built on, so it can - barely - reach
// §5.2 "no legal move" too. Per the implementation plan, this scenario needs
// the side's last movable piece boxed in orthogonally by edges, lakes and
// its own immobile pieces, with a diagonal attack as its only ply; it is a
// corner case, not designed around further.
describe("computeOutcome - §5.2 reached via DIAGONAL_ATTACK_PATH=open_path (story 00000027)", () => {
  // White's champion is boxed into corner A1 by its own two Towers at A2 and
  // B1 (no orthogonal moves, and neither Tower is an enemy to attack). Its
  // only possible ply is the diagonal attack on the Black militia at B2 -
  // whose flanks are exactly A2 and B1, both occupied by White's own Towers.
  function boxedInWithOneDiagonalAttack(): BoardState {
    return board([
      ["A1", "white", "champion"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
      ["B2", "black", "militia"],
      ["D1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
  }

  it("is ongoing under the standard configuration - the diagonal attack is a legal ply regardless of its flanks", () => {
    const outcome = computeOutcome(
      boxedInWithOneDiagonalAttack(),
      "white",
      0,
      STANDARD_BATTLE_CONFIGURATION,
    );
    expect(outcome).toEqual({ kind: "ongoing" });
  });

  it("is a noLegalMove loss under DIAGONAL_ATTACK_PATH=open_path - both of the attack's flanks are blocked", () => {
    const openPathConfiguration = configureRules(BATTLE_EDITION, {
      DIAGONAL_ATTACK_PATH: "open_path",
    });
    const outcome = computeOutcome(
      boxedInWithOneDiagonalAttack(),
      "white",
      0,
      openPathConfiguration,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "black",
      reason: "noLegalMove",
    });
  });
});

describe("computeOutcome - §5.3 shared inactivity draw", () => {
  it("is a draw once the shared counter has reached the limit", () => {
    const outcome = computeOutcome(
      ordinaryBoard(),
      "white",
      INACTIVITY_LIMIT,
      STANDARD_BATTLE_CONFIGURATION,
    );
    expect(outcome).toEqual({ kind: "draw", reason: "inactivity" });
  });

  it("is not triggered below the limit", () => {
    const outcome = computeOutcome(
      ordinaryBoard(),
      "white",
      INACTIVITY_LIMIT - 1,
      STANDARD_BATTLE_CONFIGURATION,
    );
    expect(outcome).toEqual({ kind: "ongoing" });
  });

  it("is overridden by a simultaneous flag capture (case 1 precedes case 3)", () => {
    const state = board([["A1", "white", "flag"]]); // no Black Flag
    const outcome = computeOutcome(
      state,
      "white",
      INACTIVITY_LIMIT,
      STANDARD_BATTLE_CONFIGURATION,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "white",
      reason: "flagCapture",
    });
  });

  it("is overridden by a simultaneous no-legal-move loss (case 2 precedes case 3)", () => {
    const state = board([
      ["A1", "white", "champion"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
      ["D1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    const outcome = computeOutcome(
      state,
      "white",
      INACTIVITY_LIMIT,
      STANDARD_BATTLE_CONFIGURATION,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "black",
      reason: "noLegalMove",
    });
  });
});

// Story 00000023, Step 3: the same detection above, exercised on the
// Skirmish layout (`standard_64`, 8x8) instead of the Battle default, to
// confirm the Flag scan and `hasAnyLegalPly` are genuinely parametric over
// `BoardLayout` rather than hardcoding Battle's 12x12 grid.
describe("computeOutcome on the Skirmish layout (8x8)", () => {
  it("is ongoing for an ordinary mid-game position", () => {
    const state = board([
      ["A1", "white", "flag"],
      ["H8", "black", "flag"],
      ["D3", "white", "champion"],
      ["D6", "black", "militia"],
    ]);
    expect(
      computeOutcome(state, "white", 0, STANDARD_SKIRMISH_CONFIGURATION),
    ).toEqual({
      kind: "ongoing",
    });
  });

  it("is a win for the active side when the opponent's Flag is gone", () => {
    const state = board([["A1", "white", "flag"]]); // no Black Flag
    expect(
      computeOutcome(state, "white", 0, STANDARD_SKIRMISH_CONFIGURATION),
    ).toEqual({
      kind: "win",
      winner: "white",
      reason: "flagCapture",
    });
  });

  it("is a loss for the active side when it has no legal ply at all, boxed into the H8 corner", () => {
    const state = board([
      ["H8", "white", "champion"],
      ["H7", "white", "tower"],
      ["G8", "white", "tower"],
      ["A1", "white", "flag"],
      ["A8", "black", "flag"],
    ]);
    expect(
      computeOutcome(state, "white", 0, STANDARD_SKIRMISH_CONFIGURATION),
    ).toEqual({
      kind: "win",
      winner: "black",
      reason: "noLegalMove",
    });
  });

  it("is a draw once the shared counter has reached the limit", () => {
    const state = board([
      ["A1", "white", "flag"],
      ["H8", "black", "flag"],
      ["D3", "white", "champion"],
      ["D6", "black", "militia"],
    ]);
    expect(
      computeOutcome(
        state,
        "white",
        INACTIVITY_LIMIT,
        STANDARD_SKIRMISH_CONFIGURATION,
      ),
    ).toEqual({
      kind: "draw",
      reason: "inactivity",
    });
  });

  it("does not look past the Skirmish edge for a Flag - a square that would be on-board for Battle (row 9) but is off-board for Skirmish is never consulted", () => {
    // White's Flag is planted at A9 - off-board for Skirmish (rows only run
    // 1-8) but a real, on-board square for Battle. Scanning only Skirmish's
    // own squares must not find it, so White is treated as having no Flag.
    const state = board([
      ["A9", "white", "flag"],
      ["H8", "black", "flag"],
    ]);
    expect(
      computeOutcome(state, "white", 0, STANDARD_SKIRMISH_CONFIGURATION),
    ).toEqual({
      kind: "win",
      winner: "black",
      reason: "flagCapture",
    });
  });
});
