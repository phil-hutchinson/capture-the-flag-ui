import { describe, expect, it } from "vitest";
import {
  renderPositionBlock,
  RULESET_TAG,
  type InitialGameState,
} from "./gameState.ts";
import { renderMoveToken } from "./notation.ts";
import {
  parseRecordFile,
  type ParsedRecord,
  type RecordFileResult,
} from "./recordFile.ts";

/** A small, hand-built board (mirrors gameState.test.ts's sparse example) - board
 * consistency is not this module's concern (that is replay.ts's job), so a
 * sparse board keeps these fixtures easy to read. */
const GAME_STATE: InitialGameState = {
  ruleset: RULESET_TAG,
  board: {
    A1: { side: "white", pieceType: "flag" },
    L1: { side: "white", pieceType: "lordMarshal" },
    F12: { side: "black", pieceType: "assassin" },
    A12: { side: "black", pieceType: "tower" },
  },
};
const POSITION_BLOCK = renderPositionBlock(GAME_STATE);

const WHITE_MOVE_1 = renderMoveToken({
  from: { column: "A", row: 1 },
  to: { column: "A", row: 2 },
  fromRemoved: false,
  toRemoved: false,
});
const BLACK_MOVE_1 = renderMoveToken({
  from: { column: "F", row: 12 },
  to: { column: "F", row: 11 },
  fromRemoved: false,
  toRemoved: false,
});
const WHITE_MOVE_2 = renderMoveToken({
  from: { column: "A", row: 2 },
  to: { column: "A", row: 3 },
  fromRemoved: false,
  toRemoved: true,
});
const BLACK_MOVE_2 = renderMoveToken({
  from: { column: "L", row: 1 },
  to: { column: "L", row: 2 },
  fromRemoved: false,
  toRemoved: false,
});

function header(extraLines: readonly string[] = []): string {
  return ['[Ruleset "PRIMARY:1.1"]', ...extraLines].join("\n");
}

function fullRounds(): string {
  return [
    `1. ${WHITE_MOVE_1} ${BLACK_MOVE_1}`,
    `2. ${WHITE_MOVE_2} ${BLACK_MOVE_2}`,
  ].join("\n");
}

function parsed(result: RecordFileResult): ParsedRecord {
  expect(result.kind).toBe("parsed");
  return (result as { kind: "parsed"; record: ParsedRecord }).record;
}

describe("parseRecordFile - a full valid record", () => {
  it("parses tags, the starting board, and the ordered moves", () => {
    const text = [
      header(['[Result "1-0"]', '[ResultReason "Flag Captured"]']),
      POSITION_BLOCK,
      fullRounds(),
    ].join("\n\n");

    const record = parsed(parseRecordFile(text));
    expect(record.tags).toEqual({
      ruleset: "PRIMARY:1.1",
      result: "1-0",
      resultReason: "Flag Captured",
    });
    expect(record.startingBoard).toEqual(GAME_STATE.board);
    expect(record.moves).toHaveLength(4);
    expect(record.moves[0]).toMatchObject({
      ply: 1,
      round: 1,
      side: "white",
      token: WHITE_MOVE_1,
    });
    expect(record.moves[1]).toMatchObject({
      ply: 2,
      round: 1,
      side: "black",
      token: BLACK_MOVE_1,
    });
    expect(record.moves[2]).toMatchObject({
      ply: 3,
      round: 2,
      side: "white",
      token: WHITE_MOVE_2,
    });
    expect(record.moves[3]).toMatchObject({
      ply: 4,
      round: 2,
      side: "black",
      token: BLACK_MOVE_2,
    });
  });

  it("tolerates CRLF line endings", () => {
    const text = [header(), POSITION_BLOCK, fullRounds()]
      .join("\n\n")
      .replaceAll("\n", "\r\n");

    const record = parsed(parseRecordFile(text));
    expect(record.startingBoard).toEqual(GAME_STATE.board);
    expect(record.moves).toHaveLength(4);
  });

  it("tolerates extra blank lines between sections", () => {
    const text = [header(), POSITION_BLOCK, fullRounds()].join("\n\n\n\n");

    const record = parsed(parseRecordFile(text));
    expect(record.moves).toHaveLength(4);
  });

  it("ignores roster and unknown header tags", () => {
    const text = [
      header([
        '[Event "Friendly game"]',
        '[Site "Somewhere"]',
        '[Date "2026.07.13"]',
        '[Round "1"]',
        '[White "Alice"]',
        '[Black "Bob"]',
        '[SomeUnknownTag "whatever"]',
      ]),
      POSITION_BLOCK,
      fullRounds(),
    ].join("\n\n");

    const record = parsed(parseRecordFile(text));
    expect(record.tags).toEqual({ ruleset: "PRIMARY:1.1" });
  });

  it("accepts a freely wrapped move sequence", () => {
    const wrapped = [
      "1.",
      WHITE_MOVE_1,
      BLACK_MOVE_1,
      `2. ${WHITE_MOVE_2}`,
      BLACK_MOVE_2,
    ].join("\n");
    const text = [header(), POSITION_BLOCK, wrapped].join("\n\n");

    const record = parsed(parseRecordFile(text));
    expect(record.moves.map((move) => move.token)).toEqual([
      WHITE_MOVE_1,
      BLACK_MOVE_1,
      WHITE_MOVE_2,
      BLACK_MOVE_2,
    ]);
  });

  it("accepts a zero-move record (no move-sequence section at all)", () => {
    const text = [header(), POSITION_BLOCK].join("\n\n");

    const record = parsed(parseRecordFile(text));
    expect(record.moves).toEqual([]);
    expect(record.startingBoard).toEqual(GAME_STATE.board);
  });

  it("accepts a game that ended on White's move (trailing round with one move)", () => {
    const text = [header(), POSITION_BLOCK, `1. ${WHITE_MOVE_1}`].join("\n\n");

    const record = parsed(parseRecordFile(text));
    expect(record.moves).toHaveLength(1);
    expect(record.moves[0]).toMatchObject({
      ply: 1,
      round: 1,
      side: "white",
    });
  });
});

