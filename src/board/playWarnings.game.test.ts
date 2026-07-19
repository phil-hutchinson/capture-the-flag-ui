// Countdown warning driven through a *real* game.
//
// `playWarnings.test.ts` unit-tests `computeCountdownWarnings` against
// hand-built counter fixtures - it sets `inactivityCounter` directly. That
// proves the threshold and the wording, but it cannot show that a stalled
// game ever actually *reaches* those counter values, or that a capture
// partway through really resets it: the counter there never comes from real
// plies.
//
// These tests close that gap by replaying whole games through `applyMove`
// and asserting on the warning the UI would render at each ply. Because 1.2
// has a single shared inactivity counter (rules.md §5.3, no per-player loss
// and no separate progress counter), a mutual stall always ends in the same
// **inactivity draw** at `INACTIVITY_LIMIT` (50 quiet plies, from either side
// or both combined) - there is only one ending to pin down here, plus the
// counter's reset the moment either side removes a piece.
//
// Fixtures in this file use only pieces whose id and rank are identical in
// both the 1.1 and 1.2 catalogs (champion, knight, militia, flag) - see this
// story's implementation-plan.md "Cross-step test constraint".

import { describe, expect, it } from "vitest";
import type { Column, Row, Square } from "../rules/primary/v1/board.ts";
import type {
  BoardState,
  InitialGameState,
  PlacedPiece,
} from "../rules/primary/v1/gameState.ts";
import { RULESET_TAG } from "../rules/primary/v1/gameState.ts";
import { INACTIVITY_LIMIT } from "../rules/primary/v1/outcome.ts";
import type { PieceTypeId } from "../rules/primary/v1/pieces.ts";
import {
  applyMove,
  startPlay,
  type PlayState,
} from "../rules/primary/v1/play.ts";
import { computeCountdownWarnings } from "./playWarnings.ts";

function initialGameState(
  pieces: readonly [string, PlacedPiece["side"], PieceTypeId][],
): InitialGameState {
  const board: Record<string, PlacedPiece> = {};
  for (const [key, side, pieceType] of pieces) {
    board[key] = { side, pieceType };
  }
  return { ruleset: RULESET_TAG, board: board as BoardState };
}

/** `"D5"` -> `{ column: "D", row: 5 }`. */
function square(key: string): Square {
  return { column: key[0] as Column, row: Number(key.slice(1)) as Row };
}

/** Plays `"D5D6"` (from-square, to-square) for the side to move. */
function play(state: PlayState, ply: string): PlayState {
  return applyMove(state, square(ply.slice(0, 2)), square(ply.slice(2, 4)))
    .state;
}

