import { describe, expect, it } from "vitest";
import type { Square } from "../rules/primary/v1_1/board.ts";
import { RULESET_TAG } from "../rules/primary/v1_1/gameState.ts";
import type {
  BoardState,
  InitialGameState,
  PlacedPiece,
} from "../rules/primary/v1_1/gameState.ts";
import type { PieceTypeId } from "../rules/primary/v1_1/pieces.ts";
import {
  actionableSquares,
  activateSquare,
  startSession,
  type PlaySession,
} from "./playSession.ts";

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

function initialGameState(
  pieces: readonly [string, PlacedPiece["side"], PieceTypeId][],
): InitialGameState {
  return { ruleset: RULESET_TAG, board: board(pieces) };
}

/** Sorts squares for order-independent comparison. */
function sortedKeys(squares: readonly Square[]): string[] {
  return squares.map((s) => `${s.column}${s.row}`).sort();
}

const sq = (column: Square["column"], row: Square["row"]): Square => ({
  column,
  row,
});

describe("startSession", () => {
  it("starts with White to move and nothing selected", () => {
    const session = startSession(
      initialGameState([["D5", "white", "infantry"]]),
    );
    expect(session.play.sideToMove).toBe("white");
    expect(session.selection).toBeNull();
  });
});

describe("actionableSquares - nothing selected", () => {
  it("offers exactly the side-to-move's own movable pieces", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["E5", "white", "tower"], // own, but immobile - excluded
        ["D9", "black", "militia"], // opponent - excluded
      ]),
    );
    expect(sortedKeys(actionableSquares(session))).toEqual(["D5"]);
  });

  it("yields an empty actionable set (without throwing) when the side to move is stuck", () => {
    // White's only piece is boxed in on every side by enemy pieces, so it
    // has zero legal destinations; White has no other piece on the board.
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["C5", "black", "militia"],
        ["E5", "black", "militia"],
        ["D4", "black", "militia"],
        ["D6", "black", "militia"],
      ]),
    );
    expect(() => actionableSquares(session)).not.toThrow();
    expect(actionableSquares(session)).toEqual([]);
  });
});

describe("activateSquare - selecting a piece", () => {
  it("selecting an own movable piece exposes exactly its legal destinations", () => {
    const session = startSession(
      initialGameState([["D5", "white", "infantry"]]),
    );
    const next = activateSquare(session, sq("D", 5));
    expect(next.selection).toEqual(sq("D", 5));
    expect(sortedKeys(actionableSquares(next))).toEqual(
      ["C5", "D4", "D6", "E5"].sort(),
    );
  });

  it("selecting an opponent's piece exposes nothing and does not select", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D9", "black", "militia"],
      ]),
    );
    const next = activateSquare(session, sq("D", 9));
    expect(next.selection).toBeNull();
    expect(next).toEqual(session);
    expect(actionableSquares(next)).toEqual([sq("D", 5)]);
  });

  it("selecting an immobile own piece (Tower) exposes nothing and does not select", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["E5", "white", "tower"],
      ]),
    );
    const next = activateSquare(session, sq("E", 5));
    expect(next.selection).toBeNull();
    expect(next).toEqual(session);
  });

  it("activating the same selected piece again deselects it", () => {
    const session = startSession(
      initialGameState([["D5", "white", "infantry"]]),
    );
    const selected = activateSquare(session, sq("D", 5));
    expect(selected.selection).toEqual(sq("D", 5));

    const deselected = activateSquare(selected, sq("D", 5));
    expect(deselected.selection).toBeNull();
    expect(deselected.play).toBe(selected.play);
  });
});

describe("activateSquare - moving", () => {
  it("activating a legal destination applies the move, flips the side, and clears the selection", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D9", "black", "militia"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const moved = activateSquare(selected, sq("D", 4));

    expect(moved.selection).toBeNull();
    expect(moved.play.sideToMove).toBe("black");
    expect(moved.play.board["D5"]).toBeUndefined();
    expect(moved.play.board["D4"]).toEqual({
      side: "white",
      pieceType: "infantry",
    });
    expect(moved.play.moves).toEqual(["D5D4"]);
  });

  it("activating a non-destination while a piece is selected is a no-op", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D9", "black", "militia"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    // D3 is two squares away - not a legal destination for a baseline piece.
    const next = activateSquare(selected, sq("D", 3));

    expect(next).toEqual(selected);
    expect(next.selection).toEqual(sq("D", 5));
  });

  it("activating an empty square with nothing selected is a no-op", () => {
    const session = startSession(
      initialGameState([["D5", "white", "infantry"]]),
    );
    const next = activateSquare(session, sq("H", 8));
    expect(next).toEqual(session);
  });
});

describe("activateSquare - switching selection", () => {
  it("activating a different own movable piece switches the selection to it", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["H5", "white", "infantry"],
      ]),
    );
    const selectedD5 = activateSquare(session, sq("D", 5));
    expect(selectedD5.selection).toEqual(sq("D", 5));

    const switchedToH5 = activateSquare(selectedD5, sq("H", 5));
    expect(switchedToH5.selection).toEqual(sq("H", 5));
    expect(switchedToH5.play).toBe(selectedD5.play);
    // Actionable squares now reflect H5's destinations, not D5's.
    expect(sortedKeys(actionableSquares(switchedToH5))).toEqual(
      ["G5", "H4", "H6", "I5"].sort(),
    );
  });

  it("activating an immobile own piece (Tower) while a piece is selected is still a no-op", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["H5", "white", "tower"],
      ]),
    );
    const selectedD5 = activateSquare(session, sq("D", 5));
    const next = activateSquare(selectedD5, sq("H", 5));

    expect(next).toEqual(selectedD5);
    expect(next.selection).toEqual(sq("D", 5));
  });
});

describe("activateSquare - turn alternation across a sequence", () => {
  it("strictly alternates sides across several moves", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
    ]);
    let session: PlaySession = startSession(initial);
    expect(session.play.sideToMove).toBe("white");

    session = activateSquare(session, sq("D", 5));
    session = activateSquare(session, sq("D", 4));
    expect(session.play.sideToMove).toBe("black");
    expect(session.selection).toBeNull();

    session = activateSquare(session, sq("D", 9));
    session = activateSquare(session, sq("D", 10));
    expect(session.play.sideToMove).toBe("white");
    expect(session.selection).toBeNull();

    session = activateSquare(session, sq("D", 4));
    session = activateSquare(session, sq("C", 4));
    expect(session.play.sideToMove).toBe("black");
    expect(session.play.moves).toEqual(["D5D4", "D9D10", "D4C4"]);
  });
});
