import { describe, expect, it } from "vitest";
import type { Side } from "./board.ts";
import type { BoardState, PlacedPiece } from "./gameState.ts";
import { computeOutcome, INACTIVITY_LIMIT, PROGRESS_LIMIT } from "./outcome.ts";
import type { PieceTypeId } from "./pieces.ts";

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

/** Counters with both sides at 0, unless overridden. */
function counters(
  overrides: Partial<Record<Side, number>> = {},
): Record<Side, number> {
  return { white: 0, black: 0, ...overrides };
}

/** A normal mid-game board: both Flags present, no §6.2 condition. */
function ordinaryBoard(): BoardState {
  return board([
    ["A1", "white", "flag"],
    ["L12", "black", "flag"],
    ["D5", "white", "infantry"],
    ["D9", "black", "militia"],
  ]);
}

describe("computeOutcome - ongoing", () => {
  it("is ongoing for an ordinary mid-game position with nothing in range", () => {
    const outcome = computeOutcome(ordinaryBoard(), "white", counters(), 0);
    expect(outcome).toEqual({ kind: "ongoing" });
  });
});

describe("computeOutcome - §6.1 Flag capture", () => {
  it("is a loss for the active side when their own Flag is gone", () => {
    const state = board([["L12", "black", "flag"]]); // no White Flag
    const outcome = computeOutcome(state, "white", counters(), 0);
    expect(outcome).toEqual({
      kind: "win",
      winner: "black",
      reason: "flagCapture",
    });
  });

  it("is a win for the active side when the opponent's Flag is gone", () => {
    const state = board([["A1", "white", "flag"]]); // no Black Flag
    const outcome = computeOutcome(state, "white", counters(), 0);
    expect(outcome).toEqual({
      kind: "win",
      winner: "white",
      reason: "flagCapture",
    });
  });

  it("still resolves as flag capture, not unbreachable flag, even when §6.2 also happens to hold", () => {
    // White's own Flag is enclosed and would win by §6.2 in its own right -
    // but Black's Flag is simply gone (captured), so flag capture (1) fires
    // first and reports that reason instead.
    const state = board([
      ["A1", "white", "flag"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
    ]);
    const outcome = computeOutcome(state, "white", counters(), 0);
    expect(outcome).toEqual({
      kind: "win",
      winner: "white",
      reason: "flagCapture",
    });
  });
});

describe("computeOutcome - §6.2 Unbreachable Flag", () => {
  function whiteEnclosedBoard(): BoardState {
    return board([
      ["A1", "white", "flag"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
      ["L12", "black", "flag"],
    ]);
  }

  it("is a win for the side whose Flag is enclosed and whose opponent has no available Sapper", () => {
    const outcome = computeOutcome(
      whiteEnclosedBoard(),
      "white",
      counters(),
      0,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "white",
      reason: "unbreachableFlag",
    });
  });

  it("gives the same result whichever side is to move", () => {
    const outcome = computeOutcome(
      whiteEnclosedBoard(),
      "black",
      counters(),
      0,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "white",
      reason: "unbreachableFlag",
    });
  });

  it("is a draw when both sides satisfy the condition at once (the mutual last-Sapper trade)", () => {
    const state = board([
      ["A1", "white", "flag"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
      ["L12", "black", "flag"],
      ["K12", "black", "tower"],
      ["L11", "black", "tower"],
    ]);
    const white = computeOutcome(state, "white", counters(), 0);
    const black = computeOutcome(state, "black", counters(), 0);
    expect(white).toEqual({ kind: "draw", reason: "unbreachableFlag" });
    expect(black).toEqual({ kind: "draw", reason: "unbreachableFlag" });
  });

  it("beats a simultaneous opponent-inactivity win, reporting the unbreachable-flag reason", () => {
    const outcome = computeOutcome(
      whiteEnclosedBoard(),
      "white",
      counters({ black: INACTIVITY_LIMIT }),
      0,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "white",
      reason: "unbreachableFlag",
    });
  });
});

describe("computeOutcome - §6.4 opponent inactivity", () => {
  it("is a win for the active side when the opponent's counter has reached the limit", () => {
    const outcome = computeOutcome(
      ordinaryBoard(),
      "white",
      counters({ black: INACTIVITY_LIMIT }),
      0,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "white",
      reason: "inactivity",
    });
  });

  it("is not triggered below the limit", () => {
    const outcome = computeOutcome(
      ordinaryBoard(),
      "white",
      counters({ black: INACTIVITY_LIMIT - 1 }),
      0,
    );
    expect(outcome).toEqual({ kind: "ongoing" });
  });

  it("beats a simultaneous progress-limit draw, resolving as the inactivity loss", () => {
    const outcome = computeOutcome(
      ordinaryBoard(),
      "white",
      counters({ black: INACTIVITY_LIMIT }),
      PROGRESS_LIMIT,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "white",
      reason: "inactivity",
    });
  });
});

describe("computeOutcome - §6.5 no progress", () => {
  it("is a draw once the shared progress counter has reached the limit", () => {
    const outcome = computeOutcome(
      ordinaryBoard(),
      "white",
      counters(),
      PROGRESS_LIMIT,
    );
    expect(outcome).toEqual({ kind: "draw", reason: "noProgress" });
  });

  it("is not triggered below the limit", () => {
    const outcome = computeOutcome(
      ordinaryBoard(),
      "white",
      counters(),
      PROGRESS_LIMIT - 1,
    );
    expect(outcome).toEqual({ kind: "ongoing" });
  });
});

describe("computeOutcome - §6.3 no legal move", () => {
  // A single mobile White piece (infantry) sealed into a corner by two
  // friendly Towers (immobile, so they never contribute a legal ply of
  // their own - mirrors the Flag-enclosure fixtures in
  // reachability.test.ts). Both Flags are present (elsewhere, in the open)
  // so §6.1/§6.2 do not fire, and no enemy piece is anywhere on the board -
  // the infantry has no empty destination (both neighbors are friendly
  // Towers) and no attack (neither neighbor is an enemy).
  function noLegalMoveBoard(): BoardState {
    return board([
      ["A1", "white", "infantry"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
      ["D1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
  }

  it("is a loss for the active side when it has no legal ply at all", () => {
    const outcome = computeOutcome(noLegalMoveBoard(), "white", counters(), 0);
    expect(outcome).toEqual({
      kind: "win",
      winner: "black",
      reason: "noLegalMove",
    });
  });

  it("is overridden by a simultaneous opponent-inactivity win (case 3 precedes case 5)", () => {
    const outcome = computeOutcome(
      noLegalMoveBoard(),
      "white",
      counters({ black: INACTIVITY_LIMIT }),
      0,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "white",
      reason: "inactivity",
    });
  });

  it("is overridden by a simultaneous no-progress draw (case 4 precedes case 5)", () => {
    const outcome = computeOutcome(
      noLegalMoveBoard(),
      "white",
      counters(),
      PROGRESS_LIMIT,
    );
    expect(outcome).toEqual({ kind: "draw", reason: "noProgress" });
  });
});

describe("computeOutcome - the active side's own inactivity counter (case 6, completeness)", () => {
  it("is a loss for the active side when its own counter has reached the limit and nothing else fires first", () => {
    const outcome = computeOutcome(
      ordinaryBoard(),
      "white",
      counters({ white: INACTIVITY_LIMIT }),
      0,
    );
    expect(outcome).toEqual({
      kind: "win",
      winner: "black",
      reason: "inactivity",
    });
  });
});
