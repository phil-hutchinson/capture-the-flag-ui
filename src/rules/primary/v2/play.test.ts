import { describe, expect, it } from "vitest";
import type { BoardState, InitialGameState, PlacedPiece } from "./gameState.ts";
import { renderPositionBlock, RULESET_TAG } from "./gameState.ts";
import { INACTIVITY_LIMIT } from "./outcome.ts";
import type { PieceTypeId } from "./pieces.ts";
import {
  agreeDraw,
  applyMove,
  renderGameRecord,
  startPlay,
  type PlayState,
} from "./play.ts";

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

function initialGameState(
  pieces: readonly [string, PlacedPiece["side"], PieceTypeId][],
): InitialGameState {
  return { ruleset: RULESET_TAG, board: board(pieces) };
}

describe("startPlay", () => {
  it("has White to move, the initial board unchanged, an empty move list, and the ruleset carried over", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
    ]);
    const state = startPlay(initial);
    expect(state.sideToMove).toBe("white");
    expect(state.board).toEqual(initial.board);
    expect(state.initialBoard).toEqual(initial.board);
    expect(state.moves).toEqual([]);
    expect(state.ruleset).toBe(RULESET_TAG);
  });

  it("starts with the shared inactivity counter at 0 and result ongoing", () => {
    const initial = initialGameState([
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
    ]);
    const state = startPlay(initial);
    expect(state.inactivityCounter).toBe(0);
    expect(state.result).toEqual({ kind: "ongoing" });
  });
});

