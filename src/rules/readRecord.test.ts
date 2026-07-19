import { describe, expect, it } from "vitest";
import {
  renderPositionBlock,
  RULESET_TAG,
  type InitialGameState,
} from "./primary/v1/gameState.ts";
import { renderMoveToken } from "./primary/v1/notation.ts";
import { readRecord } from "./readRecord.ts";

const GAME_STATE: InitialGameState = {
  ruleset: RULESET_TAG,
  board: {
    A1: { side: "white", pieceType: "flag" },
  },
};
const POSITION_BLOCK = renderPositionBlock(GAME_STATE);

describe("readRecord - version dispatch", () => {
  it("delegates a 1.2:PRE-RELEASE record to the v1 reader", () => {
    const text = ['[Ruleset "1.2:PRE-RELEASE"]', POSITION_BLOCK].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind === "parsed") {
      expect(result.record.tags.ruleset).toBe("1.2:PRE-RELEASE");
      expect(result.record.positions).toEqual([GAME_STATE.board]);
      expect(result.record.moves).toEqual([]);
    }
  });

  it("rejects a recognized-but-unknown ruleset version", () => {
    const text = ['[Ruleset "PRIMARY:2.0"]', POSITION_BLOCK].join("\n\n");

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: "PRIMARY:2.0" },
    });
  });

  it("rejects a PRIMARY:1.1-tagged record as an unknown ruleset", () => {
    // Story 00000016: 1.2 replaces 1.1 outright, no 1.1 reader exists any
    // more, and a 1.1 file is honestly rejected as unrecognized, not
    // mistaken for a 1.2 file.
    const text = ['[Ruleset "PRIMARY:1.1"]', POSITION_BLOCK].join("\n\n");

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: "PRIMARY:1.1" },
    });
  });

  it("rejects an entirely different ruleset name", () => {
    const text = ['[Ruleset "SOMETHING_ELSE:1.0"]', POSITION_BLOCK].join(
      "\n\n",
    );

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: "SOMETHING_ELSE:1.0" },
    });
  });

  it("rejects a file with no readable Ruleset tag as not a game record", () => {
    const text = "Just a photo, or some other file - not a game record.";

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "notARecord" },
    });
  });

  it("surfaces the delegated reader's own structural errors", () => {
    const text = [
      '[Ruleset "1.2:PRE-RELEASE"]',
      "not a valid position block",
    ].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error.kind).toBe("recordFile");
    }
  });

  it("replays a well-formed record, and surfaces the delegated reader's own replay errors", () => {
    // A move from an empty square: the file parses cleanly (it is
    // structurally a valid record) but cannot be replayed to the end - so
    // reading it is a rejection, not a part-loaded game.
    const text = [
      '[Ruleset "1.2:PRE-RELEASE"]',
      POSITION_BLOCK,
      "1. B1-B2",
    ].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error).toEqual({
        kind: "replay",
        error: {
          kind: "emptySource",
          ply: 1,
          round: 1,
          side: "white",
          token: "B1-B2",
          square: { column: "B", row: 1 },
        },
      });
    }
  });
});

