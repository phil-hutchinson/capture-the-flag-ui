// Movement rule logic (empty-square destinations only) for ruleset
// PRIMARY:1.1, Phase 2 §4.2 (companion capture-the-flag repository,
// `doc/ruleset/rules.md`, the single source of truth).
//
// This module is pure rule logic - no React, no screen orientation - and
// computes, for a piece at a given origin, the squares it may legally move
// to *this story*: an empty, on-board, non-lake square reached without
// crossing a lake or another piece, and never diagonally. Attacking an
// occupied square (combat) is out of scope here - see story 00000005.
//
// Builds only on story 00000001's board geometry (board.ts), piece catalog
// (pieces.ts), and `BoardState` (gameState.ts); it has no further
// dependencies.

import {
  allSquares,
  COLUMNS,
  isLake,
  ROWS,
  squareKey,
  type Column,
  type Row,
  type Side,
  type Square,
} from "./board.ts";
import type { BoardState } from "./gameState.ts";

/** The four orthogonal directions a piece may step in, as column/row deltas. */
const ORTHOGONAL_DIRECTIONS: readonly { dc: number; dr: number }[] = [
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
];

const COLUMN_INDEX: Readonly<Record<Column, number>> = Object.fromEntries(
  COLUMNS.map((column, index) => [column, index]),
) as Record<Column, number>;

/** The square one step from `square` in direction `dc`/`dr`, or `null` if off-board. */
function step(square: Square, dc: number, dr: number): Square | null {
  const columnIndex = COLUMN_INDEX[square.column] + dc;
  const row = (square.row + dr) as Row;
  if (columnIndex < 0 || columnIndex >= COLUMNS.length) {
    return null;
  }
  if (!ROWS.includes(row)) {
    return null;
  }
  return { column: COLUMNS[columnIndex], row };
}

/** True if `square` holds no piece in `board` (and is not itself a lake). */
function isEmpty(board: BoardState, square: Square): boolean {
  return !isLake(square) && board[squareKey(square)] === undefined;
}

/** The maximum number of squares a piece may travel in a straight line, per §4.2. */
function maxRange(pieceType: string): number {
  return pieceType === "skirmisher" ? 3 : 1;
}

/**
 * True if the piece type never moves at all (Tower, Flag - §4.2, §2.2). All
 * other piece types move at least one square orthogonally.
 */
function isImmobile(pieceType: string): boolean {
  return pieceType === "tower" || pieceType === "flag";
}

/**
 * The legal empty-square destinations for the piece on `origin`, given
 * `board`. Returns an empty array if `origin` is empty or holds an immobile
 * piece (Tower or Flag). Every other piece type may step one orthogonally
 * adjacent empty, non-lake, on-board square in each of the four directions;
 * a Skirmisher may travel up to three squares in a clear straight line,
 * stopping the moment it would enter a lake or an occupied square (that
 * blocking square is never itself a destination). Never diagonal, never
 * off-board.
 */
export function legalDestinations(board: BoardState, origin: Square): Square[] {
  const occupant = board[squareKey(origin)];
  if (occupant === undefined || isImmobile(occupant.pieceType)) {
    return [];
  }

  const range = maxRange(occupant.pieceType);
  const destinations: Square[] = [];
  for (const { dc, dr } of ORTHOGONAL_DIRECTIONS) {
    for (let distance = 1; distance <= range; distance += 1) {
      const next = step(origin, dc * distance, dr * distance);
      if (next === null || !isEmpty(board, next)) {
        break;
      }
      destinations.push(next);
    }
  }
  return destinations;
}

/**
 * True if `side` has at least one legal move somewhere on `board` (any of
 * its own pieces has at least one legal destination). Used only to fail
 * quietly for the accepted "stuck with no legal move" case (see story
 * 00000004's Grounding facts) - not surfaced in any UI or tested for its own
 * sake in this story; the real handling arrives in story 00000006.
 */
export function hasAnyLegalMove(board: BoardState, side: Side): boolean {
  for (const square of allSquares()) {
    const placed = board[squareKey(square)];
    if (placed === undefined || placed.side !== side) {
      continue;
    }
    if (legalDestinations(board, square).length > 0) {
      return true;
    }
  }
  return false;
}
