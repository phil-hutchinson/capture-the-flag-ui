// Movement and attack-target rule logic for ruleset major 2, §4.2-4.3
// (companion capture-the-flag repository, `doc/ruleset/rules.md`, the single
// source of truth).
//
// This module is pure rule logic - no React, no screen orientation - and
// computes, for a piece at a given origin:
//
// - `legalDestinations` - the empty-square moves it may make (an empty,
//   on-board, non-lake square reached without crossing a lake or another
//   piece, and never diagonally);
// - `legalAttacks` - the enemy-occupied squares it may legally attack (moving
//   onto them resolves combat - see combat.ts - rather than a plain
//   relocation).
//
// The two are kept deliberately distinct - an enemy-occupied square is never
// a `legalDestinations` result and an empty square is never a `legalAttacks`
// result - so callers (and the UI) can tell moves and attacks apart without
// re-deriving intent.
//
// Every mobile piece type (all but Tower and Flag) moves the same way: one
// square orthogonally, always available; and, when *unencumbered* - no enemy
// piece in any of its eight surrounding squares (orthogonal or diagonal),
// judged at its current square before it moves - an additional two squares
// orthogonally in a straight line, provided the one-away intermediate square
// is empty and not a lake. The far square may be empty (a move) or hold an
// enemy (an attack). There are no other move ranges, charges, or per-type
// special cases in 2.0.
//
// A mobile piece may additionally *attack* (never move onto) an enemy
// exactly one square diagonally (§4.3, "Diagonal attacks", major 2), but only
// a movable/numbered enemy piece - a Tower or the Flag can never be attacked
// diagonally. There is no two-square diagonal and it is never subject to the
// unencumbered bonus.
//
// Builds only on the board geometry (board.ts, boardLayout.ts), the piece
// catalog (pieces.ts), and `BoardState` (gameState.ts); it has no further
// dependencies.
//
// `legalDestinations` takes an optional `layout` parameter (a `BoardLayout`,
// boardLayout.ts), defaulting to `BATTLE_LAYOUT` - neither flag touches
// plain movement, so it keeps its pre-story-00000027 shape. `legalAttacks`
// and `hasAnyLegalPly`, below, instead take a **required** `RuleConfiguration`
// (story 00000027's implementation plan, Decision 3): its resolved flags are
// what the diagonal loop reads (Steps 4-5), and its `edition.boardLayout` is
// what sizes the board - no default, so every call site names its
// configuration explicitly rather than silently inheriting Battle's.

import {
  allSquares,
  BATTLE_LAYOUT,
  columnIndexOf,
  isLake,
  squareKey,
  type Side,
  type Square,
} from "./board.ts";
import { columnLetter, type BoardLayout } from "./boardLayout.ts";
import type { RuleConfiguration } from "./configuration.ts";
import type { BoardState } from "./gameState.ts";
import type { PieceTypeId } from "./pieces.ts";

/** The four orthogonal directions a piece may step or attack in, as column/row deltas. */
const ORTHOGONAL_DIRECTIONS: readonly { dc: number; dr: number }[] = [
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
];

/**
 * The four diagonal directions a piece may *attack* in (never move in - see
 * `legalAttacks`), as column/row deltas. One square only - there is no
 * two-square diagonal (§4.3, "Diagonal attacks").
 */
const DIAGONAL_DIRECTIONS: readonly { dc: number; dr: number }[] = [
  { dc: -1, dr: -1 },
  { dc: 1, dr: -1 },
  { dc: -1, dr: 1 },
  { dc: 1, dr: 1 },
];

/** The eight squares surrounding a square (orthogonal and diagonal), used only
 * to judge encumbrance - never as move or attack directions themselves. */