// Small, hand-built 1.2:PRE-RELEASE records exercising the full
// parse-then-replay round trip end to end (story 00000016 Step 8 - the
// story's stated interim, ahead of story 00000017's real engine-produced
// fixtures). Deliberately not a realistic game (a piece "attacking" from
// several squares away, say) - replay.ts is rules-blind by design (see its
// header comment), so these fixtures only need to be *internally
// consistent*, not legal under the movement/combat rules; the point is
// round-trip honesty between the writer's format and this reader.
describe("readRecord - a small synthetic 1.2:PRE-RELEASE record round-trips", () => {
  const ROUND_TRIP_GAME_STATE: InitialGameState = {
    ruleset: RULESET_TAG,
    board: {
      A1: { side: "white", pieceType: "masterOfArms" },
      B1: { side: "white", pieceType: "champion" },
      C1: { side: "white", pieceType: "tower" },
      D1: { side: "white", pieceType: "flag" },
      A9: { side: "black", pieceType: "knight" },
      B9: { side: "black", pieceType: "militia" },
    },
  };
  const ROUND_TRIP_POSITION_BLOCK = renderPositionBlock(ROUND_TRIP_GAME_STATE);

  // Round 1: a quiet move for each side.
  const WHITE_1 = renderMoveToken({
    from: { column: "A", row: 1 },
    to: { column: "A", row: 2 },
    fromRemoved: false,
    toRemoved: false,
  });
  const BLACK_1 = renderMoveToken({
    from: { column: "A", row: 9 },
    to: { column: "A", row: 8 },
    fromRemoved: false,
    toRemoved: false,
  });
  // Round 2: White's masterOfArms wins an attack (the defender is removed,
  // the attacker advances); Black plays another quiet move.
  const WHITE_2 = renderMoveToken({
    from: { column: "A", row: 2 },
    to: { column: "A", row: 8 },
    fromRemoved: false,
    toRemoved: true,
  });
  const BLACK_2 = renderMoveToken({
    from: { column: "B", row: 9 },
    to: { column: "B", row: 8 },
    fromRemoved: false,
    toRemoved: false,
  });
  // Round 3: a mutual loss - both pieces removed - as White's trailing move
  // (the final round of the file, so it carries no Black move).
  const WHITE_3 = renderMoveToken({
    from: { column: "A", row: 8 },
    to: { column: "B", row: 8 },
    fromRemoved: true,
    toRemoved: true,
  });

  it("accepts the record and replays every move to the final position", () => {
    const text = [
      [
        '[Ruleset "1.2:PRE-RELEASE"]',
        '[Result "1-0"]',
        '[ResultReason "Flag Captured"]',
      ].join("\n"),
      ROUND_TRIP_POSITION_BLOCK,
      [
        `1. ${WHITE_1} ${BLACK_1}`,
        `2. ${WHITE_2} ${BLACK_2}`,
        `3. ${WHITE_3}`,
      ].join("\n"),
    ].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    const { record } = result;

    expect(record.tags).toEqual({
      ruleset: "1.2:PRE-RELEASE",
      result: "1-0",
      resultReason: "Flag Captured",
    });
    expect(record.positions).toHaveLength(6);
    expect(record.positions[0]).toEqual(ROUND_TRIP_GAME_STATE.board);

    const finalPosition = record.positions[record.positions.length - 1];
    expect(finalPosition).toEqual({
      B1: { side: "white", pieceType: "champion" },
      C1: { side: "white", pieceType: "tower" },
      D1: { side: "white", pieceType: "flag" },
    });

    expect(record.moves).toHaveLength(5);
    expect(record.moves.map((move) => move.token)).toEqual([
      WHITE_1,
      BLACK_1,
      WHITE_2,
      BLACK_2,
      WHITE_3,
    ]);
    expect(record.moves[4]).toMatchObject({
      ply: 5,
      round: 3,
      side: "white",
    });
  });

  it("rejects an intentionally malformed 1.2:PRE-RELEASE record (an unmarked capture)", () => {
    // The destination is occupied by a second piece the move token never
    // marks as removed - structurally a valid record, but not one that can
    // be carried out: a corrupted or hand-edited 1.2 record, not a 1.1 one.
    const malformedState: InitialGameState = {
      ruleset: RULESET_TAG,
      board: {
        A1: { side: "white", pieceType: "masterOfArms" },
        A2: { side: "white", pieceType: "champion" },
      },
    };
    const text = [
      '[Ruleset "1.2:PRE-RELEASE"]',
      renderPositionBlock(malformedState),
      "1. A1-A2",
    ].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error).toEqual({
        kind: "replay",
        error: {
          kind: "unmarkedCapture",
          ply: 1,
          round: 1,
          side: "white",
          token: "A1-A2",
          square: { column: "A", row: 2 },
        },
      });
    }
  });
});
