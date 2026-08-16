// Board-state model for ruleset major 3 (see `edition.ts` for its edition
// id), written from `reference/rules.md` §4.3 alone (this story's
// implementation plan, Step 2) - never by copying the existing major-2 rule
// engine.
//
// The defining idea of this ruleset major: **a piece's rank is mutable game
// state**, not a fixed property of a token. rules.md §4.3's rank reduction
// rule puts it plainly - a rank 5 that wins a fight becomes a rank 4 "in
// every respect and for the rest of the game. It fights as a 4, forms up with
// other 4s, and is written as a 4. There is no memory of what it used to be."
// This module is where that state lives: a `NumberedPiece` carries its
// *current* rank, and `demotePiece` below is the one place that ever changes
// it. Nothing here - or anywhere else in this ruleset version - stores a
// piece's "original" rank, an id, or any other notion of piece identity that
// would survive a demotion. There is none to survive.
//
// This module builds on the board geometry (`board.ts`) and the rank catalog
// (`pieces.ts`), both Step 1; it has no further dependencies.

import { type Side, type Square, squareKey } from "./board.ts";
import type { Rank } from "./pieces.ts";

/** A numbered piece on the board: a side and its *current* rank (mutable - see module comment). */
export interface NumberedPiece {
  readonly side: Side;
  readonly kind: "numbered";
  readonly rank: Rank;
}

/** A side's Flag on the board. The Flag has no rank and never fights (rules.md §4.3). */
export interface FlagPiece {
  readonly side: Side;
  readonly kind: "flag";
}

/** One placed piece: either a numbered piece carrying its current rank, or a side's Flag. */
export type PlacedPiece = NumberedPiece | FlagPiece;

/**
 * The full board, keyed by `squareKey` (see `board.ts`). Squares absent from
 * this record are empty. Plain, JSON-serializable data - no `Map`s, no
 * functions - matching the shape major 2's own board state uses
 * (`v2/gameState.ts`'s `BoardState`, restated here rather than imported - see
 * this plan's version-wall constraint), so a state round-trips through
 * `JSON.stringify`/`JSON.parse` unchanged.
 */
export type PositionState = Readonly<Record<string, PlacedPiece>>;

/** The empty position: no pieces anywhere. */
export const EMPTY_POSITION: PositionState = {};

/** The piece standing on `square`, or `undefined` if it is empty. */
export function pieceAt(
  position: PositionState,
  square: Square,
): PlacedPiece | undefined {
  return position[squareKey(square)];
}

/** Returns a new position with `piece` standing on `square`, overwriting whatever was there. */
export function placePiece(
  position: PositionState,
  square: Square,
  piece: PlacedPiece,
): PositionState {
  return { ...position, [squareKey(square)]: piece };
}

/** Returns a new position with `square` empty. A no-op (returns `position` itself) if already empty. */
export function removePiece(
  position: PositionState,
  square: Square,
): PositionState {
  const key = squareKey(square);
  if (!(key in position)) {
    return position;
  }
  const next = { ...position };
  delete next[key];
  return next;
}

/**
 * Returns a new position with the piece standing on `from` moved to `to`,
 * replacing whatever stood at `to` (combat resolution removes the loser
 * first - see `combat.ts`, Step 7). Throws if `from` is empty.
 */
export function relocatePiece(
  position: PositionState,
  from: Square,
  to: Square,
): PositionState {
  const piece = pieceAt(position, from);
  if (piece === undefined) {
    throw new Error(
      `position.ts: relocatePiece: no piece stands on ${squareKey(from)}.`,
    );
  }
  return placePiece(removePiece(position, from), to, piece);
}

/** Matches a `squareKey` string (e.g. `"A1"`), for parsing keys back into squares below. */
const SQUARE_KEY_PATTERN = /^([A-H])([1-8])$/;

/** The inverse of `squareKey`: parses one of a position's own record keys back into a `Square`. */
function squareFromKey(key: string): Square {
  const match = SQUARE_KEY_PATTERN.exec(key);
  if (match === null) {
    throw new Error(`position.ts: not a valid square key: "${key}".`);
  }
  return { column: match[1], row: Number(match[2]) };
}

/** One piece and the square it stands on, as returned by `piecesOf`. */
export interface SquareAndPiece {
  readonly square: Square;
  readonly piece: PlacedPiece;
}

/** Every piece `side` has on the board, each paired with its square. Order is not significant. */
export function piecesOf(
  position: PositionState,
  side: Side,
): SquareAndPiece[] {
  return Object.entries(position)
    .filter(([, piece]) => piece.side === side)
    .map(([key, piece]) => ({ square: squareFromKey(key), piece }));
}

/**
 * How many *numbered* pieces `side` has on the board. The Flag never counts
 * (rules.md §5, attrition: "The Flag does not count") - this is the count
 * `outcome.ts` (Step 8) checks for attrition.
 */
export function numberedPieceCount(
  position: PositionState,
  side: Side,
): number {
  return piecesOf(position, side).filter(
    (entry) => entry.piece.kind === "numbered",
  ).length;
}

/** `side`'s Flag's square, or `undefined` if it has already been captured. */
export function findFlag(
  position: PositionState,
  side: Side,
): Square | undefined {
  return piecesOf(position, side).find((entry) => entry.piece.kind === "flag")
    ?.square;
}

/**
 * One rank weaker than `rank`, clamped at rank 1. The rules argue a rank 1
 * can never survive combat and so never needs demoting (rules.md §4.3: "a
 * rank 1 draws against another rank 1 and loses to everything stronger, so a
 * rank 1 never survives combat"), but this engine does not depend on that
 * argument holding - demoting a rank 1 yields a rank 1, never a rank 0
 * propagating through the board state (owner decision, story.md).
 */
export function reduceRank(rank: Rank): Rank {
  return (rank > 1 ? rank - 1 : 1) as Rank;
}

/**
 * Returns a new position with the numbered piece on `square` demoted one
 * rank (clamped at rank 1 - see `reduceRank`); every other square is left
 * untouched. Throws if `square` is empty or holds the Flag - the Flag never
 * fights and is never demoted (rules.md §4.3, "Capturing the Flag is not
 * combat[:] the Flag does not fight, so a piece that captures it is not
 * reduced").
 */
export function demotePiece(
  position: PositionState,
  square: Square,
): PositionState {
  const piece = pieceAt(position, square);
  if (piece === undefined) {
    throw new Error(
      `position.ts: demotePiece: no piece stands on ${squareKey(square)}.`,
    );
  }
  if (piece.kind === "flag") {
    throw new Error(
      `position.ts: demotePiece: the Flag is never demoted (${squareKey(square)}).`,
    );
  }
  return placePiece(position, square, {
    ...piece,
    rank: reduceRank(piece.rank),
  });
}
