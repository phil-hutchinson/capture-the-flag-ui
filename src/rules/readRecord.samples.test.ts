// A corpus test over the committed sample record files
// (doc/plan/00000014-game-reviewer/samples/), which the story's manual
// verification gates (B and C) also use directly. The good sample is a
// complete, engine-played game containing every event Gate B asks for (a
// capture, a complete sacrifice, a mutual loss, a Sapper destroying a Tower,
// and a Flag capture); the bad samples are hand-derived from it, one per
// Gate C case that needs a fixture (a photo needs none - any arbitrary file
// will do for that case).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readRecord } from "./readRecord.ts";

const SAMPLES_DIR = fileURLToPath(
  new URL("../../doc/plan/00000014-game-reviewer/samples/", import.meta.url),
);

function readSample(name: string): string {
  return readFileSync(SAMPLES_DIR + name, "utf8");
}

describe("story 00000014 sample record files", () => {
  it("accepts the good sample and replays it to a Flag capture", () => {
    const result = readRecord(readSample("good-game.txt"));

    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    const { record } = result;

    // A random legal game from two full 48-piece armies, played until Black
    // captured White's Flag: 100 plies (50 rounds) -> 101 positions.
    expect(record.moves).toHaveLength(100);
    expect(record.positions).toHaveLength(101);

    const finalPosition = record.positions[record.positions.length - 1];
    const whiteFlagRemains = Object.values(finalPosition).some(
      (placed) => placed.side === "white" && placed.pieceType === "flag",
    );
    expect(whiteFlagRemains).toBe(false);
    const blackFlagRemains = Object.values(finalPosition).some(
      (placed) => placed.side === "black" && placed.pieceType === "flag",
    );
    expect(blackFlagRemains).toBe(true);

    expect(record.tags.result).toBe("0-1");
    expect(record.tags.resultReason).toBe("Flag Captured");
  });

  it("rejects the plain-notation sample", () => {
    const result = readRecord(readSample("plain-notation.txt"));

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error.kind).toBe("recordFile");
      if (result.error.kind === "recordFile") {
        expect(result.error.error.kind).toBe("plainNotation");
      }
    }
  });

  it("rejects the unknown-ruleset sample", () => {
    const result = readRecord(readSample("unknown-ruleset.txt"));

    expect(result).toEqual({
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: "PRIMARY:9.9" },
    });
  });

  it("rejects the empty-square-move sample", () => {
    const result = readRecord(readSample("empty-square-move.txt"));

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error.kind).toBe("replay");
      if (result.error.kind === "replay") {
        expect(result.error.error.kind).toBe("emptySource");
      }
    }
  });

  it("rejects the phantom-capture sample", () => {
    const result = readRecord(readSample("phantom-capture.txt"));

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error.kind).toBe("replay");
      if (result.error.kind === "replay") {
        expect(result.error.error.kind).toBe("phantomCapture");
      }
    }
  });
});
