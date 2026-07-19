import { describe, expect, it } from "vitest";
import type { BoardState, PlacedPiece } from "./gameState.ts";
import type { ParsedRecord, RecordedPly } from "./recordFile.ts";
import { replayRecord, type ReplayedRecord } from "./replay.ts";

const WHITE_PIECE: PlacedPiece = { side: "white", pieceType: "champion" };
const BLACK_PIECE: PlacedPiece = { side: "black", pieceType: "tower" };

/** Builds one `RecordedPly` from shorthand, defaulting ply/round to a single round-1 move by White. */
function ply(
  overrides: Partial<RecordedPly> & Pick<RecordedPly, "token" | "move">,
): RecordedPly {
  return { ply: 1, round: 1, side: "white", ...overrides };
}

/** Builds a minimal `ParsedRecord` (empty tags) from a starting board and moves. */
function record(
  startingBoard: BoardState,
  moves: readonly RecordedPly[],
): ParsedRecord {
  return { tags: { ruleset: "1.2:PRE-RELEASE" }, startingBoard, moves };
}

function replayed(record: ParsedRecord): ReplayedRecord {
  const result = replayRecord(record);
  expect(result.kind).toBe("replayed");
  return (result as { kind: "replayed"; record: ReplayedRecord }).record;
}

describe("replayRecord - the four move shapes", () => {
  it("a quiet move (S-D) slides the piece, nothing removed", () => {
    const board: BoardState = { A1: WHITE_PIECE };
    const game = replayed(
      record(board, [
        ply({
          token: "A1-A2",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: false,
            toRemoved: false,
          },
        }),
      ]),
    );
    expect(game.positions[1]).toEqual({ A2: WHITE_PIECE });
  });

  it("an attacker-wins move (S-Dx) removes the defender and advances the attacker", () => {
    const board: BoardState = { A1: WHITE_PIECE, A2: BLACK_PIECE };
    const game = replayed(
      record(board, [
        ply({
          token: "A1-A2x",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: false,
            toRemoved: true,
          },
        }),
      ]),
    );
    expect(game.positions[1]).toEqual({ A2: WHITE_PIECE });
  });

  it("a complete-sacrifice move (Sx-D) removes the attacker; the defender stands", () => {
    const board: BoardState = { A1: WHITE_PIECE, A2: BLACK_PIECE };
    const game = replayed(
      record(board, [
        ply({
          token: "A1x-A2",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: true,
            toRemoved: false,
          },
        }),
      ]),
    );
    expect(game.positions[1]).toEqual({ A2: BLACK_PIECE });
  });

  it("a mutual-loss move (Sx-Dx) empties both squares", () => {
    const board: BoardState = { A1: WHITE_PIECE, A2: BLACK_PIECE };
    const game = replayed(
      record(board, [
        ply({
          token: "A1x-A2x",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: true,
            toRemoved: true,
          },
        }),
      ]),
    );
    expect(game.positions[1]).toEqual({});
  });
});

describe("replayRecord - no special casing for any attacker or the Flag", () => {
  it("any piece taking a Tower replays as an ordinary S-Dx move", () => {
    const board: BoardState = {
      A1: { side: "white", pieceType: "champion" },
      A2: { side: "black", pieceType: "tower" },
    };
    const game = replayed(
      record(board, [
        ply({
          token: "A1-A2x",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: false,
            toRemoved: true,
          },
        }),
      ]),
    );
    expect(game.positions[1]).toEqual({
      A2: { side: "white", pieceType: "champion" },
    });
  });

  it("a piece taking the Flag replays as an ordinary S-Dx move", () => {
    const board: BoardState = {
      A1: { side: "white", pieceType: "militia" },
      A2: { side: "black", pieceType: "flag" },
    };
    const game = replayed(
      record(board, [
        ply({
          token: "A1-A2x",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: false,
            toRemoved: true,
          },
        }),
      ]),
    );
    expect(game.positions[1]).toEqual({
      A2: { side: "white", pieceType: "militia" },
    });
  });
});

