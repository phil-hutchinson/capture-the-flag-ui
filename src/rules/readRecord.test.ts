import { describe, expect, it } from "vitest";
import { EDITIONS } from "./primary/v2/edition.ts";
import {
  renderPositionBlock,
  RULESET_TAG,
  type InitialGameState,
} from "./primary/v2/gameState.ts";
import { renderMoveToken } from "./primary/v2/notation.ts";
import { renderGameRecord, startPlay } from "./primary/v2/play.ts";
import { readRecord } from "./readRecord.ts";

const GAME_STATE: InitialGameState = {
  ruleset: RULESET_TAG,
  board: {
    A1: { side: "white", pieceType: "flag" },
  },
};
const POSITION_BLOCK = renderPositionBlock(GAME_STATE);

describe("readRecord - edition dispatch", () => {
  it("rejects a retired 1.2:PRE-RELEASE record as an unknown ruleset", () => {
    // Story 00000023's Policy: major 2 is a go-forward replacement, not an
    // addition - there is no reader for the old tag any more, so a
    // 1.2:PRE-RELEASE file falls straight through to the same rejection as
    // any other name this app does not recognize (major-1 records are
    // deliberately not reviewable).
    const text = ['[Ruleset "1.2:PRE-RELEASE"]', POSITION_BLOCK].join("\n\n");

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: "1.2:PRE-RELEASE" },
    });
  });

  it("rejects a recognized-but-unknown ruleset version", () => {
    const text = ['[Ruleset "PRIMARY:2.0"]', POSITION_BLOCK].join("\n\n");

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: "PRIMARY:2.0" },
    });
  });

  it("rejects a PRIMARY:1.1-tagged record as an unknown ruleset", () => {
    // Story 00000016: 1.2 replaced 1.1 outright, and story 00000023 replaced
    // 1.2 outright in turn - no 1.1 reader has ever existed, and a 1.1 file
    // is honestly rejected as unrecognized, not mistaken for anything else.
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
    const text = ['[Ruleset "2-0:BATTLE"]', "not a valid position block"].join(
      "\n\n",
    );

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
    const text = ['[Ruleset "2-0:BATTLE"]', POSITION_BLOCK, "1. B1-B2"].join(
      "\n\n",
    );

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

// Small, hand-built 2-0:BATTLE records exercising the full parse-then-replay
// round trip end to end (story 00000016 Step 8, retargeted from
// 1.2:PRE-RELEASE to 2-0:BATTLE by story 00000023's Step 8 - the ruleset
// tag flip - ahead of story 00000017's real engine-produced fixtures).
// Deliberately not a realistic game (a piece "attacking" from several
// squares away, say) - replay.ts is rules-blind by design (see its header
// comment), so these fixtures only need to be *internally consistent*, not
// legal under the movement/combat rules; the point is round-trip honesty
// between the writer's format and this reader.
describe("readRecord - a small synthetic 2-0:BATTLE record round-trips", () => {
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
        '[Ruleset "2-0:BATTLE"]',
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
      ruleset: "2-0:BATTLE",
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

  it("rejects an intentionally malformed 2-0:BATTLE record (an unmarked capture)", () => {
    // The destination is occupied by a second piece the move token never
    // marks as removed - structurally a valid record, but not one that can
    // be carried out: a corrupted or hand-edited record, not a different
    // ruleset's.
    const malformedState: InitialGameState = {
      ruleset: RULESET_TAG,
      board: {
        A1: { side: "white", pieceType: "masterOfArms" },
        A2: { side: "white", pieceType: "champion" },
      },
    };
    const text = [
      '[Ruleset "2-0:BATTLE"]',
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

// Story 00000023's Step 8: the writer (`renderGameRecord`/`renderPositionBlock`,
// gameState.ts/play.ts) and this reader round-trip both published editions
// end to end - the `Ruleset` tag is the full edition id with no deviating
// flags, and the reader recovers the position block's dimensions and lake
// layout from that edition's `BoardLayout` rather than assuming Battle's
// fixed 12x12 grid. `renderGameRecord` itself still writes the plain move
// form (`A2A3`, no separator), which this reader deliberately does not
// accept (`parseMoveToken`'s `"plainNotation"` rejection, notation.ts) -
// switching the writer to the extended form is the standing "emitted record
// notation" backburner item (this story's story.md, "Out of scope"), not
// this step's job - so the two blocks below split the round trip the same
// way the format itself does: `renderGameRecord` round-trips the *opening*
// record (tag + position block, no moves yet, so no move section is even
// written); a hand-built extended-notation move sequence (mirroring the
// existing 2-0:BATTLE synthetic-record tests above) round-trips a *played*
// game's moves on both board sizes. Verifying the reviewer against *real*
// engine-produced 2.0 records is out of scope here (a follow-up story, per
// story.md's "Split delivery"); these round trips are entirely app-produced.
describe("readRecord - renderGameRecord's opening-position output round-trips for both editions", () => {
  it.each([
    ["2-0:BATTLE", EDITIONS["2-0:BATTLE"], 12] as const,
    ["2-0:SKIRMISH", EDITIONS["2-0:SKIRMISH"], 8] as const,
  ])("round-trips a freshly started %s game", (id, edition, size) => {
    const initial: InitialGameState = {
      ruleset: edition.id,
      edition,
      board: {
        A1: { side: "white", pieceType: "flag" },
      },
    };
    const state = startPlay(initial);

    const text = renderGameRecord(state);
    expect(text).toContain(`[Ruleset "${id}"]`);

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }

    expect(result.record.tags.ruleset).toBe(id);
    // The position block is size-describing - this confirms the reader
    // recovered this edition's own dimensions from it, not Battle's.
    const blockLines = renderPositionBlock(initial).split("\n");
    expect(blockLines).toHaveLength(size);
    for (const line of blockLines) {
      expect(line.split(" ")).toHaveLength(size);
    }
    expect(result.record.positions).toEqual([initial.board]);
    expect(result.record.moves).toEqual([]);
  });
});

describe("readRecord - a small synthetic 2-0:SKIRMISH record round-trips (8x8)", () => {
  const skirmish = EDITIONS["2-0:SKIRMISH"];
  const SKIRMISH_GAME_STATE: InitialGameState = {
    ruleset: skirmish.id,
    edition: skirmish,
    board: {
      A1: { side: "white", pieceType: "masterOfArms" },
      B1: { side: "white", pieceType: "champion" },
      D1: { side: "white", pieceType: "flag" },
      A8: { side: "black", pieceType: "knight" },
      B8: { side: "black", pieceType: "tower" },
    },
  };
  const SKIRMISH_POSITION_BLOCK = renderPositionBlock(SKIRMISH_GAME_STATE);

  // A1 -> A8: the length of this 8x8 board's own column, well past Battle's
  // squares on the same column - deliberately not a legal ply under the
  // movement rules (replay.ts is rules-blind by design; see the 2-0:BATTLE
  // fixtures above), but proof the reader accepts a destination row that
  // only exists on Skirmish's own 8-row board. The defender is removed
  // (Black's knight captured).
  const WHITE_1 = renderMoveToken({
    from: { column: "A", row: 1 },
    to: { column: "A", row: 8 },
    fromRemoved: false,
    toRemoved: true,
  });
  const BLACK_1 = renderMoveToken({
    from: { column: "B", row: 8 },
    to: { column: "B", row: 1 },
    fromRemoved: false,
    toRemoved: true,
  });

  it("accepts the record and replays to the final position on the 8x8 board", () => {
    const text = [
      [
        '[Ruleset "2-0:SKIRMISH"]',
        '[Result "0-1"]',
        '[ResultReason "Flag Captured"]',
      ].join("\n"),
      SKIRMISH_POSITION_BLOCK,
      `1. ${WHITE_1} ${BLACK_1}`,
    ].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    const { record } = result;

    expect(record.tags).toEqual({
      ruleset: "2-0:SKIRMISH",
      result: "0-1",
      resultReason: "Flag Captured",
    });
    expect(record.positions).toHaveLength(3);
    expect(record.positions[0]).toEqual(SKIRMISH_GAME_STATE.board);
    expect(record.positions[1]).toEqual({
      B1: { side: "white", pieceType: "champion" },
      D1: { side: "white", pieceType: "flag" },
      A8: { side: "white", pieceType: "masterOfArms" },
      B8: { side: "black", pieceType: "tower" },
    });
    expect(record.positions[2]).toEqual({
      D1: { side: "white", pieceType: "flag" },
      A8: { side: "white", pieceType: "masterOfArms" },
      B1: { side: "black", pieceType: "tower" },
    });
    expect(record.moves.map((move) => move.token)).toEqual([WHITE_1, BLACK_1]);
  });
});
