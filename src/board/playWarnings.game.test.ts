// Countdown warnings driven through a *real* game (story 00000006, Step 11).
//
// `playWarnings.test.ts` unit-tests `computeCountdownWarnings` against
// hand-built counter fixtures - it sets `inactivityCounters` and
// `progressCounter` directly. That proves the thresholds and the wording, but
// it cannot show that a player stalling at the board ever actually *reaches*
// those counter values: the counters there never come from real plies.
//
// These tests close that gap by replaying whole games through `applyMove` and
// asserting on the warnings the UI would render at each ply. They pin down the
// two endings a stall can produce, which are easy to conflate:
//
//  - **Both sides shuffling** ends in the shared **no-progress draw** at
//    `PROGRESS_LIMIT` (80 combined plies). The inactivity loss is *unreachable*
//    this way - each side's own counter only reaches 40 by the time the draw
//    fires - so only the no-progress warning is ever seen.
//  - The **inactivity loss** at `INACTIVITY_LIMIT` (50 of one side's own plies)
//    needs the opponent to keep *capturing*, since a capture resets the shared
//    progress counter and so keeps the no-progress draw from ending the game
//    first. The capture must be a clean win (`attackerWins`): a *sacrificial*
//    attack would also reset the stalling side's counter (play.ts) and undo the
//    stall.

import { describe, expect, it } from "vitest";
import type { Column, Row, Square } from "../rules/primary/v1_1/board.ts";
import type {
  BoardState,
  InitialGameState,
  PlacedPiece,
} from "../rules/primary/v1_1/gameState.ts";
import { RULESET_TAG } from "../rules/primary/v1_1/gameState.ts";
import {
  INACTIVITY_LIMIT,
  PROGRESS_LIMIT,
} from "../rules/primary/v1_1/outcome.ts";
import type { PieceTypeId } from "../rules/primary/v1_1/pieces.ts";
import {
  applyMove,
  startPlay,
  type PlayState,
} from "../rules/primary/v1_1/play.ts";
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

