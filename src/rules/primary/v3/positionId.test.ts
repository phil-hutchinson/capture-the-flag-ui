import { describe, expect, it } from "vitest";
import type { Square } from "./board.ts";
import {
  decodePositionId,
  encodePositionId,
  isValidPositionId,
  normalizePositionId,
  POSITION_ID_LENGTH,
} from "./positionId.ts";

const A1: Square = { column: "A", row: 1 };
const H1: Square = { column: "H", row: 1 };
const A2: Square = { column: "A", row: 2 };
const D2: Square = { column: "D", row: 2 };

// The worked example from `reference/start-position.md` §5.
const EXAMPLE_CODE = "2542333F54415211";
// The two documented endpoints of the valid range.
const LOWEST_CODE = "1112223F33444555";
const HIGHEST_CODE = "F555444333222111";

describe("positionId (ruleset major 3): encode, decode, validate", () => {
  describe("round-trip", () => {
    it.each([EXAMPLE_CODE, LOWEST_CODE, HIGHEST_CODE])(
      "encoding a decoded code returns the identical string: %s",
      (code) => {
        expect(encodePositionId(decodePositionId(code))).toBe(code);
      },
    );

    it("decodes the worked example onto the correct squares", () => {
      const position = decodePositionId(EXAMPLE_CODE);
      expect(position["A1"]).toEqual({
        side: "white",
        kind: "numbered",
        rank: 2,
      });
      expect(position["H1"]).toEqual({ side: "white", kind: "flag" });
      expect(position["A2"]).toEqual({
        side: "white",
        kind: "numbered",
        rank: 5,
      });
      expect(position["D2"]).toEqual({
        side: "white",
        kind: "numbered",
        rank: 1,
      });
      // Sanity check the squares used above are really A1/H1/A2/D2.
      expect([A1, H1, A2, D2]).toEqual([
        { column: "A", row: 1 },
        { column: "H", row: 1 },
        { column: "A", row: 2 },
        { column: "D", row: 2 },
      ]);
    });

    it("encodePositionId reads only White's 16 home squares, in row-1-then-row-2 order", () => {
      const position = decodePositionId(LOWEST_CODE);
      const encoded = encodePositionId(position);
      expect(encoded).toHaveLength(POSITION_ID_LENGTH);
      expect(encoded).toBe(LOWEST_CODE);
    });
  });

  describe("validation rejects", () => {
    it("a 15-character code", () => {
      expect(isValidPositionId("1112223F3344455")).toBe(false);
    });

    it("a 17-character code", () => {
      expect(isValidPositionId("1112223F334445555")).toBe(false);
    });

    it("a code with two Fs", () => {
      expect(isValidPositionId("1112223F3344455F")).toBe(false);
    });

    it("a code with no F", () => {
      expect(isValidPositionId("1112223133444555")).toBe(false);
    });

    it("a code whose F is in the last eight characters", () => {
      expect(isValidPositionId("11122233F3444555")).toBe(false);
    });

    it("a code with four of one rank and two of another", () => {
      expect(isValidPositionId("111122F333444555")).toBe(false);
    });

    it("a code containing a reserved digit (0)", () => {
      expect(isValidPositionId("0112223F33444555")).toBe(false);
    });

    it("a code containing a reserved digit (6-E range)", () => {
      expect(isValidPositionId("6112223F33444555")).toBe(false);
      expect(isValidPositionId("C112223F33444555")).toBe(false);
    });
  });

  describe("validation accepts", () => {
    it.each([EXAMPLE_CODE, LOWEST_CODE, HIGHEST_CODE])(
      "a well-formed position code: %s",
      (code) => {
        expect(isValidPositionId(code)).toBe(true);
      },
    );
  });

  describe("case normalisation happens on input", () => {
    const lowercase = EXAMPLE_CODE.toLowerCase();

    it("normalises a lowercase code to its uppercase form", () => {
      expect(normalizePositionId(lowercase)).toBe(EXAMPLE_CODE);
      expect(normalizePositionId(lowercase) === EXAMPLE_CODE).toBe(true);
    });

    it("validates a lowercase code that would be valid upper-cased", () => {
      expect(isValidPositionId(lowercase)).toBe(true);
    });

    it("decodes a lowercase code identically to its uppercase form", () => {
      expect(decodePositionId(lowercase)).toEqual(
        decodePositionId(EXAMPLE_CODE),
      );
    });
  });

  it("decodePositionId throws on a code of the wrong length", () => {
    expect(() => decodePositionId("1112223F3344455")).toThrow();
    expect(() => decodePositionId("1112223F334445555")).toThrow();
  });

  it("decodePositionId throws on a reserved or otherwise unrecognised digit", () => {
    expect(() => decodePositionId("6112223F33444555")).toThrow();
    expect(() => decodePositionId("Z112223F33444555")).toThrow();
  });

  it('decodePositionId treats "0" as an empty square rather than throwing', () => {
    const position = decodePositionId("0112223F33444555");
    expect(position["A1"]).toBeUndefined();
  });
});
