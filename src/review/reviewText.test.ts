import { describe, expect, it } from "vitest";
import type { PositionBlockError } from "../rules/primary/v1_1/gameState.ts";
import type { RecordFileError } from "../rules/primary/v1_1/recordFile.ts";
import type { ReplayError } from "../rules/primary/v1_1/replay.ts";
import type { ReadRecordError } from "../rules/readRecord.ts";
import {
  describePosition,
  describeRecordedResult,
  describeRejection,
} from "./reviewText.ts";

/** Every case fed to `describeRejection` below, grouped by which layer produced it. */
const POSITION_BLOCK_ERRORS: readonly PositionBlockError[] = [
  { kind: "wrongRowCount", rowCount: 11 },
  { kind: "wrongCellCount", row: 5, cellCount: 11 },
  {
    kind: "unrecognizedCell",
    square: { column: "F", row: 5 },
    cell: "???",
  },
  {
    kind: "unknownPieceSymbol",
    square: { column: "F", row: 5 },
    symbol: "Z",
  },
  { kind: "lakeCellOffLake", square: { column: "F", row: 5 } },
  {
    kind: "lakeSquareNotXxx",
    square: { column: "F", row: 6 },
    cell: "---",
  },
];

const RECORD_FILE_ERRORS: readonly RecordFileError[] = [
  { kind: "notARecord" },
  { kind: "missingRuleset" },
  { kind: "duplicateTag", tag: "Ruleset" },
  ...POSITION_BLOCK_ERRORS.map((error): RecordFileError => ({
    kind: "positionBlock",
    error,
  })),
  { kind: "midGameRecord", round: 6 },
  { kind: "malformedRound", token: "banana" },
  { kind: "roundOutOfOrder", expected: 3, found: 5 },
  { kind: "emptyRound", round: 4 },
  { kind: "tooManyMovesInRound", round: 4 },
  {
    kind: "plainNotation",
    ply: 12,
    round: 6,
    side: "black",
    token: "F5F6",
  },
  {
    kind: "malformedMove",
    ply: 3,
    round: 2,
    side: "white",
    token: "??",
  },
];

const REPLAY_ERRORS: readonly ReplayError[] = [
  {
    kind: "emptySource",
    ply: 12,
    round: 6,
    side: "black",
    token: "F5-F6",
    square: { column: "F", row: 5 },
  },
  {
    kind: "wrongSide",
    ply: 1,
    round: 1,
    side: "white",
    token: "A5-A6",
    square: { column: "A", row: 5 },
  },
  {
    kind: "unmarkedCapture",
    ply: 4,
    round: 2,
    side: "black",
    token: "B5-B6",
    square: { column: "B", row: 6 },
  },
  {
    kind: "phantomCapture",
    ply: 7,
    round: 4,
    side: "white",
    token: "C5-C6x",
    square: { column: "C", row: 6 },
  },
  {
    kind: "phantomSacrifice",
    ply: 8,
    round: 4,
    side: "black",
    token: "D5x-D6",
    square: { column: "D", row: 5 },
  },
];

const READ_RECORD_ERRORS: readonly ReadRecordError[] = [
  { kind: "notARecord" },
  { kind: "unknownRuleset", ruleset: "PRIMARY:2.0" },
  ...RECORD_FILE_ERRORS.map((error): ReadRecordError => ({
    kind: "recordFile",
    error,
  })),
  ...REPLAY_ERRORS.map((error): ReadRecordError => ({ kind: "replay", error })),
];

describe("describeRejection", () => {
  it("produces a non-empty sentence for every error kind, never mentioning ply/White/Black", () => {
    for (const error of READ_RECORD_ERRORS) {
      const message = describeRejection(error);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/\bply\b/i);
      expect(message).not.toMatch(/\bWhite\b/);
      expect(message).not.toMatch(/\bBlack\b/);
    }
  });

  it("names the file isn't a game record either at the top level or nested", () => {
    expect(describeRejection({ kind: "notARecord" })).toBe(
      "This file isn't a game record.",
    );
    expect(
      describeRejection({
        kind: "recordFile",
        error: { kind: "notARecord" },
      }),
    ).toBe("This file isn't a game record.");
  });

  it("names the unrecognized ruleset", () => {
    const message = describeRejection({
      kind: "unknownRuleset",
      ruleset: "PRIMARY:2.0",
    });
    expect(message).toContain("PRIMARY:2.0");
  });

  it("names the move (number, round, color, token) for every move-specific error", () => {
    const moveSpecificRecordFileErrors = [
      {
        kind: "plainNotation" as const,
        ply: 12,
        round: 6,
        side: "black" as const,
        token: "F5F6",
      },
      {
        kind: "malformedMove" as const,
        ply: 3,
        round: 2,
        side: "white" as const,
        token: "??",
      },
    ];
    for (const error of moveSpecificRecordFileErrors) {
      const message = describeRejection({ kind: "recordFile", error });
      expect(message).toContain(`Move ${error.ply}`);
      expect(message).toContain(`round ${error.round}`);
      expect(message).toContain(error.side === "white" ? "red" : "blue");
      expect(message).toContain(error.token);
    }

    for (const error of REPLAY_ERRORS) {
      const message = describeRejection({ kind: "replay", error });
      expect(message).toContain(`Move ${error.ply}`);
      expect(message).toContain(`round ${error.round}`);
      expect(message).toContain(error.side === "white" ? "red" : "blue");
      expect(message).toContain(error.token);
    }
  });

  it("says plain notation doesn't record what happened to each piece", () => {
    const message = describeRejection({
      kind: "recordFile",
      error: {
        kind: "plainNotation",
        ply: 12,
        round: 6,
        side: "black",
        token: "F5F6",
      },
    });
    expect(message).toBe(
      "Move 12 (round 6, blue) — F5F6 uses the short move notation, which doesn't record what happened to each piece, so it can't be reviewed.",
    );
  });

  it("says an empty-square move starts from an empty square", () => {
    const message = describeRejection({
      kind: "replay",
      error: {
        kind: "emptySource",
        ply: 12,
        round: 6,
        side: "black",
        token: "F5-F6",
        square: { column: "F", row: 5 },
      },
    });
    expect(message).toBe(
      "Move 12 (round 6, blue) — F5-F6 starts from an empty square.",
    );
  });

  it("names the offending square and symbol for an unknown piece symbol", () => {
    const message = describeRejection({
      kind: "recordFile",
      error: {
        kind: "positionBlock",
        error: {
          kind: "unknownPieceSymbol",
          square: { column: "F", row: 5 },
          symbol: "Z",
        },
      },
    });
    expect(message).toContain("F5");
    expect(message).toContain("Z");
  });
});

