import { describe, expect, it } from "vitest";
import {
  firstFocusablePosition,
  nextFocusPosition,
  type ArrowKey,
} from "./gridNavigation.ts";

/** A 4x4 grid where every cell is focusable, for the basic-movement cases. */
const allFocusable = () => true;

describe("nextFocusPosition (all cells focusable)", () => {
  const base = { rowCount: 4, columnCount: 4, current: { row: 1, column: 1 } };

  it("ArrowUp moves focus one row up", () => {
    expect(
      nextFocusPosition({ ...base, key: "ArrowUp", isFocusable: allFocusable }),
    ).toEqual({ row: 0, column: 1 });
  });

  it("ArrowDown moves focus one row down", () => {
    expect(
      nextFocusPosition({
        ...base,
        key: "ArrowDown",
        isFocusable: allFocusable,
      }),
    ).toEqual({ row: 2, column: 1 });
  });

  it("ArrowLeft moves focus one column left", () => {
    expect(
      nextFocusPosition({
        ...base,
        key: "ArrowLeft",
        isFocusable: allFocusable,
      }),
    ).toEqual({ row: 1, column: 0 });
  });

  it("ArrowRight moves focus one column right", () => {
    expect(
      nextFocusPosition({
        ...base,
        key: "ArrowRight",
        isFocusable: allFocusable,
      }),
    ).toEqual({ row: 1, column: 2 });
  });
});

describe("nextFocusPosition (edge clamping, no wraparound)", () => {
  const rowCount = 4;
  const columnCount = 4;

  it("clamps ArrowUp at the top row", () => {
    const current = { row: 0, column: 2 };
    expect(
      nextFocusPosition({
        rowCount,
        columnCount,
        current,
        key: "ArrowUp",
        isFocusable: allFocusable,
      }),
    ).toEqual(current);
  });

  it("clamps ArrowDown at the bottom row", () => {
    const current = { row: 3, column: 2 };
    expect(
      nextFocusPosition({
        rowCount,
        columnCount,
        current,
        key: "ArrowDown",
        isFocusable: allFocusable,
      }),
    ).toEqual(current);
  });

  it("clamps ArrowLeft at the leftmost column", () => {
    const current = { row: 2, column: 0 };
    expect(
      nextFocusPosition({
        rowCount,
        columnCount,
        current,
        key: "ArrowLeft",
        isFocusable: allFocusable,
      }),
    ).toEqual(current);
  });

  it("clamps ArrowRight at the rightmost column", () => {
    const current = { row: 2, column: 3 };
    expect(
      nextFocusPosition({
        rowCount,
        columnCount,
        current,
        key: "ArrowRight",
        isFocusable: allFocusable,
      }),
    ).toEqual(current);
  });

  it("clamps at every corner for both keys that would leave the grid", () => {
    const corners: readonly [GridCorner, readonly ArrowKey[]][] = [
      [{ row: 0, column: 0 }, ["ArrowUp", "ArrowLeft"]],
      [{ row: 0, column: 3 }, ["ArrowUp", "ArrowRight"]],
      [{ row: 3, column: 0 }, ["ArrowDown", "ArrowLeft"]],
      [{ row: 3, column: 3 }, ["ArrowDown", "ArrowRight"]],
    ];
    for (const [current, keys] of corners) {
      for (const key of keys) {
        expect(
          nextFocusPosition({
            rowCount,
            columnCount,
            current,
            key,
            isFocusable: allFocusable,
          }),
        ).toEqual(current);
      }
    }
  });
});

type GridCorner = { readonly row: number; readonly column: number };

describe("nextFocusPosition (focusable mask - skip policy)", () => {
  // 1x5 row: columns 0..4. Column 2 is not focusable (e.g. a lake), so
  // moving right from column 1 should skip over it and land on column 3.
  const notFocusableAt =
    (skip: number) =>
    (position: { readonly row: number; readonly column: number }) =>
      position.column !== skip;

  it("skips a single non-focusable cell in the path", () => {
    expect(
      nextFocusPosition({
        rowCount: 1,
        columnCount: 5,
        current: { row: 0, column: 1 },
        key: "ArrowRight",
        isFocusable: notFocusableAt(2),
      }),
    ).toEqual({ row: 0, column: 3 });
  });

  it("skips a run of consecutive non-focusable cells", () => {
    const isFocusable = (position: { readonly column: number }) =>
      position.column !== 1 && position.column !== 2 && position.column !== 3;
    expect(
      nextFocusPosition({
        rowCount: 1,
        columnCount: 5,
        current: { row: 0, column: 0 },
        key: "ArrowRight",
        isFocusable,
      }),
    ).toEqual({ row: 0, column: 4 });
  });

  it("does not move when every remaining cell in the direction is non-focusable", () => {
    const current = { row: 0, column: 1 };
    const isFocusable = (position: { readonly column: number }) =>
      position.column <= 1;
    expect(
      nextFocusPosition({
        rowCount: 1,
        columnCount: 5,
        current,
        key: "ArrowRight",
        isFocusable,
      }),
    ).toEqual(current);
  });

  it("never returns a non-focusable position", () => {
    const isFocusable = (position: { readonly column: number }) =>
      position.column % 2 === 0;
    // From column 0 (focusable), moving right should land on column 2, not
    // the intervening non-focusable column 1.
    const result = nextFocusPosition({
      rowCount: 1,
      columnCount: 5,
      current: { row: 0, column: 0 },
      key: "ArrowRight",
      isFocusable,
    });
    expect(isFocusable(result)).toBe(true);
    expect(result).toEqual({ row: 0, column: 2 });
  });
});

describe("firstFocusablePosition", () => {
  it("finds the first focusable cell in row-major order", () => {
    const isFocusable = (position: {
      readonly row: number;
      readonly column: number;
    }) => position.row === 1 && position.column === 2;
    expect(firstFocusablePosition(4, 4, isFocusable)).toEqual({
      row: 1,
      column: 2,
    });
  });

  it("returns the top-left cell when everything is focusable", () => {
    expect(firstFocusablePosition(3, 3, allFocusable)).toEqual({
      row: 0,
      column: 0,
    });
  });

  it("returns undefined when nothing is focusable", () => {
    expect(firstFocusablePosition(3, 3, () => false)).toBeUndefined();
  });
});
