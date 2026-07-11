// Structural reachability rule logic for ruleset PRIMARY:1.1, §5 (companion
// capture-the-flag repository, `doc/ruleset/rules.md`, the single source of
// truth), and the four inputs the Unbreachable Flag win condition (§6.2)
// needs.
//
// "Structural" reachability is deliberately different from Phase 2 movement
// (movement.ts): it ignores every mobile piece entirely - only lakes and
// intact Towers/Flags (of *either* side) are walls - because it answers a
// question about the board's fixed geometry ("could any piece ever get from
// here to there"), not about what a specific piece may do on a specific turn.
// The connected region a square sits in can only change when a Tower is
// destroyed.
//
// These are the operational semantics transcribed verbatim from the
// companion repository's reference engine
// (`capture_the_flag/reachability.py`/`breachability.py`) at plan time - see
// this story's implementation-plan.md "Reference-engine reachability
// semantics" - so recorded games replay identically:
//
// - Walls (for both checks below): every lake square, plus every square
//   holding an intact Tower or Flag of either side. All mobile pieces are
//   ignored.
// - Flag enclosed (side S): flood-fill from S's own Flag square (the start,
//   even though it is itself a wall), stepping only orthogonally and never
//   entering a wall square. S's Flag is enclosed iff the resulting region
//   contains no square of the opponent's home zone.
// - Sappers available (side S): true iff some Sapper of S can reach some
//   Tower of the opponent, stepping orthogonally through non-wall squares,
//   where the target Tower square itself counts as reached even though it is
//   a wall (a wall to move through, not to arrive at). A side with no
//   Sappers on the board has none available.
//
// This module is pure rule logic - no React - and builds only on the board
// geometry (board.ts), the piece catalog (pieces.ts), and `BoardState`
// (gameState.ts); it has no further dependencies.

import {
  allSquares,
  COLUMNS,
  isHomeSquareFor,
  isLake,
  ROWS,
  squareKey,
  type Column,
  type Row,
  type Side,
  type Square,
} from "./board.ts";
import type { BoardState, PlacedPiece } from "./gameState.ts";

/** The four inputs the Unbreachable Flag condition (§6.2) needs, one pair per side. */
export interface UnbreachableFlagInputs {
  /** True iff White's own Flag is fully enclosed (see module doc). */
  readonly whiteFlagEnclosed: boolean;
  /** True iff Black's own Flag is fully enclosed (see module doc). */
  readonly blackFlagEnclosed: boolean;
  /** True iff White has at least one Sapper able to structurally reach a Black Tower. */
  readonly whiteSappersAvailable: boolean;
  /** True iff Black has at least one Sapper able to structurally reach a White Tower. */
  readonly blackSappersAvailable: boolean;
}

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

/** True if `square` is a wall for structural reachability: a lake, or an
 * intact Tower or Flag of either side. Mobile pieces are never walls. */
function isWall(board: BoardState, square: Square): boolean {
  if (isLake(square)) {
    return true;
  }
  const occupant = board[squareKey(square)];
  return (
    occupant !== undefined &&
    (occupant.pieceType === "tower" || occupant.pieceType === "flag")
  );
}

/** The opposite side. */
function opponentOf(side: Side): Side {
  return side === "white" ? "black" : "white";
}

/** The first square on `board` holding a piece of `side`/`pieceType`, or `undefined`. */
function findPiece(
  board: BoardState,
  side: Side,
  pieceType: PlacedPiece["pieceType"],
): Square | undefined {
  return allSquares().find((square) => {
    const occupant = board[squareKey(square)];
    return (
      occupant !== undefined &&
      occupant.side === side &&
      occupant.pieceType === pieceType
    );
  });
}

/**
 * The connected region reachable from `start` by orthogonal steps through
 * non-wall squares, including `start` itself even if `start` is a wall (the
 * Flag-enclosure case: the Flag square is always the start, and is always a
 * wall). Walls other than `start` are never entered or included.
 */
function floodFillFrom(board: BoardState, start: Square): Square[] {
  const region: Square[] = [start];
  const visited = new Set<string>([squareKey(start)]);
  const queue: Square[] = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { dc, dr } of ORTHOGONAL_DIRECTIONS) {
      const next = step(current, dc, dr);
      if (next === null) {
        continue;
      }
      const key = squareKey(next);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      if (isWall(board, next)) {
        continue;
      }
      region.push(next);
      queue.push(next);
    }
  }
  return region;
}

/**
 * True iff `side`'s own Flag is fully enclosed: flood-filling from its
 * square through non-wall squares never reaches a square of the opponent's
 * home zone, so no non-Sapper enemy piece could ever reach it. A side with no
 * Flag on the board (already captured - §6.1 is checked first and would have
 * already ended the game) is reported as not enclosed, rather than throwing.
 */
function isFlagEnclosed(board: BoardState, side: Side): boolean {
  const flagSquare = findPiece(board, side, "flag");
  if (flagSquare === undefined) {
    return false;
  }
  const opponent = opponentOf(side);
  const region = floodFillFrom(board, flagSquare);
  return !region.some((square) => isHomeSquareFor(square, opponent));
}

/**
 * True iff the piece on `origin` can structurally reach at least one square
 * holding a `targetSide` Tower: a breadth-first search through non-wall
 * squares where the target Tower square itself counts as reached the moment
 * it is encountered, even though it is a wall (a wall to move through, not
 * to arrive at) - so the search never continues past it.
 */
function canReachEnemyTower(
  board: BoardState,
  origin: Square,
  targetSide: Side,
): boolean {
  const visited = new Set<string>([squareKey(origin)]);
  const queue: Square[] = [origin];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { dc, dr } of ORTHOGONAL_DIRECTIONS) {
      const next = step(current, dc, dr);
      if (next === null) {
        continue;
      }
      const key = squareKey(next);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      const occupant = board[key];
      if (
        occupant !== undefined &&
        occupant.side === targetSide &&
        occupant.pieceType === "tower"
      ) {
        return true;
      }
      if (isWall(board, next)) {
        continue;
      }
      queue.push(next);
    }
  }
  return false;
}

/**
 * True iff `side` has at least one available Sapper: one able to
 * structurally reach at least one of the opponent's Towers. A side with no
 * Sappers left on the board has none available.
 */
function areSappersAvailable(board: BoardState, side: Side): boolean {
  const opponent = opponentOf(side);
  return allSquares().some((square) => {
    const occupant = board[squareKey(square)];
    if (
      occupant === undefined ||
      occupant.side !== side ||
      occupant.pieceType !== "sapper"
    ) {
      return false;
    }
    return canReachEnemyTower(board, square, opponent);
  });
}

/**
 * Computes, for both sides, the four inputs the Unbreachable Flag win
 * condition (§6.2) needs: whether each side's own Flag is enclosed, and
 * whether each side has at least one available Sapper. Recomputed from
 * scratch on every call - 144 squares makes this a non-issue, so no cache is
 * kept.
 */
export function computeUnbreachableFlagInputs(
  board: BoardState,
): UnbreachableFlagInputs {
  return {
    whiteFlagEnclosed: isFlagEnclosed(board, "white"),
    blackFlagEnclosed: isFlagEnclosed(board, "black"),
    whiteSappersAvailable: areSappersAvailable(board, "white"),
    blackSappersAvailable: areSappersAvailable(board, "black"),
  };
}
