// Movement and attack-target rule logic for ruleset PRIMARY:1.1, Phase 2
// §4.2-4.3 (companion capture-the-flag repository, `doc/ruleset/rules.md`,
// the single source of truth).
//
// This module is pure rule logic - no React, no screen orientation - and
// computes, for a piece at a given origin:
//
// - `legalDestinations` - the empty-square moves it may make (an empty,
//   on-board, non-lake square reached without crossing a lake or another
//   piece, and never diagonally);
// - `legalAttacks` (story 00000005 Step 3) - the enemy-occupied squares it
//   may legally attack (moving onto them resolves combat - see combat.ts -
//   rather than a plain relocation).
//
// The two are kept deliberately distinct - an enemy-occupied square is never
// a `legalDestinations` result and an empty square is never a `legalAttacks`
// result - so callers (and the UI) can tell moves and attacks apart without
// re-deriving intent.
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
import type { BoardState, PlacedPiece } from "./gameState.ts";
import type { PieceTypeId } from "./pieces.ts";

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
function maxRange(pieceType: PieceTypeId): number {
  return pieceType === "skirmisher" ? 3 : 1;
}

/**
 * True if the piece type never moves at all (Tower, Flag - §4.2, §2.2). All
 * other piece types move at least one square orthogonally.
 */
function isImmobile(pieceType: PieceTypeId): boolean {
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

/** The furthest distance (in squares, along a clear straight line) a piece
 * type may attack, per §4.3: a Knight's charge and a Skirmisher's rush both
 * reach 3; every other piece type attacks only an adjacent (1-square)
 * square. */
function maxAttackDistance(pieceType: PieceTypeId): number {
  return pieceType === "knight" || pieceType === "skirmisher" ? 3 : 1;
}

/**
 * True if the piece occupying an attack ray's first blocking square,
 * `occupant`, is a legal attack target for a piece of `pieceType` and `side`
 * attacking at `distance` squares away. Never a friendly piece - that
 * includes a friendly Flag, which (being immobile) is never itself an
 * attacker but is a legal target for the enemy (story 00000006 - capturing
 * it wins the game, see combat.ts's Flag defender case). A Knight may not
 * charge (attack at distance 2 or 3) a Halberdier - it must attack one from
 * adjacent, per §4.3's anti-charge rule - but every other combination of
 * piece type, distance, and enemy type is a legal target (including a
 * Knight's adjacent attack on a Halberdier, a Knight's charge onto an enemy
 * Flag, and a Skirmisher's rush onto any enemy type, including the Flag).
 */
function isLegalAttackTarget(
  occupant: PlacedPiece,
  side: Side,
  pieceType: PieceTypeId,
  distance: number,
): boolean {
  if (occupant.side === side) {
    return false;
  }
  if (
    pieceType === "knight" &&
    distance >= 2 &&
    occupant.pieceType === "halberdier"
  ) {
    return false;
  }
  return true;
}

/**
 * The enemy-occupied squares the piece on `origin` may legally attack, given
 * `board`, keyed in the absolute White frame. Returns an empty array if
 * `origin` is empty or holds an immobile piece (Tower or Flag - neither ever
 * attacks). Every other piece type may attack an orthogonally adjacent enemy
 * square in each of the four directions; a Knight or Skirmisher may instead
 * reach up to 3 squares in a clear straight line (a Knight's charge, a
 * Skirmisher's rush), stopping at - and only offering as a target - the
 * first piece encountered along the ray (a lake also stops the ray, but is
 * never itself a target, since a lake never holds a piece). A Knight may not
 * charge (distance >= 2) onto a Halberdier. An **enemy** Flag is offered like
 * any other enemy piece (story 00000006 - capturing it wins the game); a
 * **friendly** Flag is never a target. Never diagonal, never off-board.
 */
export function legalAttacks(board: BoardState, origin: Square): Square[] {
  const occupant = board[squareKey(origin)];
  if (occupant === undefined || isImmobile(occupant.pieceType)) {
    return [];
  }

  const { side, pieceType } = occupant;
  const maxDistance = maxAttackDistance(pieceType);
  const attacks: Square[] = [];
  for (const { dc, dr } of ORTHOGONAL_DIRECTIONS) {
    for (let distance = 1; distance <= maxDistance; distance += 1) {
      const next = step(origin, dc * distance, dr * distance);
      if (next === null || isLake(next)) {
        break;
      }
      const blocker = board[squareKey(next)];
      if (blocker === undefined) {
        continue;
      }
      if (isLegalAttackTarget(blocker, side, pieceType, distance)) {
        attacks.push(next);
      }
      break;
    }
  }
  return attacks;
}

/**
 * True if `side` has at least one legal **non-attack** move somewhere on
 * `board` (any of its own pieces has at least one legal `legalDestinations`
 * empty-square destination). Deliberately considers only plain moves, not
 * attacks - a piece that can only attack is not "stuck" for this check's
 * purpose, so it must not be folded into a broader "has any legal action"
 * check. Used only to fail quietly for the accepted "stuck with no legal
 * move" case (see story 00000004's Grounding facts) - not surfaced in any UI
 * or tested for its own sake in this story.
 *
 * @remarks Intentionally has no production caller yet - retained as
 * ready-for-use API. An attack-aware "has any legal action" check (folding
 * in `legalAttacks`) is story 00000006's concern, not this function's.
 */
export function hasAnyLegalNonAttackMove(
  board: BoardState,
  side: Side,
): boolean {
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