describe("parseRecordFile - header rejections", () => {
  it("rejects a record with no Ruleset tag", () => {
    const text = [
      '[Event "no ruleset here"]',
      POSITION_BLOCK,
      fullRounds(),
    ].join("\n\n");

    expect(parseRecordFile(text)).toEqual({
      kind: "error",
      error: { kind: "missingRuleset" },
    });
  });

  it("rejects a duplicate Ruleset tag", () => {
    const text = [
      header(['[Ruleset "PRIMARY:1.1"]']),
      POSITION_BLOCK,
      fullRounds(),
    ].join("\n\n");

    expect(parseRecordFile(text)).toEqual({
      kind: "error",
      error: { kind: "duplicateTag", tag: "Ruleset" },
    });
  });

  it("rejects a duplicate Result tag", () => {
    const text = [
      header(['[Result "1-0"]', '[Result "0-1"]']),
      POSITION_BLOCK,
      fullRounds(),
    ].join("\n\n");

    expect(parseRecordFile(text)).toEqual({
      kind: "error",
      error: { kind: "duplicateTag", tag: "Result" },
    });
  });

  it("rejects a duplicate ResultReason tag", () => {
    const text = [
      header([
        '[ResultReason "Flag Captured"]',
        '[ResultReason "No Progress"]',
      ]),
      POSITION_BLOCK,
      fullRounds(),
    ].join("\n\n");

    expect(parseRecordFile(text)).toEqual({
      kind: "error",
      error: { kind: "duplicateTag", tag: "ResultReason" },
    });
  });
});

describe("parseRecordFile - move-sequence rejections", () => {
  it("rejects a plain-notation file", () => {
    const rounds = `1. A1A2 ${BLACK_MOVE_1}`;
    const text = [header(), POSITION_BLOCK, rounds].join("\n\n");

    expect(parseRecordFile(text)).toEqual({
      kind: "error",
      error: {
        kind: "plainNotation",
        ply: 1,
        round: 1,
        side: "white",
        token: "A1A2",
      },
    });
  });

  it("rejects a file mixing plain and extended notation", () => {
    const rounds = `1. ${WHITE_MOVE_1} F12F11`;
    const text = [header(), POSITION_BLOCK, rounds].join("\n\n");

    expect(parseRecordFile(text)).toEqual({
      kind: "error",
      error: {
        kind: "plainNotation",
        ply: 2,
        round: 1,
        side: "black",
        token: "F12F11",
      },
    });
  });

  it("rejects an N... mid-game marker", () => {
    const rounds = `1... ${BLACK_MOVE_1}`;
    const text = [header(), POSITION_BLOCK, rounds].join("\n\n");

    expect(parseRecordFile(text)).toEqual({
      kind: "error",
      error: { kind: "midGameRecord", round: 1 },
    });
  });

  it("rejects a skipped round number", () => {
    const rounds = `2. ${WHITE_MOVE_1} ${BLACK_MOVE_1}`;
    const text = [header(), POSITION_BLOCK, rounds].join("\n\n");

    expect(parseRecordFile(text)).toEqual({
      kind: "error",
      error: { kind: "roundOutOfOrder", expected: 1, found: 2 },
    });
  });

  it("rejects an out-of-order round number", () => {
    const rounds = [
      `1. ${WHITE_MOVE_1} ${BLACK_MOVE_1}`,
      `3. ${WHITE_MOVE_2} ${BLACK_MOVE_2}`,
    ].join("\n");
    const text = [header(), POSITION_BLOCK, rounds].join("\n\n");

    expect(parseRecordFile(text)).toEqual({
      kind: "error",
      error: { kind: "roundOutOfOrder", expected: 2, found: 3 },
    });
  });

  it("rejects a three-move round", () => {
    const rounds = `1. ${WHITE_MOVE_1} ${BLACK_MOVE_1} ${WHITE_MOVE_2}`;
    const text = [header(), POSITION_BLOCK, rounds].join("\n\n");

    expect(parseRecordFile(text)).toEqual({
      kind: "error",
      error: { kind: "tooManyMovesInRound", round: 1 },
    });
  });
});

describe("parseRecordFile - not a game record at all", () => {
  it("rejects a single blob of arbitrary text with no blank lines", () => {
    const text =
      "This is just some ordinary text file, not a game record, " +
      "with no blank lines anywhere in it at all.";

    expect(parseRecordFile(text)).toEqual({
      kind: "error",
      error: { kind: "notARecord" },
    });
  });

  it("rejects arbitrary text with blank lines but no readable header", () => {
    const text = [
      "This is just some random text.",
      "Not a game record at all.",
      "",
      "More random junk here.",
      "And yet more of it.",
      "",
      "Final junk section, still not a record.",
    ].join("\n");

    expect(parseRecordFile(text)).toEqual({
      kind: "error",
      error: { kind: "notARecord" },
    });
  });
});
