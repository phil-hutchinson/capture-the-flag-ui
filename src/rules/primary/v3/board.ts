// Board geometry for ruleset major 3 (the proposed pre-release edition - see
// `edition.ts` for its id), written from `reference/rules.md` §2.1 and §4.5
// alone (see this story's implementation plan) - never by copying the
// existing major-2 rule engine.
//
// Major 3's board is fixed: 8x8, every square open. There is no
// `BoardLayout` parameter anywhere in this module and there never will be -
// unlike major 2, this major has no board size or terrain to vary (rules.md
// §1, "One ruleset"). There is also no impassable terrain concept at all: no
// lakes, no lanes, no buffer rows. `Side`, `Square` and `squareKey` look like
// major 2's types of the same name, but are declared fresh here on purpose -
// the version wall means `v3` never imports from `v2` (this plan's "Out of
// bounds for every step").
//
// Coordinate frame per rules.md §4.5: columns lettered A-H left to right,
// rows numbered 1-8, where row 1 is White's back row and row 8 is Black's -
// regardless of which physical side of the board White sits at.
//
// This module is pure geometry - it has no knowledge of pieces, rank, or
// combat - so it has no dependencies elsewhere in this ruleset version.

/** Internal turn-order label for a player. Not player-facing (see side colors in `src/board/`). */
export type Side = "white" | "black";

/** The other side. The one side-flip helper for every module in this ruleset version. */
export function otherSide(side: Side): Side {
  return side === "white" ? "black" : "white";
}

/** A column letter, "A" through "H" - major 3's board is always 8 columns wide. */
export type Column = string;

/** A row number, 1 through 8 - major 3's board is always 8 rows tall. */
export type Row = number;

export interface Square {
  readonly column: Column;
  readonly row: Row;
}

/** The board's fixed width and height (rules.md §2.1). Not configurable at this major. */
export const COLUMN_COUNT = 8;
export const ROW_COUNT = 8;

/** The 0-based index of `column` within A-H ("A" = 0), for adjacency arithmetic. */
export function columnIndexOf(column: Column): number {
  return column.charCodeAt(0) - "A".charCodeAt(0);
}

/** The column letter at 0-based `index` within A-H ("A" is index 0). The inverse of `columnIndexOf`. */
export function columnLetter(index: number): Column {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

/** The board's column letters, left to right: A-H. */
export const COLUMNS: readonly Column[] = Array.from(
  { length: COLUMN_COUNT },
  (_, index) => columnLetter(index),
);

/** The board's row numbers, White's back row first: 1-8. */
export const ROWS: readonly Row[] = Array.from(
  { length: ROW_COUNT },
  (_, index) => index + 1,
);

/** A stable string key for a square, e.g. "A1". Useful as an object key (see `position.ts`). */
export function squareKey(square: Square): string {
  return `${square.column}${square.row}`;
}

/** True if `column` and `row` name a square that exists on this board. */
export function isOnBoard(column: Column, row: Row): boolean {
  const columnIndex = columnIndexOf(column);
  return (
    columnIndex >= 0 &&
    columnIndex < COLUMN_COUNT &&
    row >= 1 &&
    row <= ROW_COUNT
  );
}

/** All 64 of the board's squares, in row-major order (row 1 A-H, then row 2 A-H, ...). */
export function allSquares(): Square[] {
  const squares: Square[] = [];
  for (const row of ROWS) {
    for (const column of COLUMNS) {
      squares.push({ column, row });
    }
  }
  return squares;
}

/** White's home rows (rules.md §2.1): rows 1-2, White's back row first. */
export const WHITE_HOME_ROWS: readonly Row[] = [1, 2];

/** Black's home rows (rules.md §2.1): rows 7-8. */
export const BLACK_HOME_ROWS: readonly Row[] = [7, 8];

/** `side`'s two home rows. */
export function homeRowsFor(side: Side): readonly Row[] {
  return side === "white" ? WHITE_HOME_ROWS : BLACK_HOME_ROWS;
}

/** True if `square` is one of `side`'s own home squares. */
export function isHomeSquareFor(square: Square, side: Side): boolean {
  return homeRowsFor(side).includes(square.row);
}

/** `side`'s 16 home squares (2 rows x 8 columns) - exactly the size of an army (rules.md §2.1). */
export function homeSquares(side: Side): Square[] {
  return allSquares().filter((square) => isHomeSquareFor(square, side));
}

/**
 * Which half of the board `column` falls in: the left half is A-D, the right
 * half E-H (rules.md §2.1). This distinction matters **only** when generating
 * the starting position (`startPosition.ts`, Step 4) - it has no meaning
 * during play.
 */
export type BoardHalf = "left" | "right";

export const LEFT_HALF_COLUMNS: readonly Column[] = COLUMNS.slice(
  0,
  COLUMN_COUNT / 2,
);
export const RIGHT_HALF_COLUMNS: readonly Column[] = COLUMNS.slice(
  COLUMN_COUNT / 2,
);

/** The half (`"left"` or `"right"`) that `column` falls in. See `BoardHalf`. */
export function halfOfColumn(column: Column): BoardHalf {
  return columnIndexOf(column) < COLUMN_COUNT / 2 ? "left" : "right";
}

/**
 * The eight compass directions a piece can step or attack in (rules.md
 * §4.2/§4.4): the four orthogonal directions plus the four diagonals.
 * "North" is toward Black's back row (increasing row number, matching White's
 * point of view per rules.md §4.5) - the same sense `movement.ts` (Step 5)
 * and `combat.ts` (Step 7) build their direction-relative rules on.
 */
export type Direction =
  | "north"
  | "south"
  | "east"
  | "west"
  | "northeast"
  | "northwest"
  | "southeast"
  | "southwest";

export const ORTHOGONAL_DIRECTIONS: readonly Direction[] = [
  "north",
  "south",
  "east",
  "west",
];

export const DIAGONAL_DIRECTIONS: readonly Direction[] = [
  "northeast",
  "northwest",
  "southeast",
  "southwest",
];

const DIRECTION_DELTAS: Readonly<
  Record<Direction, { readonly column: number; readonly row: number }>
> = {
  north: { column: 0, row: 1 },
  south: { column: 0, row: -1 },
  east: { column: 1, row: 0 },
  west: { column: -1, row: 0 },
  northeast: { column: 1, row: 1 },
  northwest: { column: -1, row: 1 },
  southeast: { column: 1, row: -1 },
  southwest: { column: -1, row: -1 },
};

/**
 * Steps one square from `square` in `direction`, or `null` if that step would
 * leave the board. The one adjacency primitive for this ruleset version -
 * every module above the board (movement's encumbrance, combat's formation
 * bonus, diagonal attacks' open-path check) is built by composing this and
 * nothing lower-level, since there is no terrain here to bound against, only
 * the board's own edges.
 */
export function stepFrom(square: Square, direction: Direction): Square | null {
  const delta = DIRECTION_DELTAS[direction];
  const columnIndex = columnIndexOf(square.column) + delta.column;
  const row = square.row + delta.row;
  if (!isOnBoard(columnLetter(columnIndex), row)) {
    return null;
  }
  return { column: columnLetter(columnIndex), row };
}
