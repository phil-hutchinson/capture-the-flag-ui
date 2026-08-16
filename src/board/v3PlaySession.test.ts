import { describe, expect, it } from "vitest";
import { computeOutcome } from "../rules/primary/v3/outcome.ts";
import { PRE_RELEASE_EDITION_ID } from "../rules/primary/v3/edition.ts";
import { encodePositionId } from "../rules/primary/v3/positionId.ts";
import type { PlayState } from "../rules/primary/v3/play.ts";
import {
  EMPTY_POSITION,
  pieceAt,
  placePiece,
  type FlagPiece,
  type NumberedPiece,
  type PositionState,
} from "../rules/primary/v3/position.ts";
import type { Rank } from "../rules/primary/v3/pieces.ts";
import type { Square } from "../rules/primary/v3/board.ts";
import {
  acceptDraw,
  activatableSquares,
  activateSquare,
  actionableSquares,
  attackTargets,
  declineDraw,
  offerDraw,
  resign,
  startSession,
  viewSide,
  type PlaySession,
} from "./v3PlaySession.ts";
import {
  generateStartPosition,
  type RandomSource,
} from "../rules/primary/v3/startPosition.ts";

/** A tiny deterministic PRNG (mulberry32), copied per test file per this story's convention. */
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

/** Builds an opening `PlayState` directly from a hand-built `board`, mirroring `play.test.ts`'s helper. */
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

function sessionFrom(board: PositionState): PlaySession {
  return {
    play: startingStateFrom(board),
    selection: null,
    lastOutcome: null,
    drawOffer: null,
  };
}

const A1: Square = { column: "A", row: 1 };
const D4: Square = { column: "D", row: 4 };
const D5: Square = { column: "D", row: 5 };
const E5: Square = { column: "E", row: 5 };
const F2: Square = { column: "F", row: 2 };
const H8: Square = { column: "H", row: 8 };
const G6: Square = { column: "G", row: 6 };

/** Two Flags, White's D4 mobile piece, Black's E5 mobile piece, all far apart and unrestricted. */
function basicBoard(): PositionState {
  let board: PositionState = EMPTY_POSITION;
  board = placePiece(board, A1, whiteFlag);
  board = placePiece(board, D4, whitePiece(3));
  board = placePiece(board, F2, whitePiece(2));
  board = placePiece(board, H8, blackFlag);
  board = placePiece(board, E5, blackPiece(3));
  board = placePiece(board, G6, blackPiece(2));
  return board;
}

/**
 * D4 (white, rank 3) with a Black piece one square north at D5. A one-square
 * attack, on purpose - White's *first* move of the game is limited to one
 * square (rules.md §4.1), and every `sessionFrom` fixture in this file
 * starts a fresh game (`moves: []`), so a two-square attack would not be
 * legal here even when otherwise unencumbered.
 */
function boardWithAttackAtD5(): PositionState {
  let board: PositionState = EMPTY_POSITION;
  board = placePiece(board, A1, whiteFlag);
  board = placePiece(board, D4, whitePiece(3));
  board = placePiece(board, H8, blackFlag);
  board = placePiece(board, D5, blackPiece(1));
  return board;
}

