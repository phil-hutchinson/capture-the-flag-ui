import { describe, expect, it } from "vitest";
import type { BoardState, InitialGameState, PlacedPiece } from "./gameState.ts";
import { renderPositionBlock, RULESET_TAG } from "./gameState.ts";
import { PROGRESS_LIMIT } from "./outcome.ts";
import type { PieceTypeId } from "./pieces.ts";
import {
  agreeDraw,
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
    const initial = initialGameState([
      ["D5", "white", "infantry"],
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
    expect(next.board["D4"]).toEqual({ side: "white", pieceType: "infantry" });
    expect(next.sideToMove).toBe("black");
    expect(next.moves).toEqual(["D5D4"]);
    expect(outcome).toEqual({
      kind: "move",
      piece: { side: "white", pieceType: "infantry" },
      square: { column: "D", row: 4 },
    });
  });

  it("does not mutate the input state", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
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

  it("throws when `to` is occupied by a friendly piece", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D4", "white", "militia"],
    ]);
    const state = startPlay(initial);

    expect(() =>
      applyMove(state, { column: "D", row: 5 }, { column: "D", row: 4 }),
    ).toThrow();
  });

  it("throws when `to` is neither a legal destination nor a legal attack target", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D3", "black", "militia"],
    ]);
    const state = startPlay(initial);

    // D3 is two squares away - out of range for both a move and an attack.
    expect(() =>
      applyMove(state, { column: "D", row: 5 }, { column: "D", row: 3 }),
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
        archerSupport: false,
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
        archerSupport: false,
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
        archerSupport: false,
      });
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