describe("applyMove", () => {
  it("moves the piece, flips the side, and appends the A2A3 move string", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    const state = startPlay(initial);
    const { state: next, outcome } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );

    expect(next.board["D5"]).toBeUndefined();
    expect(next.board["D4"]).toEqual({ side: "white", pieceType: "champion" });
    expect(next.sideToMove).toBe("black");
    expect(next.moves).toEqual(["D5D4"]);
    expect(outcome).toEqual({
      kind: "move",
      piece: { side: "white", pieceType: "champion" },
      square: { column: "D", row: 4 },
    });
  });

  it("does not mutate the input state", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    const state = startPlay(initial);
    const originalBoard = state.board;
    const originalMoves = state.moves;

    applyMove(state, { column: "D", row: 5 }, { column: "D", row: 4 });

    expect(state.board).toBe(originalBoard);
    expect(state.board["D5"]).toEqual({ side: "white", pieceType: "champion" });
    expect(state.sideToMove).toBe("white");
    expect(state.moves).toBe(originalMoves);
    expect(state.moves).toEqual([]);
  });

  it("accumulates a sequence of moves in order, alternating sides", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);

    state = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    ).state;
    expect(state.sideToMove).toBe("black");

    state = applyMove(
      state,
      { column: "D", row: 9 },
      { column: "D", row: 10 },
    ).state;
    expect(state.sideToMove).toBe("white");

    state = applyMove(
      state,
      { column: "D", row: 4 },
      { column: "C", row: 4 },
    ).state;
    expect(state.sideToMove).toBe("black");

    expect(state.moves).toEqual(["D5D4", "D9D10", "D4C4"]);
    expect(state.initialBoard).toEqual(initial.board);
    expect(state.board).not.toEqual(initial.board);
  });

  it("throws when the piece on `from` does not belong to the side to move", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
    ]);
    const state = startPlay(initial);

    expect(() =>
      applyMove(state, { column: "D", row: 9 }, { column: "D", row: 10 }),
    ).toThrow();
  });

  it("throws when `from` is empty", () => {
    const initial = initialGameState([["D5", "white", "champion"]]);
    const state = startPlay(initial);

    expect(() =>
      applyMove(state, { column: "E", row: 5 }, { column: "E", row: 4 }),
    ).toThrow();
  });

  it("throws when `to` is occupied by a friendly piece", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D4", "white", "militia"],
    ]);
    const state = startPlay(initial);

    expect(() =>
      applyMove(state, { column: "D", row: 5 }, { column: "D", row: 4 }),
    ).toThrow();
  });

  it("throws when `to` is neither a legal destination nor a legal attack target", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D2", "black", "militia"],
    ]);
    const state = startPlay(initial);

    // D2 is three squares away - out of range for both a move and an attack,
    // even for an unencumbered piece's two-square option.
    expect(() =>
      applyMove(state, { column: "D", row: 5 }, { column: "D", row: 2 }),
    ).toThrow();
  });

  describe("attacks", () => {
    it("attacking a weaker piece removes the defender and advances the attacker (attacker wins)", () => {
      const initial = initialGameState([
        ["D5", "white", "champion"], // rank 2
        ["D4", "black", "militia"], // rank 6
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]);
      const state = startPlay(initial);
      const { state: next, outcome } = applyMove(
        state,
        { column: "D", row: 5 },
        { column: "D", row: 4 },
      );

      expect(next.board["D5"]).toBeUndefined();
      expect(next.board["D4"]).toEqual({
        side: "white",
        pieceType: "champion",
      });
      expect(next.sideToMove).toBe("black");
      expect(next.moves).toEqual(["D5D4"]);
      expect(outcome).toEqual({
        kind: "attack",
        result: "attackerWins",
        attacker: { side: "white", pieceType: "champion" },
        defender: { side: "black", pieceType: "militia" },
        square: { column: "D", row: 4 },
        capture: true,
      });
    });

    it("attacking a stronger piece removes the attacker and leaves the defender (attacker loses)", () => {
      const initial = initialGameState([
        ["D5", "white", "militia"], // rank 6
        ["D4", "black", "champion"], // rank 2
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]);
      const state = startPlay(initial);
      const { state: next, outcome } = applyMove(
        state,
        { column: "D", row: 5 },
        { column: "D", row: 4 },
      );

      expect(next.board["D5"]).toBeUndefined();
      expect(next.board["D4"]).toEqual({
        side: "black",
        pieceType: "champion",
      });
      expect(next.sideToMove).toBe("black");
      expect(next.moves).toEqual(["D5D4"]);
      expect(outcome).toEqual({
        kind: "attack",
        result: "attackerLoses",
        attacker: { side: "white", pieceType: "militia" },
        defender: { side: "black", pieceType: "champion" },
        square: { column: "D", row: 4 },
        capture: false,
      });
    });

    it("an equal-rank attack empties the square (mutual loss)", () => {
      const initial = initialGameState([
        ["D5", "white", "militia"],
        ["D4", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]);
      const state = startPlay(initial);
      const { state: next, outcome } = applyMove(
        state,
        { column: "D", row: 5 },
        { column: "D", row: 4 },
      );

      expect(next.board["D5"]).toBeUndefined();
      expect(next.board["D4"]).toBeUndefined();
      expect(next.sideToMove).toBe("black");
      expect(next.moves).toEqual(["D5D4"]);
      expect(outcome).toEqual({
        kind: "attack",
        result: "mutualLoss",
        attacker: { side: "white", pieceType: "militia" },
        defender: { side: "black", pieceType: "militia" },
        square: { column: "D", row: 4 },
        capture: true,
      });
    });

    it("attacking a Tower is a mutual loss, whatever the attacker's rank", () => {
      const initial = initialGameState([
        ["D5", "white", "champion"], // rank 2 - the strongest rank-stable fixture piece
        ["D4", "black", "tower"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]);
      const state = startPlay(initial);
      const { state: next, outcome } = applyMove(
        state,
        { column: "D", row: 5 },
        { column: "D", row: 4 },
      );

      expect(next.board["D5"]).toBeUndefined();
      expect(next.board["D4"]).toBeUndefined();
      expect(outcome).toMatchObject({ result: "mutualLoss", capture: true });
    });

    it("does not mutate the input state", () => {
      const initial = initialGameState([
        ["D5", "white", "champion"],
        ["D4", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]);
      const state = startPlay(initial);
      const originalBoard = state.board;

      applyMove(state, { column: "D", row: 5 }, { column: "D", row: 4 });

      expect(state.board).toBe(originalBoard);
      expect(state.board["D5"]).toEqual({
        side: "white",
        pieceType: "champion",
      });
      expect(state.board["D4"]).toEqual({
        side: "black",
        pieceType: "militia",
      });
      expect(state.sideToMove).toBe("white");
    });

    it("renders an attack as a plain A2A3 move in the game record", () => {
      const initial = initialGameState([
        ["D5", "white", "champion"],
        ["D4", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]);
      let state: PlayState = startPlay(initial);
      state = applyMove(
        state,
        { column: "D", row: 5 },
        { column: "D", row: 4 },
      ).state;

      const record = renderGameRecord(state);
      expect(record).toContain("1. D5D4");
      expect(record).not.toMatch(/D5D4[^\s]/);
    });
  });
});

describe("applyMove - the shared inactivity counter (§5.3)", () => {
  it("starts a fresh game with the counter at 0", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
    ]);
    const state = startPlay(initial);

    expect(state.inactivityCounter).toBe(0);
  });

  it("a plain move raises the shared counter by 1", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    const state = startPlay(initial);

    const { state: next } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );

    expect(next.inactivityCounter).toBe(1);
  });

  it("a winning attack (a piece removed) resets the counter to 0", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"], // rank 2
      ["D4", "black", "militia"], // rank 6
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    // Build up some counter state first so the reset is observable.
    state = { ...state, inactivityCounter: 7 };

    const { state: next, outcome } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );

    expect(outcome).toMatchObject({ result: "attackerWins" });
    expect(next.inactivityCounter).toBe(0);
  });

  it("a complete sacrifice (attacker loses, the attacker is removed) resets the counter to 0", () => {
    const initial = initialGameState([
      ["D5", "white", "militia"], // rank 6
      ["D4", "black", "champion"], // rank 2
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    state = { ...state, inactivityCounter: 7 };

    const { state: next, outcome } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );

    expect(outcome).toMatchObject({ result: "attackerLoses", capture: false });
    expect(next.inactivityCounter).toBe(0);
  });

  it("a mutual loss (pieces removed) resets the counter to 0", () => {
    const initial = initialGameState([
      ["D5", "white", "militia"],
      ["D4", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    state = { ...state, inactivityCounter: 7 };

    const { state: next, outcome } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );

    expect(outcome).toMatchObject({ result: "mutualLoss", capture: true });
    expect(next.inactivityCounter).toBe(0);
  });

  it("a Tower trade (a mutual loss) resets the counter to 0, whatever the attacker's rank", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D4", "black", "tower"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    state = { ...state, inactivityCounter: 7 };

    const { state: next, outcome } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );

    expect(outcome).toMatchObject({ result: "mutualLoss", capture: true });
    expect(next.inactivityCounter).toBe(0);
  });

  it("accumulates across alternating plain moves", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);

    state = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    ).state;
    expect(state.inactivityCounter).toBe(1);

    state = applyMove(
      state,
      { column: "D", row: 9 },
      { column: "D", row: 10 },
    ).state;
    expect(state.inactivityCounter).toBe(2);

    state = applyMove(
      state,
      { column: "D", row: 4 },
      { column: "C", row: 4 },
    ).state;
    expect(state.inactivityCounter).toBe(3);
  });

  it("does not mutate the input state's counter", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    const state = startPlay(initial);
    applyMove(state, { column: "D", row: 5 }, { column: "D", row: 4 });

    expect(state.inactivityCounter).toBe(0);
  });

  it("ends the game as a draw once the counter reaches the limit", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    state = { ...state, inactivityCounter: INACTIVITY_LIMIT - 1 };

    const { state: next } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );

    expect(next.inactivityCounter).toBe(INACTIVITY_LIMIT);
    expect(next.result).toEqual({ kind: "draw", reason: "inactivity" });
  });
});