const SURROUNDING_DIRECTIONS: readonly { dc: number; dr: number }[] = [
  { dc: -1, dr: -1 },
  { dc: 0, dr: -1 },
  { dc: 1, dr: -1 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
  { dc: -1, dr: 1 },
  { dc: 0, dr: 1 },
  { dc: 1, dr: 1 },
];

/** The square `distance` steps from `square` in direction `dc`/`dr`, or `null` if off-board on `layout`. */
function step(
  square: Square,
  dc: number,
  dr: number,
  distance: number,
  layout: BoardLayout,
): Square | null {
  const columnIndex = columnIndexOf(square.column) + dc * distance;
  const row = square.row + dr * distance;
  if (columnIndex < 0 || columnIndex >= layout.columnCount) {
    return null;
  }
  if (row < 1 || row > layout.rowCount) {
    return null;
  }
  return { column: columnLetter(columnIndex), row };
}

/** True if `square` holds no piece in `board` (and is not itself a lake on `layout`). */
function isEmpty(
  board: BoardState,
  square: Square,
  layout: BoardLayout,
): boolean {
  return !isLake(square, layout) && board[squareKey(square)] === undefined;
}

/**
 * True if the piece type never moves at all (Tower, Flag - §2.2, §4.2). All
 * other piece types move at least one square orthogonally.
 */
function isImmobile(pieceType: PieceTypeId): boolean {
  return pieceType === "tower" || pieceType === "flag";
}

/**
 * True if the piece belonging to `side` at `origin` is *unencumbered* - no
 * enemy piece occupies any of its eight surrounding squares (orthogonal or
 * diagonal), judged at `origin` before it moves (§4.2). An unencumbered piece
 * additionally offers a two-square move/attack in each orthogonal direction.
 */
function isUnencumbered(
  board: BoardState,
  origin: Square,
  side: Side,
  layout: BoardLayout,
): boolean {
  for (const { dc, dr } of SURROUNDING_DIRECTIONS) {
    const neighbor = step(origin, dc, dr, 1, layout);
    if (neighbor === null) {
      continue;
    }
    const occupant = board[squareKey(neighbor)];
    if (occupant !== undefined && occupant.side !== side) {
      return false;
    }
  }
  return true;
}

/**
 * The legal empty-square destinations for the piece on `origin`, given
 * `board`. Returns an empty array if `origin` is empty or holds an immobile
 * piece (Tower or Flag). Every mobile piece may step one square orthogonally
 * into an empty, non-lake, on-board square in each of the four directions;
 * an unencumbered piece (§4.2 - no enemy in any of its eight surrounding
 * squares) may additionally reach the square two away in a straight line,
 * provided the one-away intermediate square is empty and not a lake and the
 * far square is itself empty, non-lake, and on-board. Never diagonal, never
 * off-board, never through or onto a lake, never onto an occupied square.
 * `layout` sizes the board's bounds and lake pattern; defaults to Battle.
 */
export function legalDestinations(
  board: BoardState,
  origin: Square,
  layout: BoardLayout = BATTLE_LAYOUT,
): Square[] {
  const occupant = board[squareKey(origin)];
  if (occupant === undefined || isImmobile(occupant.pieceType)) {
    return [];
  }

  const unencumbered = isUnencumbered(board, origin, occupant.side, layout);
  const destinations: Square[] = [];
  for (const { dc, dr } of ORTHOGONAL_DIRECTIONS) {
    const near = step(origin, dc, dr, 1, layout);
    if (near === null || !isEmpty(board, near, layout)) {
      continue;
    }
    destinations.push(near);

    if (!unencumbered) {
      continue;
    }
    const far = step(origin, dc, dr, 2, layout);
    if (far === null || !isEmpty(board, far, layout)) {
      continue;
    }
    destinations.push(far);
  }
  return destinations;
}

/**
 * The enemy-occupied squares the piece on `origin` may legally attack, given
 * `board`. Returns an empty array if `origin` is empty or holds an immobile
 * piece (Tower or Flag - neither ever attacks). Every mobile piece may attack
 * an orthogonally adjacent enemy square in each of the four directions; an
 * unencumbered piece (§4.2) may additionally attack the enemy-occupied square
 * two away in a straight line, provided the one-away intermediate square is
 * empty and not a lake. An enemy Flag is offered like any other orthogonal
 * enemy piece (capturing it wins the game); a friendly piece is never a
 * target. Never off-board, never through or onto a lake.
 *
 * A mobile piece may additionally attack an enemy exactly one square
 * **diagonally** (§4.3, "Diagonal attacks") - but only a **movable
 * (numbered)** enemy piece: a Tower or the Flag can never be attacked
 * diagonally, so the Flag can only ever be captured from an orthogonally
 * adjacent square. There is no two-square diagonal and no diagonal move onto
 * an empty square - the diagonal is an attacking direction and nothing else,
 * and is never subject to the unencumbered bonus. A lake at the diagonal's
 * *corner* does not block the attack (the "skirt"); only the attacked square
 * itself must not be a lake. `configuration` (story 00000027 - required, no
 * default) sizes the board via `configuration.edition.boardLayout`; its
 * resolved flags do not change the diagonal loop's logic in this step (Steps
 * 4-5 read them).
 */
export function legalAttacks(
  board: BoardState,
  origin: Square,
  configuration: RuleConfiguration,
): Square[] {
  const layout = configuration.edition.boardLayout;
  const occupant = board[squareKey(origin)];
  if (occupant === undefined || isImmobile(occupant.pieceType)) {
    return [];
  }

  const { side } = occupant;
  const unencumbered = isUnencumbered(board, origin, side, layout);
  const attacks: Square[] = [];
  for (const { dc, dr } of ORTHOGONAL_DIRECTIONS) {
    const near = step(origin, dc, dr, 1, layout);
    if (near !== null) {
      const nearOccupant = board[squareKey(near)];
      if (
        nearOccupant !== undefined &&
        !isLake(near, layout) &&
        nearOccupant.side !== side
      ) {
        attacks.push(near);
      }
    }

    if (!unencumbered || near === null || !isEmpty(board, near, layout)) {
      continue;
    }
    const far = step(origin, dc, dr, 2, layout);
    if (far === null || isLake(far, layout)) {
      continue;
    }
    const farOccupant = board[squareKey(far)];
    if (farOccupant !== undefined && farOccupant.side !== side) {
      attacks.push(far);
    }
  }

  for (const { dc, dr } of DIAGONAL_DIRECTIONS) {
    const target = step(origin, dc, dr, 1, layout);
    if (target === null || isLake(target, layout)) {
      continue;
    }
    const targetOccupant = board[squareKey(target)];
    if (
      targetOccupant !== undefined &&
      targetOccupant.side !== side &&
      !isImmobile(targetOccupant.pieceType)
    ) {
      attacks.push(target);
    }
  }

  return attacks;
}

/**
 * True if `side` has at least one legal ply anywhere on `board` - a plain
 * move (`legalDestinations`) or an attack (`legalAttacks`) - with any of its
 * own pieces. This is the primitive the game-end detection (`outcome.ts`)
 * needs for §5's "no legal move": a side that can only attack is *not*
 * stuck (any adjacent enemy piece is always a legal, if sacrificial, attack),
 * so both destination sets must be considered. `configuration` (story
 * 00000027 - required, no default) sizes the board via
 * `configuration.edition.boardLayout` and is threaded into `legalAttacks`, so
 * a diagonal-attack flag reaches this "no legal move" primitive too.
 */
export function hasAnyLegalPly(
  board: BoardState,
  side: Side,
  configuration: RuleConfiguration,
): boolean {
  const layout = configuration.edition.boardLayout;
  for (const square of allSquares(layout)) {
    const placed = board[squareKey(square)];
    if (placed === undefined || placed.side !== side) {
      continue;
    }
    if (
      legalDestinations(board, square, layout).length > 0 ||
      legalAttacks(board, square, configuration).length > 0
    ) {
      return true;
    }
  }
  return false;
}