describe("describeRecordedResult", () => {
  it("maps 1-0 with a recognized reason to describeResult's red-wins wording, framed as the record's claim", () => {
    const message = describeRecordedResult({
      result: "1-0",
      resultReason: "Flag Captured",
    });
    expect(message).toBe("The record says: Red wins — Flag captured.");
  });

  it("maps 0-1 with a recognized reason to describeResult's blue-wins wording", () => {
    const message = describeRecordedResult({
      result: "0-1",
      resultReason: "No Legal Move",
    });
    expect(message).toBe(
      "The record says: Blue wins — Red has no legal move left.",
    );
  });

  it("matches ResultReason case-insensitively", () => {
    const message = describeRecordedResult({
      result: "1-0",
      resultReason: "flag captured",
    });
    expect(message).toBe("The record says: Red wins — Flag captured.");
  });

  it("recognizes this app's own Agreement reason", () => {
    const message = describeRecordedResult({
      result: "1/2-1/2",
      resultReason: "Agreement",
    });
    expect(message).toBe("The record says: The game is a draw — Agreement.");
  });

  it("maps 1/2-1/2 with a recognized reason to describeResult's draw wording", () => {
    const message = describeRecordedResult({
      result: "1/2-1/2",
      resultReason: "No Progress",
    });
    expect(message).toBe("The record says: The game is a draw — No progress.");
  });

  it("quotes an unrecognized reason verbatim instead of dropping it", () => {
    const message = describeRecordedResult({
      result: "1-0",
      resultReason: "Something the reference engine doesn't say",
    });
    expect(message).toBe(
      'The record says: Red wins — "Something the reference engine doesn\'t say".',
    );
  });

  it("quotes an unrecognized reason verbatim for a draw too", () => {
    const message = describeRecordedResult({
      result: "1/2-1/2",
      resultReason: "Something else",
    });
    expect(message).toBe(
      'The record says: The game is a draw — "Something else".',
    );
  });

  it("handles a Result with no reason at all", () => {
    expect(describeRecordedResult({ result: "0-1" })).toBe(
      "The record says: Blue wins.",
    );
    expect(describeRecordedResult({ result: "1/2-1/2" })).toBe(
      "The record says: The game is a draw.",
    );
  });

  it("yields no result sentence when Result is absent", () => {
    expect(describeRecordedResult({})).toBeNull();
  });

  it("yields no result sentence when Result is * (ongoing/unknown)", () => {
    expect(describeRecordedResult({ result: "*" })).toBeNull();
    expect(
      describeRecordedResult({ result: "*", resultReason: "No Progress" }),
    ).toBeNull();
  });

  it("never mentions ply, White or Black", () => {
    const samples = [
      describeRecordedResult({ result: "1-0", resultReason: "Flag Captured" }),
      describeRecordedResult({ result: "0-1" }),
      describeRecordedResult({
        result: "1/2-1/2",
        resultReason: "unrecognized",
      }),
    ];
    for (const message of samples) {
      expect(message).not.toBeNull();
      expect(message).not.toMatch(/\bply\b/i);
      expect(message).not.toMatch(/\bWhite\b/);
      expect(message).not.toMatch(/\bBlack\b/);
    }
  });
});

describe("describePosition", () => {
  it("describes the opening position", () => {
    expect(describePosition({ totalMoves: 57, move: null })).toBe(
      "Opening position",
    );
  });

  it("names the move, its place among the total, its round and its color", () => {
    expect(
      describePosition({
        totalMoves: 57,
        move: { ply: 23, round: 12, side: "white" },
      }),
    ).toBe("Move 23 of 57 — round 12, red");
  });

  it("names the black side as blue, lower-cased", () => {
    expect(
      describePosition({
        totalMoves: 3,
        move: { ply: 2, round: 1, side: "black" },
      }),
    ).toBe("Move 2 of 3 — round 1, blue");
  });
});