describe("applyMove - result (§5 detection after every ply)", () => {
  it("sets result to a win when a ply captures the opponent's Flag", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D6", "black", "flag"],
      ["A1", "white", "flag"],
    ]);
    const state = startPlay(initial);
    const { state: next, outcome } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 6 },
    );

    expect(outcome).toMatchObject({ kind: "attack", result: "attackerWins" });
    expect(next.result).toEqual({
      kind: "win",
      winner: "white",
      reason: "flagCapture",
    });
  });

  it("leaves result ongoing after a ply that does not end the game", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    const state = startPlay(initial);
    const { state: next } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );
    expect(next.result).toEqual({ kind: "ongoing" });
  });

  it("ends the game for the side left with no legal ply", () => {
    // Black's only mobile piece is boxed in by its own immobile Towers, so
    // once it is Black to move they have no legal ply at all and White wins
    // (§5.2). Black's Flag is left in the open, so §5.1 does not pre-empt it.
    const initial = initialGameState([
      ["A1", "white", "flag"],
      ["H5", "white", "champion"],
      ["L12", "black", "flag"],
      ["D9", "black", "militia"],
      ["C9", "black", "tower"],
      ["E9", "black", "tower"],
      ["D8", "black", "tower"],
      ["D10", "black", "tower"],
    ]);
    let state: PlayState = startPlay(initial);
    expect(state.result).toEqual({ kind: "ongoing" });

    state = applyMove(
      state,
      { column: "H", row: 5 },
      { column: "H", row: 4 },
    ).state;
    expect(state.result).toEqual({
      kind: "win",
      winner: "white",
      reason: "noLegalMove",
    });
  });

  it("throws when called on a state whose game has already ended", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D6", "black", "flag"],
      ["A1", "white", "flag"],
    ]);
    const state = startPlay(initial);
    const { state: finished } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 6 },
    );
    expect(finished.result.kind).not.toBe("ongoing");

    expect(() =>
      applyMove(finished, { column: "D", row: 6 }, { column: "D", row: 7 }),
    ).toThrow();
  });
});

