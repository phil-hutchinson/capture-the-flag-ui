import { describe, expect, it } from "vitest";
import { STANDARD_BATTLE_CONFIGURATION } from "../rules/primary/v2/configuration.ts";
import type {
  BoardState,
  InitialGameState,
  PlacedPiece,
} from "../rules/primary/v2/gameState.ts";
import { RULESET_TAG } from "../rules/primary/v2/gameState.ts";
import { INACTIVITY_LIMIT } from "../rules/primary/v2/outcome.ts";
import type { PieceTypeId } from "../rules/primary/v2/pieces.ts";
import { startPlay, type PlayState } from "../rules/primary/v2/play.ts";
import { computeCountdownWarnings } from "./playWarnings.ts";

// Fixtures in this file use only pieces whose id and rank are identical in
// both the 1.1 and 1.2 catalogs (champion, militia, flag) - see this story's
// implementation-plan.md "Cross-step test constraint".

/** Builds an `InitialGameState` from a list of `[squareKey, side, pieceType]` triples. */
function initialGameState(
  pieces: readonly [string, PlacedPiece["side"], PieceTypeId][],
): InitialGameState {
  const board: Record<string, PlacedPiece> = {};
  for (const [key, side, pieceType] of pieces) {
    board[key] = { side, pieceType };
  }
  return {
    ruleset: RULESET_TAG,
    configuration: STANDARD_BATTLE_CONFIGURATION,
    board: board as BoardState,
  };
}

/**
 * A fresh, ordinary mid-game `PlayState`: both sides have a Flag (so the
 * game is genuinely ongoing) plus one spare mobile piece each, well away
 * from either Flag. Callers override `inactivityCounter` and `sideToMove` to
 * build the specific counter fixtures each test needs.
 */
function ongoingState(): PlayState {
  return startPlay(
    initialGameState([
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
    ]),
  );
}

/**
 * `computeCountdownWarnings` (story 00000036, Step 13) no longer takes a
 * `PlayState` directly - it takes whether the game is ongoing, the counter,
 * and the limit, so the same module serves both majors. This helper reads
 * those three primitives off a major-2 `PlayState`, matching how
 * `HotSeatGame.tsx`/`EngineGame.tsx` call it, so the fixtures below (and
 * their expectations) are unchanged from before that step.
 */
function warningsFor(state: PlayState) {
  return computeCountdownWarnings(
    state.result.kind === "ongoing",
    state.inactivityCounter,
    INACTIVITY_LIMIT,
  );
}

describe("computeCountdownWarnings", () => {
  it("shows no warning at the start of a game", () => {
    const warnings = warningsFor(ongoingState());
    expect(warnings.inactivity).toBeNull();
  });

  it("does not warn at 11 combined moves remaining (39 used)", () => {
    const state: PlayState = { ...ongoingState(), inactivityCounter: 39 };
    expect(warningsFor(state).inactivity).toBeNull();
  });

  it("warns at 10 combined moves remaining (40 used)", () => {
    const state: PlayState = { ...ongoingState(), inactivityCounter: 40 };
    const warning = warningsFor(state).inactivity;
    expect(warning).not.toBeNull();
    expect(warning?.movesRemaining).toBe(10);
  });

  it("appears regardless of whose turn it is", () => {
    const white: PlayState = {
      ...ongoingState(),
      sideToMove: "white",
      inactivityCounter: 40,
    };
    const black: PlayState = {
      ...ongoingState(),
      sideToMove: "black",
      inactivityCounter: 40,
    };
    expect(warningsFor(white).inactivity).not.toBeNull();
    expect(warningsFor(black).inactivity).not.toBeNull();
  });

  it.each([
    [40, 10],
    [45, 5],
    [49, 1],
  ])(
    "reports %i moves used as %i moves remaining",
    (used, expectedRemaining) => {
      const state: PlayState = { ...ongoingState(), inactivityCounter: used };
      expect(warningsFor(state).inactivity?.movesRemaining).toBe(
        expectedRemaining,
      );
    },
  );

  it("names the remaining count and that removing a piece resets it, without naming a side", () => {
    const state: PlayState = { ...ongoingState(), inactivityCounter: 45 };
    const warning = warningsFor(state).inactivity;
    expect(warning?.message).toContain("5");
    expect(warning?.message.toLowerCase()).toContain("removing a piece");
    expect(warning?.message).not.toContain("Red");
    expect(warning?.message).not.toContain("Blue");
  });

  it("reaching the inactivity limit still reports (game-over suppression is separate)", () => {
    const state: PlayState = {
      ...ongoingState(),
      inactivityCounter: INACTIVITY_LIMIT - 1,
    };
    expect(warningsFor(state).inactivity?.movesRemaining).toBe(1);
  });

  it("shows no warning at all once the game is over, even with the counter deep in range", () => {
    const state: PlayState = {
      ...ongoingState(),
      inactivityCounter: INACTIVITY_LIMIT - 1,
      result: { kind: "win", winner: "black", reason: "flagCapture" },
    };
    const warnings = warningsFor(state);
    expect(warnings.inactivity).toBeNull();
  });

  it("warns against a different limit when one is passed, per Decision 10", () => {
    // A Demotion game passes v3's own limit (40) rather than major 2's (50).
    // The 10-move threshold is unchanged, so the boundary shifts with the
    // limit exactly as it does at major 2 (there, the first warning appears
    // at counter 40 = limit 50 - 10): here, at counter 29 (11 remaining)
    // there is no warning, and at counter 30 (10 remaining) there is.
    expect(computeCountdownWarnings(true, 29, 40).inactivity).toBeNull();
    const warning = computeCountdownWarnings(true, 30, 40).inactivity;
    expect(warning).not.toBeNull();
    expect(warning?.movesRemaining).toBe(10);
  });
});