describe("countdown warnings over a real game", () => {
  describe("both sides shuffling (the no-progress draw)", () => {
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
          ["D5", "white", "infantry"],
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
      expect(warnings.noProgress).toBeNull();
      expect(warnings.inactivity).toBeNull();
    });

    it("first warns with 20 combined moves remaining, at ply 60", () => {
      expect(computeCountdownWarnings(stallFor(59)).noProgress).toBeNull();

      const warning = computeCountdownWarnings(stallFor(60)).noProgress;
      expect(warning?.movesRemaining).toBe(20);
      expect(warning?.message).toContain("20 moves remain");
      expect(warning?.message).toContain("draw");
    });

    it("counts the warning down by one with each further move", () => {
      expect(
        computeCountdownWarnings(stallFor(61)).noProgress?.movesRemaining,
      ).toBe(19);
      expect(
        computeCountdownWarnings(stallFor(70)).noProgress?.movesRemaining,
      ).toBe(10);
      expect(
        computeCountdownWarnings(stallFor(79)).noProgress?.movesRemaining,
      ).toBe(1);
    });

    it("ends in a no-progress draw once the shared limit is reached", () => {
      const state = stallFor(PROGRESS_LIMIT);
      expect(state.progressCounter).toBe(PROGRESS_LIMIT);
      expect(state.result).toEqual({ kind: "draw", reason: "noProgress" });
    });

    it("shows no warnings at all once the game has ended", () => {
      const warnings = computeCountdownWarnings(stallFor(PROGRESS_LIMIT));
      expect(warnings.noProgress).toBeNull();
      expect(warnings.inactivity).toBeNull();
    });

    it("never raises an inactivity warning: the shared draw always fires first", () => {
      // The point of this test: a mutual shuffle cannot reach the inactivity
      // loss. At the draw, each side's own counter has only reached 40 - ten
      // short of INACTIVITY_LIMIT - and the warning is only ever shown to the
      // side to move, whose counter is lower still.
      for (let ply = 0; ply <= PROGRESS_LIMIT; ply++) {
        expect(computeCountdownWarnings(stallFor(ply)).inactivity).toBeNull();
      }
      const state = stallFor(PROGRESS_LIMIT);
      expect(state.inactivityCounters).toEqual({ white: 40, black: 40 });
    });
  });

  describe("one side shuffling while the other captures (the inactivity loss)", () => {
    /**
     * White stalls (shuffling its Infantry D5<->D6) while black's Lord Marshal
     * has a white Militia to capture at D7. The capture is what makes the
     * inactivity loss reachable at all: it resets the shared progress counter,
     * so the no-progress draw never fires, while a clean win (Lord Marshal,
     * rank 1, over Militia, rank 6 - combat.ts) leaves white's own inactivity
     * counter untouched, so white's stall keeps counting up to the loss.
     */
    function capturingGame(): PlayState {
      return startPlay(
        initialGameState([
          ["A1", "white", "flag"],
          ["L12", "black", "flag"],
          ["D5", "white", "infantry"],
          ["D7", "white", "militia"],
          ["D8", "black", "lordMarshal"],
          ["H9", "black", "skirmisher"],
        ]),
      );
    }

    /**
     * Replays the stall for `plies` plies: white always shuffles D5<->D6, while
     * black shuffles a spare Skirmisher H9<->H8 and, on ply 40, has its Lord
     * Marshal take the Militia on D7. The Lord Marshal then *stays* on D7 (black
     * goes back to shuffling the Skirmisher), so it remains a standing attack
     * target for white's Infantry on D6 - which is what lets a later test have
     * the stalling player break their own stall with an attack.
     *
     * One capture is enough to keep the draw away: it resets the progress
     * counter to 0 at ply 40, and white's 50th stalling ply lands at ply 99, by
     * which point the counter has only climbed back to 59 - under
     * PROGRESS_LIMIT, so the no-progress draw never pre-empts the inactivity
     * loss.
     */
    const CAPTURE_PLY = 40;

    function stallAgainstCapturesFor(plies: number): PlayState {
      let state = capturingGame();
      let skirmisher = "H9";
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
        const to = skirmisher === "H9" ? "H8" : "H9";
        state = play(state, skirmisher + to);
        skirmisher = to;
      }
      return state;
    }

    it("captures instead of drawing: the progress counter resets, so no no-progress warning ever appears", () => {
      const state = stallAgainstCapturesFor(99);
      expect(state.progressCounter).toBeLessThan(PROGRESS_LIMIT);
      expect(computeCountdownWarnings(state).noProgress).toBeNull();
    });

    it("warns the stalling player, on their turn, at 10 of their own moves remaining", () => {
      // White's 40th stalling ply is ply 79; black replies on ply 80, and it is
      // white to move with their counter at 40 - ten of their own moves left.
      const state = stallAgainstCapturesFor(80);
      expect(state.sideToMove).toBe("white");
      expect(state.inactivityCounters.white).toBe(40);

      const warning = computeCountdownWarnings(state).inactivity;
      expect(warning?.side).toBe("white");
      expect(warning?.movesRemaining).toBe(10);
      expect(warning?.message).toContain("Red");
      expect(warning?.message).toContain("10 moves remain");
      expect(warning?.message).toContain("an attack resets this count");
    });

    it("does not warn one move earlier (11 of their own moves remaining)", () => {
      const state = stallAgainstCapturesFor(78);
      expect(state.sideToMove).toBe("white");
      expect(state.inactivityCounters.white).toBe(39);
      expect(computeCountdownWarnings(state).inactivity).toBeNull();
    });

    it("counts down by one with each further stalling move", () => {
      expect(
        computeCountdownWarnings(stallAgainstCapturesFor(82)).inactivity
          ?.movesRemaining,
      ).toBe(9);
      expect(
        computeCountdownWarnings(stallAgainstCapturesFor(90)).inactivity
          ?.movesRemaining,
      ).toBe(5);
      expect(
        computeCountdownWarnings(stallAgainstCapturesFor(96)).inactivity
          ?.movesRemaining,
      ).toBe(2);
    });

    it("shows the warning only on the stalling player's own turn", () => {
      // Mid-warning, but with black to move: the counter is unchanged, yet no
      // warning is shown - it is addressed to the player who can act on it.
      const state = stallAgainstCapturesFor(81);
      expect(state.sideToMove).toBe("black");
      expect(state.inactivityCounters.white).toBe(41);
      expect(computeCountdownWarnings(state).inactivity).toBeNull();
    });

    it("clears the warning when the stalling player finally attacks", () => {
      // White, deep in the warning, attacks instead of shuffling: white's
      // Infantry on D6 takes black's Lord Marshal on D7. The attack resets
      // white's own inactivity counter, so the warning disappears at once.
      const warned = stallAgainstCapturesFor(90);
      expect(computeCountdownWarnings(warned).inactivity).not.toBeNull();
      expect(warned.sideToMove).toBe("white");

      const attacked = play(warned, "D6D7");
      expect(attacked.inactivityCounters.white).toBe(0);
      expect(computeCountdownWarnings(attacked).inactivity).toBeNull();
    });

    it("loses the game for the stalling player on their 50th move, naming the other player the winner", () => {
      const state = stallAgainstCapturesFor(99);
      expect(state.inactivityCounters.white).toBe(INACTIVITY_LIMIT);
      expect(state.result).toEqual({
        kind: "win",
        winner: "black",
        reason: "inactivity",
      });
      expect(computeCountdownWarnings(state).inactivity).toBeNull();
    });
  });
});