describe("v3PlaySession", () => {
  describe("startSession", () => {
    it("starts from a generated position with nothing selected, no outcome, no pending offer", () => {
      const session = startSession(generateStartPosition(seededRandom(1)));
      expect(session.play.sideToMove).toBe("white");
      expect(session.selection).toBeNull();
      expect(session.lastOutcome).toBeNull();
      expect(session.drawOffer).toBeNull();
    });
  });

  describe("activateSquare: selection", () => {
    it("selects one of the side-to-move's own movable pieces", () => {
      const session = sessionFrom(basicBoard());
      const next = activateSquare(session, D4);
      expect(next.selection).toEqual(D4);
      expect(next.play).toBe(session.play);
    });

    it("deselects the piece by re-activating its own square", () => {
      const session = activateSquare(sessionFrom(basicBoard()), D4);
      const next = activateSquare(session, D4);
      expect(next.selection).toBeNull();
    });

    it("switches the selection to a different own movable piece", () => {
      const session = activateSquare(sessionFrom(basicBoard()), D4);
      const next = activateSquare(session, F2);
      expect(next.selection).toEqual(F2);
    });

    it("is a no-op for an enemy piece", () => {
      const session = sessionFrom(basicBoard());
      const next = activateSquare(session, E5);
      expect(next).toEqual(session);
    });

    it("is a no-op for the Flag", () => {
      const session = sessionFrom(basicBoard());
      const next = activateSquare(session, A1);
      expect(next).toEqual(session);
    });

    it("is a no-op for an empty non-destination square", () => {
      const session = sessionFrom(basicBoard());
      const empty: Square = { column: "A", row: 8 };
      const next = activateSquare(session, empty);
      expect(next).toEqual(session);
    });
  });

  describe("activateSquare: applying a move", () => {
    it("applies a plain move, clears the selection and records the outcome", () => {
      const session = activateSquare(sessionFrom(basicBoard()), D4);
      const next = activateSquare(session, D5);
      expect(next.selection).toBeNull();
      expect(next.lastOutcome).toEqual({
        kind: "move",
        piece: whitePiece(3),
        square: D5,
      });
      expect(pieceAt(next.play.board, D5)).toEqual(whitePiece(3));
      expect(pieceAt(next.play.board, D4)).toBeUndefined();
      expect(next.play.sideToMove).toBe("black");
    });

    it("applies an attack and records the resolved combat", () => {
      // D4 (white, rank 3) attacks D5 one square north.
      const session = activateSquare(sessionFrom(boardWithAttackAtD5()), D4);
      const next = activateSquare(session, D5);
      expect(next.lastOutcome?.kind).toBe("attack");
      expect(pieceAt(next.play.board, D5)).toEqual(whitePiece(2));
    });
  });

  describe("actionableSquares / attackTargets / activatableSquares", () => {
    it("with nothing selected, offers exactly the side-to-move's own movable pieces", () => {
      const session = sessionFrom(basicBoard());
      const keys = actionableSquares(session)
        .map((s) => `${s.column}${s.row}`)
        .sort();
      expect(keys).toEqual(["D4", "F2"]);
    });

    it("with a piece selected, offers its legal destinations and attacks; attackTargets is a subset", () => {
      const session = activateSquare(sessionFrom(boardWithAttackAtD5()), D4);
      const actionable = actionableSquares(session);
      const attacks = attackTargets(session);
      expect(attacks).toEqual([D5]);
      for (const attack of attacks) {
        expect(
          actionable.some(
            (s) => s.column === attack.column && s.row === attack.row,
          ),
        ).toBe(true);
      }
    });

    it("activatableSquares is a strict superset of actionableSquares while a piece is selected", () => {
      const session = activateSquare(sessionFrom(basicBoard()), D4);
      const actionable = actionableSquares(session);
      const activatable = activatableSquares(session);
      for (const square of actionable) {
        expect(
          activatable.some(
            (s) => s.column === square.column && s.row === square.row,
          ),
        ).toBe(true);
      }
      // Strictly larger: D4 itself (deselect) and F2 (switch) are
      // activatable but not actionable destinations/attacks.
      expect(activatable.length).toBeGreaterThan(actionable.length);
      expect(activatable.some((s) => s.column === "D" && s.row === 4)).toBe(
        true,
      );
      expect(actionable.some((s) => s.column === "D" && s.row === 4)).toBe(
        false,
      );
    });

    it("every set is empty once the game has ended", () => {
      const session = resign(sessionFrom(basicBoard()));
      expect(session.play.result.kind).toBe("win");
      expect(actionableSquares(session)).toEqual([]);
      expect(attackTargets(session)).toEqual([]);
      expect(activatableSquares(session)).toEqual([]);
    });

    it("every set is empty while a draw offer is pending", () => {
      const session = offerDraw(sessionFrom(basicBoard()));
      expect(session.drawOffer).toBe("white");
      expect(actionableSquares(session)).toEqual([]);
      expect(attackTargets(session)).toEqual([]);
      expect(activatableSquares(session)).toEqual([]);
      expect(activateSquare(session, D4)).toEqual(session);
    });
  });

  describe("viewSide", () => {
    it("follows the side to move when flipping is on", () => {
      const session = sessionFrom(basicBoard());
      expect(viewSide(session, true)).toBe("white");
      const afterMove = activateSquare(activateSquare(session, D4), D5);
      expect(viewSide(afterMove, true)).toBe("black");
    });

    it("flips to the responder while a draw offer is pending", () => {
      const session = offerDraw(sessionFrom(basicBoard()));
      expect(session.play.sideToMove).toBe("white");
      expect(viewSide(session, true)).toBe("black");
    });

    it("stays red (white) when flipping is off, regardless of turn or a pending offer", () => {
      const session = sessionFrom(basicBoard());
      const afterMove = activateSquare(activateSquare(session, D4), D5);
      expect(viewSide(afterMove, false)).toBe("white");
      const offered = offerDraw(afterMove);
      expect(viewSide(offered, false)).toBe("white");
    });
  });

  describe("draw offer transitions", () => {
    it("offering clears the selection and records the offering side without changing sideToMove", () => {
      const session = activateSquare(sessionFrom(basicBoard()), D4);
      const offered = offerDraw(session);
      expect(offered.selection).toBeNull();
      expect(offered.drawOffer).toBe("white");
      expect(offered.play.sideToMove).toBe("white");
    });

    it("accepting ends the game as a draw by agreement and clears the offer", () => {
      const offered = offerDraw(sessionFrom(basicBoard()));
      const accepted = acceptDraw(offered);
      expect(accepted.drawOffer).toBeNull();
      expect(accepted.play.result).toEqual({
        kind: "draw",
        reason: "agreement",
      });
    });

    it("declining clears the offer and leaves sideToMove unchanged", () => {
      const offered = offerDraw(sessionFrom(basicBoard()));
      const declined = declineDraw(offered);
      expect(declined.drawOffer).toBeNull();
      expect(declined.play.result.kind).toBe("ongoing");
      expect(declined.play.sideToMove).toBe("white");
    });
  });

  describe("resign", () => {
    it("ends the game as a win for the opponent of the side to move, leaving the board inert", () => {
      const session = sessionFrom(basicBoard());
      const resigned = resign(session);
      expect(resigned.play.result).toEqual({
        kind: "win",
        winner: "black",
        reason: "resignation",
      });
      expect(resigned.selection).toBeNull();
      expect(actionableSquares(resigned)).toEqual([]);
      expect(activatableSquares(resigned)).toEqual([]);
    });

    it("is a no-op once the game has already ended", () => {
      const resigned = resign(sessionFrom(basicBoard()));
      const again = resign(resigned);
      expect(again).toEqual(resigned);
    });

    it("is a no-op while a draw offer is pending (the offer must be answered first)", () => {
      const offered = offerDraw(sessionFrom(basicBoard()));
      const attempted = resign(offered);
      expect(attempted).toEqual(offered);
      expect(attempted.play.result.kind).toBe("ongoing");
    });
  });
});
