import { describe, expect, it } from "vitest";
import type {
  BoardState,
  InitialGameState,
  PlacedPiece,
} from "../rules/primary/v1/gameState.ts";
import { RULESET_TAG } from "../rules/primary/v1/gameState.ts";
import {
  INACTIVITY_LIMIT,
  PROGRESS_LIMIT,
} from "../rules/primary/v1/outcome.ts";
import type { PieceTypeId } from "../rules/primary/v1/pieces.ts";
import { startPlay, type PlayState } from "../rules/primary/v1/play.ts";
import { computeCountdownWarnings } from "./playWarnings.ts";

/** Builds an `InitialGameState` from a list of `[squareKey, side, pieceType]` triples. */
function initialGameState(
  pieces: readonly [string, PlacedPiece["side"], PieceTypeId][],
): InitialGameState {
  const board: Record<string, PlacedPiece> = {};
  for (const [key, side, pieceType] of pieces) {
    board[key] = { side, pieceType };
  }
  return { ruleset: RULESET_TAG, board: board as BoardState };
}

/**
 * A fresh, ordinary mid-game `PlayState`: both sides have a Flag (so the
 * game is genuinely ongoing) plus one spare mobile piece each, well away
 * from either Flag. Callers override `inactivityCounters`, `progressCounter`,
 * and `sideToMove` to build the specific counter fixtures each test needs.
 */
function ongoingState(): PlayState {
  return startPlay(
    initialGameState([
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
    ]),
  );
}

describe("computeCountdownWarnings", () => {
  it("shows no warnings at the start of a game", () => {
    const warnings = computeCountdownWarnings(ongoingState());
    expect(warnings.inactivity).toBeNull();
    expect(warnings.noProgress).toBeNull();
  });

  describe("inactivity warning", () => {
    it("does not warn at 11 of the side to move's own moves remaining (39 used)", () => {
      const state: PlayState = {
        ...ongoingState(),
        sideToMove: "white",
        inactivityCounters: { white: 39, black: 0 },
      };
      expect(computeCountdownWarnings(state).inactivity).toBeNull();
    });

    it("warns at 10 of the side to move's own moves remaining (40 used)", () => {
      const state: PlayState = {
        ...ongoingState(),
        sideToMove: "white",
        inactivityCounters: { white: 40, black: 0 },
      };
      const warning = computeCountdownWarnings(state).inactivity;
      expect(warning).not.toBeNull();
      expect(warning?.side).toBe("white");
      expect(warning?.movesRemaining).toBe(10);
    });

    it("does not warn for the same counter when that side is not to move", () => {
      const state: PlayState = {
        ...ongoingState(),
        sideToMove: "black",
        inactivityCounters: { white: 40, black: 0 },
      };
      expect(computeCountdownWarnings(state).inactivity).toBeNull();
    });

    it.each([
      [40, 10],
      [45, 5],
      [49, 1],
    ])(
      "reports %i moves used as %i moves remaining",
      (used, expectedRemaining) => {
        const state: PlayState = {
          ...ongoingState(),
          sideToMove: "white",
          inactivityCounters: { white: used, black: 0 },
        };
        expect(computeCountdownWarnings(state).inactivity?.movesRemaining).toBe(
          expectedRemaining,
        );
      },
    );

    it("names the at-risk side's color, the remaining count, and that an attack resets it", () => {
      const state: PlayState = {
        ...ongoingState(),
        sideToMove: "black",
        inactivityCounters: { white: 0, black: 45 },
      };
      const warning = computeCountdownWarnings(state).inactivity;
      expect(warning?.message).toContain("Blue");
      expect(warning?.message).toContain("5");
      expect(warning?.message.toLowerCase()).toContain("attack");
    });

    it("reaching the inactivity limit still reports (game-over suppression is separate)", () => {
      const state: PlayState = {
        ...ongoingState(),
        sideToMove: "white",
        inactivityCounters: { white: INACTIVITY_LIMIT - 1, black: 0 },
      };
      expect(computeCountdownWarnings(state).inactivity?.movesRemaining).toBe(
        1,
      );
    });
  });

  describe("no-progress warning", () => {
    it("does not warn at 21 combined moves remaining (progress 59)", () => {
      const state: PlayState = { ...ongoingState(), progressCounter: 59 };
      expect(computeCountdownWarnings(state).noProgress).toBeNull();
    });

    it("warns at 20 combined moves remaining (progress 60)", () => {
      const state: PlayState = { ...ongoingState(), progressCounter: 60 };
      const warning = computeCountdownWarnings(state).noProgress;
      expect(warning).not.toBeNull();
      expect(warning?.movesRemaining).toBe(20);
    });

    it("appears regardless of whose turn it is", () => {
      const white: PlayState = {
        ...ongoingState(),
        sideToMove: "white",
        progressCounter: 60,
      };
      const black: PlayState = {
        ...ongoingState(),
        sideToMove: "black",
        progressCounter: 60,
      };
      expect(computeCountdownWarnings(white).noProgress).not.toBeNull();
      expect(computeCountdownWarnings(black).noProgress).not.toBeNull();
    });

    it.each([
      [60, 20],
      [70, 10],
      [79, 1],
    ])(
      "reports progress %i as %i moves remaining",
      (progress, expectedRemaining) => {
        const state: PlayState = {
          ...ongoingState(),
          progressCounter: progress,
        };
        expect(computeCountdownWarnings(state).noProgress?.movesRemaining).toBe(
          expectedRemaining,
        );
      },
    );

    it("names the remaining count in the sentence", () => {
      const state: PlayState = { ...ongoingState(), progressCounter: 70 };
      const warning = computeCountdownWarnings(state).noProgress;
      expect(warning?.message).toContain("10");
    });

    it("reaching the progress limit still reports (game-over suppression is separate)", () => {
      const state: PlayState = {
        ...ongoingState(),
        progressCounter: PROGRESS_LIMIT - 1,
      };
      expect(computeCountdownWarnings(state).noProgress?.movesRemaining).toBe(
        1,
      );
    });
  });

  it("shows both warnings together when both counters are in range", () => {
    const state: PlayState = {
      ...ongoingState(),
      sideToMove: "white",
      inactivityCounters: { white: 42, black: 0 },
      progressCounter: 65,
    };
    const warnings = computeCountdownWarnings(state);
    expect(warnings.inactivity).not.toBeNull();
    expect(warnings.noProgress).not.toBeNull();
  });

  it("shows no warnings at all once the game is over, even with both counters deep in range", () => {
    const state: PlayState = {
      ...ongoingState(),
      sideToMove: "white",
      inactivityCounters: { white: 49, black: 49 },
      progressCounter: 79,
      result: { kind: "win", winner: "black", reason: "flagCapture" },
    };
    const warnings = computeCountdownWarnings(state);
    expect(warnings.inactivity).toBeNull();
    expect(warnings.noProgress).toBeNull();
  });
});
