import { describe, expect, it } from "vitest";
import type { Square } from "./board.ts";
import { PRE_RELEASE_EDITION_ID } from "./edition.ts";
import { computeOutcome } from "./outcome.ts";
import {
  agreeDraw,
  applyMove,
  resign,
  startPlay,
  type PlayState,
} from "./play.ts";
import { encodePositionId } from "./positionId.ts";
import {
  EMPTY_POSITION,
  pieceAt,
  placePiece,
  type FlagPiece,
  type NumberedPiece,
  type PositionState,
} from "./position.ts";
import type { Rank } from "./pieces.ts";
import { generateStartPosition, type RandomSource } from "./startPosition.ts";

/**
 * A tiny deterministic PRNG (mulberry32, public domain), copied per test file
 * per this story's convention (Decision 7) so no dependency is added for it.
 */
function seededRandom(seed: number): RandomSource {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function whitePiece(rank: Rank): NumberedPiece {
  return { side: "white", kind: "numbered", rank };
}

function blackPiece(rank: Rank): NumberedPiece {
  return { side: "black", kind: "numbered", rank };
}

const whiteFlag: FlagPiece = { side: "white", kind: "flag" };
const blackFlag: FlagPiece = { side: "black", kind: "flag" };

/**
 * Builds an opening `PlayState` directly from a hand-built `board`, the same
 * way `startPlay` builds one from a *generated* board (`startPosition.ts`).
 * Used throughout this file wherever a test needs a small, precisely
 * controlled position rather than the real (randomly shuffled) output of
 * `generateStartPosition` - the same reason `movement.test.ts` and
 * `combat.test.ts` build ad hoc positions rather than generated ones: a
 * scripted sequence of combat outcomes needs squares and ranks chosen on
 * purpose, not drawn at random. `startPlay` itself is exercised directly,
 * against a real generated position, in the "starting a game" tests below.
 */
function startingStateFrom(board: PositionState): PlayState {
  const sideToMove = "white" as const;
  const inactivityCounter = 0;
  return {
    ruleset: PRE_RELEASE_EDITION_ID,
    startingBoard: board,
    startingPositionId: encodePositionId(board),
    board,
    sideToMove,
    moves: [],
    inactivityCounter,
    result: computeOutcome(board, sideToMove, inactivityCounter),
  };
}

const A1: Square = { column: "A", row: 1 };
const A2: Square = { column: "A", row: 2 };
const A3: Square = { column: "A", row: 3 };
const A4: Square = { column: "A", row: 4 };
const C3: Square = { column: "C", row: 3 };
const C6: Square = { column: "C", row: 6 };
const C7: Square = { column: "C", row: 7 };
const D3: Square = { column: "D", row: 3 };
const D4: Square = { column: "D", row: 4 };
const D5: Square = { column: "D", row: 5 };
const D6: Square = { column: "D", row: 6 };
const D7: Square = { column: "D", row: 7 };
const E5: Square = { column: "E", row: 5 };
const E6: Square = { column: "E", row: 6 };
const F2: Square = { column: "F", row: 2 };
const F3: Square = { column: "F", row: 3 };
const G2: Square = { column: "G", row: 2 };
const G3: Square = { column: "G", row: 3 };
const G5: Square = { column: "G", row: 5 };
const G6: Square = { column: "G", row: 6 };
const G7: Square = { column: "G", row: 7 };
const H7: Square = { column: "H", row: 7 };
const H8: Square = { column: "H", row: 8 };

describe("play (ruleset major 3): notation and the play state", () => {
  describe("starting a game", () => {
    it("starts from a generated position, White to move, no moves, counter 0, ongoing", () => {
      const generated = generateStartPosition(seededRandom(1));
      const state = startPlay(generated);

      expect(state.ruleset).toBe(PRE_RELEASE_EDITION_ID);
      expect(state.startingBoard).toEqual(generated.position);
      expect(state.startingPositionId).toBe(generated.positionId);
      expect(state.board).toEqual(generated.position);
      expect(state.sideToMove).toBe("white");
      expect(state.moves).toEqual([]);
      expect(state.inactivityCounter).toBe(0);
      expect(state.result).toEqual({ kind: "ongoing" });
    });
  });

  describe("a full scripted game: every notation form, ending in Flag capture", () => {
    function buildBoard(): PositionState {
      let board: PositionState = EMPTY_POSITION;
      board = placePiece(board, A1, whiteFlag);
      board = placePiece(board, A2, whitePiece(1)); // plain mover
      board = placePiece(board, C6, whitePiece(3)); // falls to Black's attacker win
      board = placePiece(board, E5, whitePiece(2)); // loses attacking Black's E6
      board = placePiece(board, G2, whitePiece(3)); // mutual loss with Black's G3
      board = placePiece(board, H7, whitePiece(1)); // captures Black's Flag
      board = placePiece(board, C7, blackPiece(5)); // wins against White's C6
      board = placePiece(board, E6, blackPiece(4)); // survives White's E5, demoted
      board = placePiece(board, G3, blackPiece(3)); // mutual loss with White's G2
      board = placePiece(board, H8, blackFlag);
      return board;
    }

    it("plays a plain move, an attacker win, an attacker loss, a mutual loss and a Flag capture in order", () => {
      let state = startingStateFrom(buildBoard());

      // Ply 1 (White): a plain move - no marks at all.
      let applied = applyMove(state, A2, A3);
      state = applied.state;
      expect(applied.outcome).toEqual({
        kind: "move",
        piece: whitePiece(1),
        square: A3,
      });
      expect(state.moves).toEqual(["A2-A3"]);
      expect(state.inactivityCounter).toBe(1);
      expect(state.sideToMove).toBe("black");
      expect(state.result).toEqual({ kind: "ongoing" });
      expect(pieceAt(state.board, A3)).toEqual(whitePiece(1));
      expect(pieceAt(state.board, A2)).toBeUndefined();

      // Ply 2 (Black): an attacker win - the attacker survives, demoted.
      applied = applyMove(state, C7, C6);
      state = applied.state;
      expect(applied.outcome.kind).toBe("attack");
      if (applied.outcome.kind !== "attack") throw new Error("unreachable");
      expect(applied.outcome.combat.kind).toBe("combat");
      if (applied.outcome.combat.kind !== "combat") {
        throw new Error("unreachable");
      }
      expect(applied.outcome.combat.outcome).toBe("attackerWins");
      expect(applied.outcome.combat.survivorRank).toBe(4);
      expect(state.moves).toEqual(["A2-A3", "C7=4-C6x"]);
      expect(state.inactivityCounter).toBe(0);
      expect(state.sideToMove).toBe("white");
      expect(pieceAt(state.board, C6)).toEqual(blackPiece(4));
      expect(pieceAt(state.board, C7)).toBeUndefined();
      expect(state.result).toEqual({ kind: "ongoing" });

      // Ply 3 (White): an attacker loss - the defender survives, demoted.
      applied = applyMove(state, E5, E6);
      state = applied.state;
      expect(applied.outcome.kind).toBe("attack");
      if (applied.outcome.kind !== "attack") throw new Error("unreachable");
      expect(applied.outcome.combat.kind).toBe("combat");
      if (applied.outcome.combat.kind !== "combat") {
        throw new Error("unreachable");
      }
      expect(applied.outcome.combat.outcome).toBe("attackerLoses");
      expect(applied.outcome.combat.survivorRank).toBe(3);
      expect(state.moves).toEqual(["A2-A3", "C7=4-C6x", "E5x-E6=3"]);
      expect(state.inactivityCounter).toBe(0);
      expect(state.sideToMove).toBe("black");
      expect(pieceAt(state.board, E6)).toEqual(blackPiece(3));
      expect(pieceAt(state.board, E5)).toBeUndefined();
      expect(state.result).toEqual({ kind: "ongoing" });

      // Ply 4 (Black): a mutual loss - both removed, neither reduced.
      applied = applyMove(state, G3, G2);
      state = applied.state;
      expect(applied.outcome.kind).toBe("attack");
      if (applied.outcome.kind !== "attack") throw new Error("unreachable");
      expect(applied.outcome.combat.kind).toBe("combat");
      if (applied.outcome.combat.kind !== "combat") {
        throw new Error("unreachable");
      }
      expect(applied.outcome.combat.outcome).toBe("draw");
      expect(applied.outcome.combat.survivorRank).toBeNull();
      expect(state.moves).toEqual(["A2-A3", "C7=4-C6x", "E5x-E6=3", "G3x-G2x"]);
      expect(state.inactivityCounter).toBe(0);
      expect(state.sideToMove).toBe("white");
      expect(pieceAt(state.board, G2)).toBeUndefined();
      expect(pieceAt(state.board, G3)).toBeUndefined();
      expect(state.result).toEqual({ kind: "ongoing" });

      // Ply 5 (White): a Flag capture - the capturing piece is not reduced,
      // and the game ends immediately.
      applied = applyMove(state, H7, H8);
      state = applied.state;
      expect(applied.outcome.kind).toBe("attack");
      if (applied.outcome.kind !== "attack") throw new Error("unreachable");
      expect(applied.outcome.combat.kind).toBe("flagCapture");
      expect(state.moves).toEqual([
        "A2-A3",
        "C7=4-C6x",
        "E5x-E6=3",
        "G3x-G2x",
        "H7-H8x",
      ]);
      expect(state.inactivityCounter).toBe(0);
      expect(pieceAt(state.board, H8)).toEqual(whitePiece(1));
      expect(pieceAt(state.board, H7)).toBeUndefined();
      expect(state.result).toEqual({
        kind: "win",
        winner: "white",
        reason: "flagCapture",
      });

      // The game is over: no further move may be applied.
      expect(() => applyMove(state, A3, A4)).toThrow();
    });
  });

  describe("the inactivity counter", () => {
    it("rises on a quiet move and resets to 0 the moment an attack removes a piece", () => {
      let board: PositionState = EMPTY_POSITION;
      board = placePiece(board, A1, whiteFlag);
      board = placePiece(board, D4, whitePiece(1)); // quiet shuffler
      board = placePiece(board, F2, whitePiece(5)); // attacker
      board = placePiece(board, H8, blackFlag);
      board = placePiece(board, G6, blackPiece(1)); // quiet shuffler
      board = placePiece(board, F3, blackPiece(1)); // defender

      let state = startingStateFrom(board);

      state = applyMove(state, D4, D3).state; // White, quiet
      expect(state.inactivityCounter).toBe(1);

      state = applyMove(state, G6, G5).state; // Black, quiet
      expect(state.inactivityCounter).toBe(2);

      state = applyMove(state, F2, F3).state; // White, attacks and wins
      expect(state.inactivityCounter).toBe(0);
    });

    it("a game driven to 40 quiet moves ends as a draw by inactivity, not before", () => {
      let board: PositionState = EMPTY_POSITION;
      board = placePiece(board, A1, whiteFlag);
      board = placePiece(board, D4, whitePiece(1));
      board = placePiece(board, H8, blackFlag);
      board = placePiece(board, E5, blackPiece(1));

      let state = startingStateFrom(board);
      let whiteCurrent = D4;
      let blackCurrent = E5;

      function shuttle(current: Square, a: Square, b: Square): Square {
        return current.column === a.column && current.row === a.row ? b : a;
      }

      function playOneQuietPly(): void {
        if (state.sideToMove === "white") {
          const next = shuttle(whiteCurrent, D4, D3);
          state = applyMove(state, whiteCurrent, next).state;
          whiteCurrent = next;
        } else {
          const next = shuttle(blackCurrent, E5, E6);
          state = applyMove(state, blackCurrent, next).state;
          blackCurrent = next;
        }
      }

      for (let ply = 0; ply < 39; ply += 1) {
        playOneQuietPly();
      }
      expect(state.inactivityCounter).toBe(39);
      expect(state.result).toEqual({ kind: "ongoing" });

      playOneQuietPly();
      expect(state.inactivityCounter).toBe(40);
      expect(state.result).toEqual({ kind: "draw", reason: "inactivity" });
    });
  });

  describe("rejecting an illegal ply", () => {
    function freshState(): PlayState {
      let board: PositionState = EMPTY_POSITION;
      board = placePiece(board, A1, whiteFlag);
      board = placePiece(board, D4, whitePiece(1));
      board = placePiece(board, H8, blackFlag);
      board = placePiece(board, E5, blackPiece(1));
      return startingStateFrom(board);
    }

    it("throws when applying a move to an already-finished game", () => {
      const state = resign(freshState(), "white");
      expect(() => applyMove(state, E5, E6)).toThrow();
    });

    it("throws when the piece on the origin square does not belong to the side to move", () => {
      const state = freshState();
      // White is to move; E5 holds a Black piece.
      expect(() => applyMove(state, E5, E6)).toThrow();
    });

    it("throws when the target is neither a legal destination nor a legal attack", () => {
      const state = freshState();
      // A diagonal step onto an *empty* square is never legal (rules.md
      // §4.2/§4.4 - the diagonal is an attacking direction and nothing
      // else). C3 is empty in this board.
      expect(() => applyMove(state, D4, C3)).toThrow();
    });
  });

  describe("White's first move of the game is limited to one square", () => {
    it("refuses a two-square move for the very first ply, and allows it on White's second move", () => {
      let board: PositionState = EMPTY_POSITION;
      board = placePiece(board, A1, whiteFlag);
      board = placePiece(board, D4, whitePiece(3));
      board = placePiece(board, H8, blackFlag);
      board = placePiece(board, G7, blackPiece(3));

      const state = startingStateFrom(board);

      // The two-square move is otherwise legal (unencumbered, empty path) -
      // but this is the game's first ply, so it is refused.
      expect(() => applyMove(state, D4, D6)).toThrow();

      // The one-square move is unaffected.
      let next = applyMove(state, D4, D5).state;
      expect(next.moves).toEqual(["D4-D5"]);

      // Black's move, elsewhere, does not encumber D5's northward path.
      next = applyMove(next, G7, G6).state;

      // White's second move: the two-square move is legal now.
      next = applyMove(next, D5, D7).state;
      expect(next.moves).toEqual(["D4-D5", "G7-G6", "D5-D7"]);
      expect(pieceAt(next.board, D7)).toEqual(whitePiece(3));
      expect(pieceAt(next.board, D5)).toBeUndefined();
    });
  });

  describe("resignation (rules.md §5.5)", () => {
    function freshState(): PlayState {
      let board: PositionState = EMPTY_POSITION;
      board = placePiece(board, A1, whiteFlag);
      board = placePiece(board, D4, whitePiece(1));
      board = placePiece(board, H8, blackFlag);
      board = placePiece(board, E5, blackPiece(1));
      return startingStateFrom(board);
    }

    it("a White resignation is an immediate win for Black, appending no move", () => {
      const state = freshState();
      const resigned = resign(state, "white");
      expect(resigned.result).toEqual({
        kind: "win",
        winner: "black",
        reason: "resignation",
      });
      expect(resigned.moves).toEqual([]);
      expect(resigned.board).toEqual(state.board);
      expect(resigned.inactivityCounter).toBe(state.inactivityCounter);
    });

    it("a Black resignation is an immediate win for White", () => {
      const state = freshState();
      const resigned = resign(state, "black");
      expect(resigned.result).toEqual({
        kind: "win",
        winner: "white",
        reason: "resignation",
      });
      expect(resigned.moves).toEqual([]);
    });

    it("is available at any point in the game, including at move one", () => {
      const opening = freshState();
      expect(opening.moves).toEqual([]);
      const resigned = resign(opening, "white");
      expect(resigned.result.kind).toBe("win");

      const afterOneMove = applyMove(opening, D4, D3).state;
      const resignedLater = resign(afterOneMove, "black");
      expect(resignedLater.result).toEqual({
        kind: "win",
        winner: "white",
        reason: "resignation",
      });
      // No move is appended for the resignation itself.
      expect(resignedLater.moves).toEqual(afterOneMove.moves);
    });

    it("throws when resigning an already-finished game", () => {
      const state = resign(freshState(), "white");
      expect(() => resign(state, "black")).toThrow();
    });
  });

  describe("draw by agreement (rules.md §5.6)", () => {
    function freshState(): PlayState {
      let board: PositionState = EMPTY_POSITION;
      board = placePiece(board, A1, whiteFlag);
      board = placePiece(board, D4, whitePiece(1));
      board = placePiece(board, H8, blackFlag);
      board = placePiece(board, E5, blackPiece(1));
      return startingStateFrom(board);
    }

    it("ends the game as a draw, appending no move and leaving the board untouched", () => {
      const state = freshState();
      const agreed = agreeDraw(state);
      expect(agreed.result).toEqual({ kind: "draw", reason: "agreement" });
      expect(agreed.moves).toEqual([]);
      expect(agreed.board).toEqual(state.board);
      expect(agreed.sideToMove).toBe(state.sideToMove);
      expect(agreed.inactivityCounter).toBe(state.inactivityCounter);
    });

    it("throws when agreeing a draw on an already-finished game", () => {
      const state = agreeDraw(freshState());
      expect(() => agreeDraw(state)).toThrow();
    });
  });
});
