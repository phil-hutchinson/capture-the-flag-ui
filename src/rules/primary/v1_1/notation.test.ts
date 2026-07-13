import { describe, expect, it } from "vitest";
import {
  parseMoveToken,
  renderMoveToken,
  type RecordedMove,
} from "./notation.ts";

describe("parseMoveToken - the four extended shapes", () => {
  it("parses a quiet move (S-D)", () => {
    const result = parseMoveToken("A4-A5");
    expect(result).toEqual({
      kind: "parsed",
      move: {
        from: { column: "A", row: 4 },
        to: { column: "A", row: 5 },
        fromRemoved: false,
        toRemoved: false,
      },
    });
  });

  it("parses an attacker-wins move (S-Dx)", () => {
    const result = parseMoveToken("A4-A5x");
    expect(result).toEqual({
      kind: "parsed",
      move: {
        from: { column: "A", row: 4 },
        to: { column: "A", row: 5 },
        fromRemoved: false,
        toRemoved: true,
      },
    });
  });

  it("parses a complete-sacrifice move (Sx-D)", () => {
    const result = parseMoveToken("A4x-A5");
    expect(result).toEqual({
      kind: "parsed",
      move: {
        from: { column: "A", row: 4 },
        to: { column: "A", row: 5 },
        fromRemoved: true,
        toRemoved: false,
      },
    });
  });

  it("parses a mutual-loss move (Sx-Dx), including a two-digit row", () => {
    const result = parseMoveToken("L12x-L11x");
    expect(result).toEqual({
      kind: "parsed",
      move: {
        from: { column: "L", row: 12 },
        to: { column: "L", row: 11 },
        fromRemoved: true,
        toRemoved: true,
      },
    });
  });
});

describe("parseMoveToken - plain-form rejection", () => {
  it("rejects a plain-form token with the distinct plainNotation kind", () => {
    expect(parseMoveToken("A4A5")).toEqual({
      kind: "plainNotation",
      token: "A4A5",
    });
  });

  it("rejects a plain-form token with a two-digit row", () => {
    expect(parseMoveToken("L12L11")).toEqual({
      kind: "plainNotation",
      token: "L12L11",
    });
  });
});

describe("parseMoveToken - malformed tokens", () => {
  const malformedTokens = [
    "A4-", // missing destination
    "M4-A5", // column M does not exist
    "A13-A5", // row 13 does not exist
    "a4-a5", // lowercase
    "A4--A5", // doubled separator
    "A4x-A5xx", // extra x
    "", // empty string
  ];

  for (const token of malformedTokens) {
    it(`rejects ${JSON.stringify(token)} as malformed`, () => {
      expect(parseMoveToken(token)).toEqual({ kind: "malformed", token });
    });
  }
});

describe("renderMoveToken - round-trip with parseMoveToken", () => {
  const shapes: readonly string[] = ["A4-A5", "A4-A5x", "A4x-A5", "L12x-L11x"];

  for (const token of shapes) {
    it(`round-trips ${token}`, () => {
      const parsed = parseMoveToken(token);
      expect(parsed.kind).toBe("parsed");
      const move = (parsed as { kind: "parsed"; move: RecordedMove }).move;
      expect(renderMoveToken(move)).toBe(token);
    });
  }
});