describe("applyMove counters (§6.4/§6.5)", () => {
  it("starts a fresh game with all three counters at 0", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
    ]);
    const state = startPlay(initial);

    expect(state.inactivityCounters).toEqual({ white: 0, black: 0 });
    expect(state.progressCounter).toBe(0);
  });

  it("a plain move raises only the mover's inactivity counter and progress, leaving the opponent's untouched", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
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

    expect(next.inactivityCounters).toEqual({ white: 1, black: 0 });
    expect(next.progressCounter).toBe(1);
  });

  it("a winning attack zeroes the mover's inactivity counter and progress, leaving the opponent's inactivity counter unchanged", () => {
    const initial = initialGameState([
      ["D5", "white", "champion"], // rank 2
      ["D4", "black", "militia"], // rank 6
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    // Build up some counter state first so the reset is observable.
    state = {
      ...state,
      inactivityCounters: { white: 3, black: 5 },
      progressCounter: 7,
    };

    const { state: next, outcome } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );

    expect(outcome).toMatchObject({ result: "attackerWins" });
    expect(next.inactivityCounters).toEqual({ white: 0, black: 5 });
    expect(next.progressCounter).toBe(0);
  });

  it("a complete sacrifice (attacker loses) zeroes both inactivity counters but raises progress by 1", () => {
    const initial = initialGameState([
      ["D5", "white", "militia"], // rank 6
      ["D4", "black", "champion"], // rank 2
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    state = {
      ...state,
      inactivityCounters: { white: 3, black: 5 },
      progressCounter: 7,
    };

    const { state: next, outcome } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );

    expect(outcome).toMatchObject({ result: "attackerLoses", capture: false });
    expect(next.inactivityCounters).toEqual({ white: 0, black: 0 });
    expect(next.progressCounter).toBe(8);
  });

  it("a mutual loss zeroes both inactivity counters and progress", () => {
    const initial = initialGameState([
      ["D5", "white", "militia"],
      ["D4", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    state = {
      ...state,
      inactivityCounters: { white: 3, black: 5 },
      progressCounter: 7,
    };

    const { state: next, outcome } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );

    expect(outcome).toMatchObject({ result: "mutualLoss", capture: true });
    expect(next.inactivityCounters).toEqual({ white: 0, black: 0 });
    expect(next.progressCounter).toBe(0);
  });

  it("treats a Sapper destroying a Tower as a capture (progress resets)", () => {
    const initial = initialGameState([
      ["D5", "white", "sapper"],
      ["D4", "black", "tower"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    state = { ...state, progressCounter: 7 };

    const { state: next, outcome } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );

    expect(outcome).toMatchObject({ result: "attackerWins", capture: true });
    expect(next.progressCounter).toBe(0);
  });

  it("accumulates each side's own inactivity counter independently while progress counts every ply, across alternating plain moves", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
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
    expect(state.inactivityCounters).toEqual({ white: 1, black: 0 });
    expect(state.progressCounter).toBe(1);

    state = applyMove(
      state,
      { column: "D", row: 9 },
      { column: "D", row: 10 },
    ).state;
    expect(state.inactivityCounters).toEqual({ white: 1, black: 1 });
    expect(state.progressCounter).toBe(2);

    state = applyMove(
      state,
      { column: "D", row: 4 },
      { column: "C", row: 4 },
    ).state;
    expect(state.inactivityCounters).toEqual({ white: 2, black: 1 });
    expect(state.progressCounter).toBe(3);
  });

  it("does not mutate the input state's counters", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    const state = startPlay(initial);
    const originalCounters = state.inactivityCounters;

    applyMove(state, { column: "D", row: 5 }, { column: "D", row: 4 });

    expect(state.inactivityCounters).toBe(originalCounters);
    expect(state.inactivityCounters).toEqual({ white: 0, black: 0 });
    expect(state.progressCounter).toBe(0);
  });
});

describe("startPlay - result (§6 detection at the reveal)", () => {
  it("is ongoing for an ordinary starting position", () => {
    const initial = initialGameState([
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
    ]);
    const state = startPlay(initial);
    expect(state.result).toEqual({ kind: "ongoing" });
  });

  it("detects a §6.2 Unbreachable Flag win at the reveal, before any ply is played", () => {
    // White's Flag is sealed into a corner by two of White's own Towers
    // (mirrors reachability.test.ts's enclosure fixture); Black has no
    // Sapper anywhere on the board, so Black's Sappers are unavailable.
    const initial = initialGameState([
      ["A1", "white", "flag"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
      ["L12", "black", "flag"],
    ]);
    const state = startPlay(initial);
    expect(state.result).toEqual({
      kind: "win",
      winner: "white",
      reason: "unbreachableFlag",
    });
  });
});

describe("applyMove - result (§6 detection after every ply)", () => {
  it("sets result to a win when a ply captures the opponent's Flag", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
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

  it("ends the game the moment a ply captures the opponent's last available Sapper (§6.2 in play)", () => {
    // White's Flag is sealed into its corner by White's own Towers, so the
    // only thing keeping the game alive is Black's single Sapper - the one
    // piece type that can breach a Tower. It stands in the open with a clear
    // path to a White Tower, so at the reveal it is *available* and the game
    // is ongoing. White then captures it (Infantry, rank 4, over Sapper,
    // rank 9 - a clean win), leaving Black with no Sapper at all: White's
    // Flag becomes unbreachable and White wins on the spot, without the
    // Flag itself ever being threatened.
    const initial = initialGameState([
      ["A1", "white", "flag"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
      ["D5", "white", "infantry"],
      ["D6", "black", "sapper"],
      ["L12", "black", "flag"],
    ]);
    const state = startPlay(initial);
    // Precondition: Black's Sapper is available, so §6.2 does *not* hold yet.
    expect(state.result).toEqual({ kind: "ongoing" });

    const { state: next, outcome } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 6 },
    );

    expect(outcome).toMatchObject({ kind: "attack", result: "attackerWins" });
    expect(next.result).toEqual({
      kind: "win",
      winner: "white",
      reason: "unbreachableFlag",
    });
  });

  it("leaves result ongoing after a ply that does not end the game", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
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

  it("throws when called on a state whose game has already ended", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
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
  it("ends the game as an agreed draw, leaving the board, counters, side to move, and moves untouched", () => {
    const initial = initialGameState([
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
    ]);
    let state: PlayState = startPlay(initial);
    state = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    ).state;
    const boardBefore = state.board;
    const countersBefore = state.inactivityCounters;
    const progressBefore = state.progressCounter;
    const sideBefore = state.sideToMove;
    const movesBefore = state.moves;

    const drawn = agreeDraw(state);

    expect(drawn.result).toEqual({ kind: "draw", reason: "agreement" });
    expect(drawn.board).toBe(boardBefore);
    expect(drawn.inactivityCounters).toBe(countersBefore);
    expect(drawn.progressCounter).toBe(progressBefore);
    expect(drawn.sideToMove).toBe(sideBefore);
    expect(drawn.moves).toBe(movesBefore);
  });

  it("throws when the game has already ended", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
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
      ["D5", "white", "infantry"],
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

describe("renderGameRecord - Result/ResultReason (§6 record file format)", () => {
  it('writes [Result "*"] and no ResultReason tag while the game is ongoing', () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
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
      ["D5", "white", "infantry"],
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
      ["D5", "white", "infantry"],
      ["D9", "black", "infantry"],
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

  it('writes [Result "1/2-1/2"] and [ResultReason "No Progress"] for a no-progress draw', () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let state: PlayState = startPlay(initial);
    state = { ...state, progressCounter: PROGRESS_LIMIT - 1 };

    const { state: finished } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    );
    expect(finished.result).toMatchObject({
      kind: "draw",
      reason: "noProgress",
    });

    const record = renderGameRecord(finished);

    expect(record).toContain('[Result "1/2-1/2"]');
    expect(record).toContain('[ResultReason "No Progress"]');
  });

  it('writes [Result "1/2-1/2"] and [ResultReason "Agreement"] for an agreed draw, adding no move to the sequence', () => {
    const initial = initialGameState([
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
      ["D5", "white", "infantry"],
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

  it("still contains the Ruleset tag, position block, and plain-form move rounds alongside the result tags", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
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
