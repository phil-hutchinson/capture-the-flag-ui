import { describe, expect, it } from "vitest";
import type { Square } from "../../rules/primary/v1/board.ts";
import {
  flatIndex,
  PIECE_PLANE_INDEX,
  PLANE_PIECE_ORDER,
  TENSOR_SIZE,
  toMoverFrame,
} from "./shared.ts";

describe("toMoverFrame", () => {
  it("maps White's frame directly: row - 1, column index", () => {
    const square: Square = { column: "C", row: 2 };
    expect(toMoverFrame(square, "white")).toEqual({ row: 1, col: 2 });
  });

  it("maps White's own back rank to tensor row 0", () => {
    const square: Square = { column: "A", row: 1 };
    expect(toMoverFrame(square, "white")).toEqual({ row: 0, col: 0 });
  });

  it("rotates 180 degrees for Black: 12 - row, 11 - column index", () => {
    const square: Square = { column: "C", row: 2 };
    expect(toMoverFrame(square, "black")).toEqual({ row: 10, col: 9 });
  });

  it("maps Black's own back rank to tensor row 0", () => {
    const square: Square = { column: "L", row: 12 };
    expect(toMoverFrame(square, "black")).toEqual({ row: 0, col: 0 });
  });
});

describe("flatIndex", () => {
  it("is row-major (plane, row, col)", () => {
    expect(flatIndex(0, 0, 0)).toBe(0);
    expect(flatIndex(0, 0, 1)).toBe(1);
    expect(flatIndex(0, 1, 0)).toBe(TENSOR_SIZE);
    expect(flatIndex(1, 0, 0)).toBe(TENSOR_SIZE * TENSOR_SIZE);
  });
});

describe("PLANE_PIECE_ORDER / PIECE_PLANE_INDEX", () => {
  it("orders Flag, Tower, Master-of-Arms, Champion, Knight, Halberdier, Foot Soldier, Militia", () => {
    expect(PLANE_PIECE_ORDER).toEqual([
      "flag",
      "tower",
      "masterOfArms",
      "champion",
      "knight",
      "halberdier",
      "footSoldier",
      "militia",
    ]);
  });

  it("indexes every piece type to a distinct plane 0-7", () => {
    const indices = PLANE_PIECE_ORDER.map((id) => PIECE_PLANE_INDEX[id]);
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});