describe("countdown warning over a real game", () => {
  describe("both sides shuffling (the shared inactivity draw)", () => {
    /**
     * Two Flags plus one mobile piece per side, far apart and unable to
     * interfere with each other: white shuffles D5<->D6, black shuffles
     * D9<->D8, forever. Nothing is ever captured and nothing is ever attacked.
     */
    function stallingGame(): PlayState {
      return startPlay(
        initialGameState([
          ["A1", "white", "flag"],
          ["L12", "black", "flag"],
          ["D5", "white", "champion"],
          ["D9", "black", "militia"],
        ]),
      );
    }

    /** The shuffle each side repeats, indexed by how many plies that side has already made. */
    const shuffle = {
      white: ["D5D6", "D6D5"],
      black: ["D9D8", "D8D9"],
    } as const;

    /** Replays the mutual stall for `plies` plies and returns the resulting state. */
    function stallFor(plies: number): PlayState {
      let state = stallingGame();
      for (let ply = 0; ply < plies; ply++) {
        const side = state.sideToMove;
        const own = Math.floor(ply / 2);
        state = play(state, shuffle[side][own % 2]);
      }
      return state;
    }

    it("shows no warning early in the game", () => {
      const warnings = computeCountdownWarnings(stallFor(10));
      expect(warnings.inactivity).toBeNull();
    });

    it("first warns with 10 combined moves remaining, at ply 40", () => {
      expect(computeCountdownWarnings(stallFor(39)).inactivity).toBeNull();

      const warning = computeCountdownWarnings(stallFor(40)).inactivity;
      expect(warning?.movesRemaining).toBe(10);
      expect(warning?.message).toContain("10 moves remain");
      expect(warning?.message).toContain("draw");
    });

    it("counts the warning down by one with each further move", () => {
      expect(
        computeCountdownWarnings(stallFor(41)).inactivity?.movesRemaining,
      ).toBe(9);
      expect(
        computeCountdownWarnings(stallFor(45)).inactivity?.movesRemaining,
      ).toBe(5);
      expect(
        computeCountdownWarnings(stallFor(49)).inactivity?.movesRemaining,
      ).toBe(1);
    });

    it("ends in a shared inactivity draw once the limit is reached", () => {
      const state = stallFor(INACTIVITY_LIMIT);
      expect(state.inactivityCounter).toBe(INACTIVITY_LIMIT);
      expect(state.result).toEqual({ kind: "draw", reason: "inactivity" });
    });

    it("shows no warning at all once the game has ended", () => {
      const warnings = computeCountdownWarnings(stallFor(INACTIVITY_LIMIT));
      expect(warnings.inactivity).toBeNull();
    });
  });

  describe("a capture partway through resets the counter", () => {
    /**
     * White stalls (shuffling its Champion D5<->D6) while black's Knight has
     * a white Militia to capture at D7. Black otherwise shuffles a spare
     * Militia H9<->H8. The Knight (rank 3) cleanly beats the Militia
     * (rank 6, combat.ts) and then stays on D7, so nothing further is ever
     * attacked.
     */
    function capturingGame(): PlayState {
      return startPlay(
        initialGameState([
          ["A1", "white", "flag"],
          ["L12", "black", "flag"],
          ["D5", "white", "champion"],
          ["D7", "white", "militia"],
          ["D8", "black", "knight"],
          ["H9", "black", "militia"],
        ]),
      );
    }

    /** An even ply number, so it always lands on black's turn (see loop below). */
    const CAPTURE_PLY = 20;

    /**
     * Replays the stall for `plies` plies: white always shuffles D5<->D6;
     * black shuffles a spare Militia H9<->H8 except on `CAPTURE_PLY`, when
     * its Knight takes the Militia on D7 instead.
     */
    function stallWithCaptureFor(plies: number): PlayState {
      let state = capturingGame();
      let spare = "H9";
      for (let ply = 1; ply <= plies; ply++) {
        const own = Math.floor((ply - 1) / 2);
        if (state.sideToMove === "white") {
          state = play(state, own % 2 === 0 ? "D5D6" : "D6D5");
          continue;
        }
        if (ply === CAPTURE_PLY) {
          state = play(state, "D8D7");
          continue;
        }
        const to = spare === "H9" ? "H8" : "H9";
        state = play(state, spare + to);
        spare = to;
      }
      return state;
    }

    it("raises the counter through the quiet plies leading up to the capture", () => {
      const beforeCapture = stallWithCaptureFor(CAPTURE_PLY - 1);
      expect(beforeCapture.inactivityCounter).toBe(CAPTURE_PLY - 1);
    });

    it("resets the counter to 0 at the capture, clearing any warning", () => {
      const afterCapture = stallWithCaptureFor(CAPTURE_PLY);
      expect(afterCapture.inactivityCounter).toBe(0);
      expect(computeCountdownWarnings(afterCapture).inactivity).toBeNull();
    });

    it("counts back up from the reset toward a new warning", () => {
      // 40 further quiet plies after the capture puts the counter at 40 -
      // the warning threshold (10 remaining).
      const state = stallWithCaptureFor(CAPTURE_PLY + 40);
      expect(state.inactivityCounter).toBe(40);
      expect(
        computeCountdownWarnings(state).inactivity?.movesRemaining,
      ).toBe(10);
    });

    it("eventually ends in a shared inactivity draw, counted from the reset", () => {
      const state = stallWithCaptureFor(CAPTURE_PLY + INACTIVITY_LIMIT);
      expect(state.inactivityCounter).toBe(INACTIVITY_LIMIT);
      expect(state.result).toEqual({ kind: "draw", reason: "inactivity" });
    });
  });
});
