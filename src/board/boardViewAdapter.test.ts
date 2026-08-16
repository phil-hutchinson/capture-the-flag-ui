import { describe, expect, it } from "vitest";
import { BATTLE_LAYOUT, isLake, squareKey } from "../rules/primary/v2/board.ts";
import { BOARD_LAYOUTS } from "../rules/primary/v2/boardLayout.ts";
import type { BoardState } from "../rules/primary/v2/gameState.ts";
import { PIECE_CATALOG } from "../rules/primary/v2/pieces.ts";
import { pieceArtForType } from "./pieceArtByType.ts";
import { boardGeometryFor, boardPositionFor } from "./boardViewAdapter.ts";

const SKIRMISH_LAYOUT = BOARD_LAYOUTS.standard_64;

describe("boardGeometryFor", () => {
  it("carries Battle's dimensions", () => {
    const geometry = boardGeometryFor(BATTLE_LAYOUT);
    expect(geometry.columnCount).toBe(12);
    expect(geometry.rowCount).toBe(12);
  });

  it("marks exactly Battle's lake squares as impassable, and nothing else", () => {
    const geometry = boardGeometryFor(BATTLE_LAYOUT);
    for (let row = 1; row <= 12; row++) {
      for (let columnIndex = 0; columnIndex < 12; columnIndex++) {
        const column = String.fromCharCode("A".charCodeAt(0) + columnIndex);
        const square = { column, row };
        const key = squareKey(square);
        expect(geometry.impassableSquares.has(key)).toBe(
          isLake(square, BATTLE_LAYOUT),
        );
      }
    }
  });

  it("carries Skirmish's dimensions and its own (different) lake pattern", () => {
    const geometry = boardGeometryFor(SKIRMISH_LAYOUT);
    expect(geometry.columnCount).toBe(8);
    expect(geometry.rowCount).toBe(8);
    expect(geometry.impassableSquares.has("A4")).toBe(
      isLake({ column: "A", row: 4 }, SKIRMISH_LAYOUT),
    );
  });
});

describe("boardPositionFor", () => {
  it("turns an empty board into an empty position", () => {
    const board: BoardState = {};
    expect(boardPositionFor(board)).toEqual({ tokens: {} });
  });

  it("carries each occupied square's side, art, and display name", () => {
    const board: BoardState = {
      A1: { side: "white", pieceType: "masterOfArms" },
      L12: { side: "black", pieceType: "flag" },
    };
    const position = boardPositionFor(board);
    expect(position.tokens.A1).toEqual({
      side: "white",
      art: pieceArtForType("masterOfArms"),
      label: PIECE_CATALOG.masterOfArms.displayName,
    });
    expect(position.tokens.L12).toEqual({
      side: "black",
      art: pieceArtForType("flag"),
      label: PIECE_CATALOG.flag.displayName,
    });
    expect(Object.keys(position.tokens)).toHaveLength(2);
  });
});