describe("agreeDraw", () => {
  it("ends the game as an agreed draw, leaving the board, counter, side to move, and moves untouched", () => {
    const initial = initialGameState([
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
    ]);
    let state: PlayState = startPlay(initial);
    state = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    ).state;
    const boardBefore = state.board;
    const counterBefore = state.inactivityCounter;
    const sideBefore = state.sideToMove;
    const movesBefore = state.moves;

    const drawn = agreeDraw(state);

    expect(drawn.result).toEqual({ kind: "draw", reason: "agreement" });
    expect(drawn.board).toBe(boardBefore);
    expect(drawn.inactivityCounter).toBe(counterBefore);
    expect(drawn.sideToMove).toBe(sideBefore);
    expect(drawn.moves).toBe(movesBefore);
  });

  it("throws when the game has already ended", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D6", "black", "flag"],
      ["A1", "white", "flag"],
    ]);
    const state = startPlay(initial);
    const { state: finished } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 6 },
    );
    expect(() => agreeDraw(finished)).toThrow();
  });
});

describe("renderGameRecord", () => {
  it("contains the Ruleset tag and the opening position's block", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
    ]);
    const state = startPlay(initial);

    const record = renderGameRecord(state);

    expect(record).toContain(`[Ruleset "${RULESET_TAG}"]`);
    expect(record).toContain(renderPositionBlock(initial));
  });

  it("keeps the position block equal to the *starting* position after moves are applied", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    state = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    ).state;
    state = applyMove(
      state,
      { column: "D", row: 9 },
      { column: "D", row: 10 },
    ).state;

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
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
      ["C5", "white", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    state = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    ).state;
    state = applyMove(
      state,
      { column: "D", row: 9 },
      { column: "D", row: 10 },
    ).state;
    state = applyMove(
      state,
      { column: "C", row: 5 },
      { column: "C", row: 4 },
    ).state;

    const record = renderGameRecord(state);

    expect(record).toContain("1. D5D4 D9D10");
    expect(record).toContain("2. C5C4");
    expect(record).not.toMatch(/2\. C5C4 \S/);
  });
});