describe("replayRecord - the whole game", () => {
  it("produces moves.length + 1 positions, leaving the opening position untouched", () => {
    const board: BoardState = { A1: WHITE_PIECE, L12: BLACK_PIECE };
    const moves: RecordedPly[] = [
      ply({
        ply: 1,
        round: 1,
        side: "white",
        token: "A1-A2",
        move: {
          from: { column: "A", row: 1 },
          to: { column: "A", row: 2 },
          fromRemoved: false,
          toRemoved: false,
        },
      }),
      ply({
        ply: 2,
        round: 1,
        side: "black",
        token: "L12-L11",
        move: {
          from: { column: "L", row: 12 },
          to: { column: "L", row: 11 },
          fromRemoved: false,
          toRemoved: false,
        },
      }),
    ];
    const game = replayed(record(board, moves));

    expect(game.positions).toHaveLength(3);
    expect(game.positions[0]).toEqual(board);
    // The opening position object is untouched by later moves - it is not
    // the same object mutated in place.
    expect(board).toEqual({ A1: WHITE_PIECE, L12: BLACK_PIECE });
    expect(game.positions[2]).toEqual({
      A2: WHITE_PIECE,
      L11: BLACK_PIECE,
    });
    // The board after the last move matches an independently constructed
    // expectation.
    const expectedFinal: BoardState = { A2: WHITE_PIECE, L11: BLACK_PIECE };
    expect(game.moves.at(-1)?.boardAfter).toEqual(expectedFinal);
  });

  it("replays an illegal-by-the-rules but internally consistent move without complaint", () => {
    // A piece "moving" from A1 to L12 in one move: no rule (reachability,
    // rank, support) is ever consulted - only that A1 holds White's piece
    // and L12 was empty and unmarked. The reviewer is not a referee.
    const board: BoardState = { A1: WHITE_PIECE };
    const game = replayed(
      record(board, [
        ply({
          token: "A1-L12",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "L", row: 12 },
            fromRemoved: false,
            toRemoved: false,
          },
        }),
      ]),
    );
    expect(game.positions[1]).toEqual({ L12: WHITE_PIECE });
  });
});

describe("replayRecord - friendly-piece captures are accepted (owner's decision)", () => {
  it("does not reject a move whose recorded defender is the mover's own side", () => {
    const board: BoardState = {
      A1: WHITE_PIECE,
      A2: { side: "white", pieceType: "tower" },
    };
    const game = replayed(
      record(board, [
        ply({
          token: "A1-A2x",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: false,
            toRemoved: true,
          },
        }),
      ]),
    );
    expect(game.positions[1]).toEqual({ A2: WHITE_PIECE });
  });
});

