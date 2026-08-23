import { describe, expect, it } from "vitest";
import type { Square } from "./board.ts";
import {
  demotePiece,
  EMPTY_POSITION,
  findFlag,
  numberedPieceCount,
  pieceAt,
  piecesOf,
  placePiece,
  reduceRank,
  relocatePiece,
  removePiece,
  type FlagPiece,
  type NumberedPiece,
  type PositionState,
} from "./position.ts";

const A1: Square = { column: "A", row: 1 };
const A2: Square = { column: "A", row: 2 };
const B1: Square = { column: "B", row: 1 };

const whiteRank5: NumberedPiece = { side: "white", kind: "numbered", rank: 5 };
const whiteRank1: NumberedPiece = { side: "white", kind: "numbered", rank: 1 };
const blackRank3: NumberedPiece = { side: "black", kind: "numbered", rank: 3 };
const whiteFlag: FlagPiece = { side: "white", kind: "flag" };

describe("position (ruleset major 3): rank as mutable game state", () => {
  it("round-trips placing and reading a piece", () => {
    const position = placePiece(EMPTY_POSITION, A1, whiteRank5);
    expect(pieceAt(position, A1)).toEqual(whiteRank5);
    expect(pieceAt(position, A2)).toBeUndefined();
  });

  it("round-trips removing a piece, and is a no-op removing an empty square", () => {
    const position = placePiece(EMPTY_POSITION, A1, whiteRank5);
    const removed = removePiece(position, A1);
    expect(pieceAt(removed, A1)).toBeUndefined();

    const stillEmpty = removePiece(EMPTY_POSITION, A1);
    expect(stillEmpty).toBe(EMPTY_POSITION);
  });

  it("round-trips relocating a piece, and throws relocating from an empty square", () => {
    const position = placePiece(EMPTY_POSITION, A1, whiteRank5);
    const relocated = relocatePiece(position, A1, B1);
    expect(pieceAt(relocated, A1)).toBeUndefined();
    expect(pieceAt(relocated, B1)).toEqual(whiteRank5);

    expect(() => relocatePiece(EMPTY_POSITION, A1, B1)).toThrow();
  });

  it("relocating onto an occupied square replaces what stood there", () => {
    let position = placePiece(EMPTY_POSITION, A1, whiteRank5);
    position = placePiece(position, B1, blackRank3);
    const relocated = relocatePiece(position, A1, B1);
    expect(pieceAt(relocated, A1)).toBeUndefined();
    expect(pieceAt(relocated, B1)).toEqual(whiteRank5);
  });

  it("lists a side's pieces, paired with their squares", () => {
    let position = placePiece(EMPTY_POSITION, A1, whiteRank5);
    position = placePiece(position, A2, whiteFlag);
    position = placePiece(position, B1, blackRank3);

    const whitePieces = piecesOf(position, "white");
    expect(whitePieces).toHaveLength(2);
    expect(whitePieces).toEqual(
      expect.arrayContaining([
        { square: A1, piece: whiteRank5 },
        { square: A2, piece: whiteFlag },
      ]),
    );

    const blackPieces = piecesOf(position, "black");
    expect(blackPieces).toEqual([{ square: B1, piece: blackRank3 }]);
  });

  it("counts a side's numbered pieces, excluding its Flag, reaching zero when only the Flag remains", () => {
    let position = placePiece(EMPTY_POSITION, A1, whiteRank5);
    position = placePiece(position, A2, whiteFlag);
    expect(numberedPieceCount(position, "white")).toBe(1);

    position = removePiece(position, A1);
    expect(numberedPieceCount(position, "white")).toBe(0);
  });

  it("finds a side's Flag, and reports it captured (undefined) once removed", () => {
    let position = placePiece(EMPTY_POSITION, A2, whiteFlag);
    expect(findFlag(position, "white")).toEqual(A2);
    expect(findFlag(position, "black")).toBeUndefined();

    position = removePiece(position, A2);
    expect(findFlag(position, "white")).toBeUndefined();
  });

  it("reduceRank steps down by one and clamps at rank 1", () => {
    expect(reduceRank(5)).toBe(4);
    expect(reduceRank(4)).toBe(3);
    expect(reduceRank(3)).toBe(2);
    expect(reduceRank(2)).toBe(1);
    expect(reduceRank(1)).toBe(1);
  });

  it("demotes a rank 5 to a rank 4", () => {
    const position = placePiece(EMPTY_POSITION, A1, whiteRank5);
    const demoted = demotePiece(position, A1);
    expect(pieceAt(demoted, A1)).toEqual({
      side: "white",
      kind: "numbered",
      rank: 4,
    });
  });

  it("demotes a rank 1 to a rank 1 - never below", () => {
    const position = placePiece(EMPTY_POSITION, A1, whiteRank1);
    const demoted = demotePiece(position, A1);
    expect(pieceAt(demoted, A1)).toEqual(whiteRank1);
  });

  it("demoting leaves every other square untouched", () => {
    let position = placePiece(EMPTY_POSITION, A1, whiteRank5);
    position = placePiece(position, B1, blackRank3);
    position = placePiece(position, A2, whiteFlag);

    const demoted = demotePiece(position, A1);
    expect(pieceAt(demoted, B1)).toEqual(blackRank3);
    expect(pieceAt(demoted, A2)).toEqual(whiteFlag);
  });

  it("throws demoting an empty square or the Flag", () => {
    const position = placePiece(EMPTY_POSITION, A2, whiteFlag);
    expect(() => demotePiece(position, A1)).toThrow();
    expect(() => demotePiece(position, A2)).toThrow();
  });

  it("survives JSON.parse(JSON.stringify(...)) unchanged", () => {
    let position: PositionState = placePiece(EMPTY_POSITION, A1, whiteRank5);
    position = placePiece(position, A2, whiteFlag);
    position = placePiece(position, B1, blackRank3);

    const roundTripped = JSON.parse(JSON.stringify(position)) as PositionState;
    expect(roundTripped).toEqual(position);
  });
});