describe("renderGameRecord - Result/ResultReason (§5 record file format)", () => {
  it('writes [Result "*"] and no ResultReason tag while the game is ongoing', () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    const state = startPlay(initial);

    const record = renderGameRecord(state);

    expect(record).toContain('[Result "*"]');
    expect(record).not.toContain("ResultReason");
  });

  it('writes [Result "1-0"] and [ResultReason "Flag Captured"] for a White (Red) flag-capture win', () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D6", "black", "flag"],
      ["A1", "white", "flag"],
    ]);
    const state = startPlay(initial);
    const { state: finished } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 6 },
    );

    const record = renderGameRecord(finished);

    expect(record).toContain('[Result "1-0"]');
    expect(record).toContain('[ResultReason "Flag Captured"]');
  });

  it('writes [Result "0-1"] for a Black (Blue) win', () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "champion"],
      ["D8", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    state = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    ).state;
    const { state: finished } = applyMove(
      state,
      { column: "D", row: 9 },
      { column: "D", row: 8 },
    );
    expect(finished.result).toMatchObject({ kind: "win", winner: "black" });

    const record = renderGameRecord(finished);

    expect(record).toContain('[Result "0-1"]');
    expect(record).toContain('[ResultReason "Flag Captured"]');
  });

  it('writes [Result "1/2-1/2"] and [ResultReason "Inactivity"] for a shared inactivity draw', () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    state = { ...state, inactivityCounter: INACTIVITY_LIMIT - 1 };

    const { state: finished } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );
    expect(finished.result).toMatchObject({
      kind: "draw",
      reason: "inactivity",
    });

    const record = renderGameRecord(finished);

    expect(record).toContain('[Result "1/2-1/2"]');
    expect(record).toContain('[ResultReason "Inactivity"]');
  });

  it('writes [Result "1/2-1/2"] and [ResultReason "Agreement"] for an agreed draw, adding no move to the sequence', () => {
    const initial = initialGameState([
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
      ["D5", "white", "champion"],
      ["D9", "black", "militia"],
    ]);
    let state: PlayState = startPlay(initial);
    state = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    ).state;
    const movesBefore = state.moves;

    const drawn = agreeDraw(state);
    const record = renderGameRecord(drawn);

    expect(record).toContain('[Result "1/2-1/2"]');
    expect(record).toContain('[ResultReason "Agreement"]');
    expect(drawn.moves).toBe(movesBefore);
    expect(record).toContain("1. D5D4");
    expect(record).not.toMatch(/D5D4[^\s]/);
  });

  it('writes [ResultReason "No Legal Move"] when the side to move is left with no legal ply', () => {
    const initial = initialGameState([
      ["A1", "white", "flag"],
      ["H5", "white", "champion"],
      ["L12", "black", "flag"],
      ["D9", "black", "militia"],
      ["C9", "black", "tower"],
      ["E9", "black", "tower"],
      ["D8", "black", "tower"],
      ["D10", "black", "tower"],
    ]);
    let state: PlayState = startPlay(initial);
    expect(state.result).toEqual({ kind: "ongoing" });

    state = applyMove(
      state,
      { column: "H", row: 5 },
      { column: "H", row: 4 },
    ).state;
    expect(state.result).toEqual({
      kind: "win",
      winner: "white",
      reason: "noLegalMove",
    });

    const record = renderGameRecord(state);

    expect(record).toContain('[Result "1-0"]');
    expect(record).toContain('[ResultReason "No Legal Move"]');
  });

  it("still contains the Ruleset tag, position block, and plain-form move rounds alongside the result tags", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"],
      ["D6", "black", "flag"],
      ["A1", "white", "flag"],
    ]);
    const state = startPlay(initial);
    const { state: finished } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 6 },
    );

    const record = renderGameRecord(finished);

    expect(record).toContain(`[Ruleset "${RULESET_TAG}"]`);
    expect(record).toContain(renderPositionBlock(initial));
    expect(record).toContain("1. D5D6");
  });
});
