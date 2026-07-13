import { describe, expect, it } from "vitest";
import {
  renderPositionBlock,
  RULESET_TAG,
  type InitialGameState,
} from "./primary/v1_1/gameState.ts";
import { readRecord } from "./readRecord.ts";

const GAME_STATE: InitialGameState = {
  ruleset: RULESET_TAG,
  board: {
    A1: { side: "white", pieceType: "flag" },
  },
};
const POSITION_BLOCK = renderPositionBlock(GAME_STATE);

describe("readRecord - version dispatch", () => {
  it("delegates a PRIMARY:1.1 record to the v1_1 reader", () => {
    const text = ['[Ruleset "PRIMARY:1.1"]', POSITION_BLOCK].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind === "parsed") {
      expect(result.record.tags.ruleset).toBe("PRIMARY:1.1");
      expect(result.record.startingBoard).toEqual(GAME_STATE.board);
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
    const text = ['[Ruleset "PRIMARY:1.1"]', "not a valid position block"].join(
      "\n\n",
    );

    const result = readRecord(text);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error.kind).toBe("recordFile");
    }
  });
});