describe("replayRecord - rejections", () => {
  it("rejects a move from an empty square", () => {
    const board: BoardState = {};
    const result = replayRecord(
      record(board, [
        ply({
          token: "A1-A2",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: false,
            toRemoved: false,
          },
        }),
      ]),
    );
    expect(result).toEqual({
      kind: "error",
      error: {
        kind: "emptySource",
        ply: 1,
        round: 1,
        side: "white",
        token: "A1-A2",
        square: { column: "A", row: 1 },
      },
    });
  });

  it("rejects a side moving the other side's piece", () => {
    const board: BoardState = { A1: BLACK_PIECE };
    const result = replayRecord(
      record(board, [
        ply({
          token: "A1-A2",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: false,
            toRemoved: false,
          },
        }),
      ]),
    );
    expect(result).toEqual({
      kind: "error",
      error: {
        kind: "wrongSide",
        ply: 1,
        round: 1,
        side: "white",
        token: "A1-A2",
        square: { column: "A", row: 1 },
      },
    });
  });

  it("rejects a piece landing on an occupied, unmarked destination", () => {
    const board: BoardState = { A1: WHITE_PIECE, A2: BLACK_PIECE };
    const result = replayRecord(
      record(board, [
        ply({
          token: "A1-A2",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: false,
            toRemoved: false,
          },
        }),
      ]),
    );
    expect(result).toEqual({
      kind: "error",
      error: {
        kind: "unmarkedCapture",
        ply: 1,
        round: 1,
        side: "white",
        token: "A1-A2",
        square: { column: "A", row: 2 },
      },
    });
  });

  it("rejects S-Dx where D is empty (an x that removes nothing)", () => {
    const board: BoardState = { A1: WHITE_PIECE };
    const result = replayRecord(
      record(board, [
        ply({
          token: "A1-A2x",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: false,
            toRemoved: true,
          },
        }),
      ]),
    );
    expect(result).toEqual({
      kind: "error",
      error: {
        kind: "phantomCapture",
        ply: 1,
        round: 1,
        side: "white",
        token: "A1-A2x",
        square: { column: "A", row: 2 },
      },
    });
  });

  it("rejects Sx-D where D is empty (an attacker sacrificed against nothing)", () => {
    const board: BoardState = { A1: WHITE_PIECE };
    const result = replayRecord(
      record(board, [
        ply({
          token: "A1x-A2",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: true,
            toRemoved: false,
          },
        }),
      ]),
    );
    expect(result).toEqual({
      kind: "error",
      error: {
        kind: "phantomSacrifice",
        ply: 1,
        round: 1,
        side: "white",
        token: "A1x-A2",
        square: { column: "A", row: 1 },
      },
    });
  });

  it("rejects a move whose source equals its destination (no marks)", () => {
    const board: BoardState = { A1: WHITE_PIECE };
    const result = replayRecord(
      record(board, [
        ply({
          token: "A1-A1",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 1 },
            fromRemoved: false,
            toRemoved: false,
          },
        }),
      ]),
    );
    expect(result).toEqual({
      kind: "error",
      error: {
        kind: "sameSquare",
        ply: 1,
        round: 1,
        side: "white",
        token: "A1-A1",
        square: { column: "A", row: 1 },
      },
    });
  });

  it("rejects a move whose source equals its destination, marked both ways", () => {
    const board: BoardState = { A1: WHITE_PIECE };
    const result = replayRecord(
      record(board, [
        ply({
          token: "A1x-A1x",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 1 },
            fromRemoved: true,
            toRemoved: true,
          },
        }),
      ]),
    );
    expect(result).toEqual({
      kind: "error",
      error: {
        kind: "sameSquare",
        ply: 1,
        round: 1,
        side: "white",
        token: "A1x-A1x",
        square: { column: "A", row: 1 },
      },
    });
  });

  it("reports the right ply number and round for an error partway through a game", () => {
    const board: BoardState = { A1: WHITE_PIECE, L12: BLACK_PIECE };
    const result = replayRecord(
      record(board, [
        ply({
          ply: 1,
          round: 1,
          side: "white",
          token: "A1-A2",
          move: {
            from: { column: "A", row: 1 },
            to: { column: "A", row: 2 },
            fromRemoved: false,
            toRemoved: false,
          },
        }),
        ply({
          ply: 2,
          round: 1,
          side: "black",
          token: "L12-L11",
          move: {
            from: { column: "L", row: 12 },
            to: { column: "L", row: 11 },
            fromRemoved: false,
            toRemoved: false,
          },
        }),
        ply({
          ply: 3,
          round: 2,
          side: "white",
          token: "B1-B2",
          move: {
            from: { column: "B", row: 1 },
            to: { column: "B", row: 2 },
            fromRemoved: false,
            toRemoved: false,
          },
        }),
      ]),
    );
    expect(result).toEqual({
      kind: "error",
      error: {
        kind: "emptySource",
        ply: 3,
        round: 2,
        side: "white",
        token: "B1-B2",
        square: { column: "B", row: 1 },
      },
    });
  });
});
