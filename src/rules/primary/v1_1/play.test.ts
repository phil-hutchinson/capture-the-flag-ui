import { describe, expect, it } from "vitest";
import type { BoardState, InitialGameState, PlacedPiece } from "./gameState.ts";
import { renderPositionBlock, RULESET_TAG } from "./gameState.ts";
import type { PieceTypeId } from "./pieces.ts";
import {
  applyMove,
  renderGameRecord,
  startPlay,
  type PlayState,
} from "./play.ts";

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

describe("startPlay", () => {
  it("has White to move, the initial board unchanged, an empty move list, and the ruleset carried over", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
    ]);
    const state = startPlay(initial);
    expect(state.sideToMove).toBe("white");
    expect(state.board).toEqual(initial.board);
    expect(state.initialBoard).toEqual(initial.board);
    expect(state.moves).toEqual([]);
    expect(state.ruleset).toBe(RULESET_TAG);
  });
});

describe("applyMove", () => {
  it("moves the piece, flips the side, and appends the A2A3 move string", () => {
    const initial = initialGameState([["D5", "white", "infantry"]]);
    const state = startPlay(initial);
    const next = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );

    expect(next.board["D5"]).toBeUndefined();
    expect(next.board["D4"]).toEqual({ side: "white", pieceType: "infantry" });
    expect(next.sideToMove).toBe("black");
    expect(next.moves).toEqual(["D5D4"]);
  });

  it("does not mutate the input state", () => {
    const initial = initialGameState([["D5", "white", "infantry"]]);
    const state = startPlay(initial);
    const originalBoard = state.board;
    const originalMoves = state.moves;

    applyMove(state, { column: "D", row: 5 }, { column: "D", row: 4 });

    expect(state.board).toBe(originalBoard);
    expect(state.board["D5"]).toEqual({ side: "white", pieceType: "infantry" });
    expect(state.sideToMove).toBe("white");
    expect(state.moves).toBe(originalMoves);
    expect(state.moves).toEqual([]);
  });

  it("accumulates a sequence of moves in order, alternating sides", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
    ]);
    let state: PlayState = startPlay(initial);

    state = applyMove(state, { column: "D", row: 5 }, { column: "D", row: 4 });
    expect(state.sideToMove).toBe("black");

    state = applyMove(state, { column: "D", row: 9 }, { column: "D", row: 10 });
    expect(state.sideToMove).toBe("white");

    state = applyMove(state, { column: "D", row: 4 }, { column: "C", row: 4 });
    expect(state.sideToMove).toBe("black");

    expect(state.moves).toEqual(["D5D4", "D9D10", "D4C4"]);
    expect(state.initialBoard).toEqual(initial.board);
    expect(state.board).not.toEqual(initial.board);
  });

  it("throws when the piece on `from` does not belong to the side to move", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
    ]);
    const state = startPlay(initial);

    expect(() =>
      applyMove(state, { column: "D", row: 9 }, { column: "D", row: 10 }),
    ).toThrow();
  });

  it("throws when `from` is empty", () => {
    const initial = initialGameState([["D5", "white", "infantry"]]);
    const state = startPlay(initial);

    expect(() =>
      applyMove(state, { column: "E", row: 5 }, { column: "E", row: 4 }),
    ).toThrow();
  });

  it("throws when `to` is not a legal destination (too far for a baseline piece)", () => {
    const initial = initialGameState([["D5", "white", "infantry"]]);
    const state = startPlay(initial);

    expect(() =>
      applyMove(state, { column: "D", row: 5 }, { column: "D", row: 3 }),
    ).toThrow();
  });

  it("throws when `to` is occupied", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D4", "white", "militia"],
    ]);
    const state = startPlay(initial);

    expect(() =>
      applyMove(state, { column: "D", row: 5 }, { column: "D", row: 4 }),
    ).toThrow();
  });
});

describe("renderGameRecord", () => {
  it("contains the Ruleset tag and the opening position's block", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
    ]);
    const state = startPlay(initial);

    const record = renderGameRecord(state);

    expect(record).toContain(`[Ruleset "${RULESET_TAG}"]`);
    expect(record).toContain(renderPositionBlock(initial));
  });

  it("keeps the position block equal to the *starting* position after moves are applied", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
    ]);
    let state: PlayState = startPlay(initial);
    state = applyMove(state, { column: "D", row: 5 }, { column: "D", row: 4 });
    state = applyMove(state, { column: "D", row: 9 }, { column: "D", row: 10 });

    const record = renderGameRecord(state);

    expect(record).toContain(renderPositionBlock(initial));
    // The current board (D4/D10) must not appear as the record's position
    // block - only the opening D5/D9 position does.
    expect(record).not.toContain(
      renderPositionBlock({ ruleset: RULESET_TAG, board: state.board }),
    );
  });

  it("groups moves into rounds numbered from 1, with a trailing White-only round", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
      ["C5", "white", "militia"],
    ]);
    let state: PlayState = startPlay(initial);
    state = applyMove(state, { column: "D", row: 5 }, { column: "D", row: 4 });
    state = applyMove(state, { column: "D", row: 9 }, { column: "D", row: 10 });
    state = applyMove(state, { column: "C", row: 5 }, { column: "C", row: 4 });

    const record = renderGameRecord(state);

    expect(record).toContain("1. D5D4 D9D10");
    expect(record).toContain("2. C5C4");
    expect(record).not.toMatch(/2\. C5C4 \S/);
  });
});
