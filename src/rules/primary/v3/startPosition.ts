// Generating a starting position for ruleset major 3, written from
// `reference/rules.md` §3 and `reference/start-position.md` §§1-3 alone -
// never by copying the existing major-2 rule engine (which has no analogue
// of this module at all: major 2 places pieces by hand, in a placement
// phase major 3 does not have).
//
// **Generation draws uniformly from the constrained set (start-position.md
// §2), and never by drawing a random position ID.** The set is: the Flag on
// any one of White's 8 row-1 squares, and the 15 numbered pieces in any of
// the 15!  arrangements of the remaining squares - every one of those
// 1,345,344,000 arrangements equally likely. The ID (`positionId.ts`, Step 3)
// is an encoding of a board, not an index into that set: of the 16^16 codes
// it can express, only about 7 x 10^-11 of them are positions, so drawing a
// random code and hoping it validates is not a uniform draw over anything -
// see start-position.md §2 and §5's "Not every code is a position". This
// module always generates the arrangement first (`generateWhiteArrangement`
// below) and only encodes it afterward.
//
// **Black's arrangement is derived, not generated independently**
// (start-position.md §3): sum the ranks of the seven numbered pieces sharing
// White's Flag's half of the board (call it `S`), and turn White's whole
// arrangement by 180 degrees if `S >= 22`, or reflect it top-to-bottom if
// `S <= 21`.
//
// **The threshold is derived from the army, never hard-coded.** Written
// generally (start-position.md §3, "Why 22"):
//
//   half-turn  <=>  S * (total numbered pieces)  >  (pieces in the Flag's
//                   half) * (total rank across the whole army)
//              <=>  S * 15  >  7 * 45
//              <=>  S  >  21
//
// `isHalfTurn` below computes both sides of that inequality from `pieces.ts`
// and `board.ts`'s own constants rather than writing "22" anywhere. If the
// army composition ever changes - a different rank spread, a different
// number of home rows - the comparison recomputes itself; a bare `22` would
// silently stay wrong (start-position.md §3: "the threshold is derived, not
// fundamental... recompute the constant rather than carrying 22 across").
//
// **Mirror-equivalent positions are deliberately not collapsed**
// (start-position.md §4). An arrangement and its left-right mirror image
// play identically, but a generator that merged each pair down to one
// canonical representative would only ever emit one member of it - and
// whichever half that representative's Flag sits on, every game in the
// game's history would visibly put the Flag there. Nothing in this module
// canonicalises, dedupes, or otherwise treats mirror pairs as anything but
// two independent, equally likely outcomes.
//
// This module builds on the board geometry (`board.ts`), the piece catalog
// (`pieces.ts`), the board-state model (`position.ts`) and the position ID
// (`positionId.ts`), all Steps 1-3.

import {
  COLUMN_COUNT,
  columnIndexOf,
  columnLetter,
  halfOfColumn,
  homeSquares,
  ROW_COUNT,
  WHITE_HOME_ROWS,
  type Square,
} from "./board.ts";
import {
  FLAG_QUANTITY_PER_SIDE,
  NUMBERED_PIECE_COUNT_PER_SIDE,
  RANK_CATALOG,
  rankCatalogEntries,
  RANKS,
  type Rank,
} from "./pieces.ts";
import {
  EMPTY_POSITION,
  findFlag,
  pieceAt,
  placePiece,
  type PlacedPiece,
  type PositionState,
} from "./position.ts";
import { encodePositionId, type PositionId } from "./positionId.ts";

/**
 * A source of numbers in `[0, 1)`, with the same contract as `Math.random`.
 * Generation takes one as an injectable, optional parameter (defaulting to
 * `Math.random`) so a test can drive it with a small deterministic seeded
 * generator instead - no dependency added for it (this story's implementation
 * plan, Decision 7).
 */
export type RandomSource = () => number;

/** White's back row, where the Flag must stand (start-position.md §1). */
const FLAG_ROW = WHITE_HOME_ROWS[0];

/**
 * Returns a new array containing every element of `items`, shuffled
 * uniformly at random (a Fisher-Yates shuffle) using `random`. Does not
 * mutate `items`.
 */
function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const current = result[index];
    result[index] = result[swapWith];
    result[swapWith] = current;
  }
  return result;
}

/** The 15 numbered ranks one full army carries, in no particular order: three each of ranks 1-5. */
function numberedPieceRanks(): Rank[] {
  return RANKS.flatMap((rank) =>
    Array.from({ length: RANK_CATALOG[rank].quantityPerSide }, () => rank),
  );
}

/**
 * Generates White's arrangement, drawn uniformly from the constrained set
 * (start-position.md §§1-2): the Flag on a uniformly chosen square of row 1,
 * then the 15 numbered pieces shuffled uniformly into the remaining 15
 * squares. Returns White's 16 pieces only - see `deriveBlackArrangement` for
 * the rest of the board.
 */
export function generateWhiteArrangement(
  random: RandomSource = Math.random,
): PositionState {
  const flagColumn = columnLetter(Math.floor(random() * COLUMN_COUNT));
  const flagSquare: Square = { column: flagColumn, row: FLAG_ROW };

  const remainingSquares = homeSquares("white").filter(
    (square) =>
      !(square.column === flagSquare.column && square.row === flagSquare.row),
  );
  const shuffledRanks = shuffle(numberedPieceRanks(), random);

  let position: PositionState = placePiece(EMPTY_POSITION, flagSquare, {
    side: "white",
    kind: "flag",
  });
  remainingSquares.forEach((square, index) => {
    position = placePiece(position, square, {
      side: "white",
      kind: "numbered",
      rank: shuffledRanks[index],
    });
  });
  return position;
}

/** The two ways Black's arrangement can be turned from White's (start-position.md §3). */
export type Turn = "halfTurn" | "reflection";

// The derived threshold (start-position.md §3, "Why 22"), computed from the
// army rather than written as a literal. Correct only for three each of
// ranks 1-5 - see the module comment.
const TOTAL_RANK = rankCatalogEntries().reduce(
  (total, entry) => total + entry.rank * entry.quantityPerSide,
  0,
);
const HALF_SQUARE_COUNT = (COLUMN_COUNT / 2) * WHITE_HOME_ROWS.length;
const PIECES_IN_FLAG_HALF = HALF_SQUARE_COUNT - FLAG_QUANTITY_PER_SIDE;

/**
 * True if a Flag-half rank sum of `flagHalfRankSum` (`S` in
 * start-position.md §3) calls for the half-turn branch rather than the
 * reflection branch. The comparison is the general derived form -
 * `S * (total numbered pieces) > (pieces in the Flag's half) * (total
 * rank)` - not a hard-coded `S >= 22`; see the module comment for the
 * derivation and why it must stay written this way.
 */
function isHalfTurn(flagHalfRankSum: number): boolean {
  return (
    flagHalfRankSum * NUMBERED_PIECE_COUNT_PER_SIDE >
    PIECES_IN_FLAG_HALF * TOTAL_RANK
  );
}

/** The sum of ranks of the numbered pieces sharing `flagSquare`'s half of the board (start-position.md §3's `S`). */
function flagHalfRankSum(
  whiteArrangement: PositionState,
  flagSquare: Square,
): number {
  const flagHalf = halfOfColumn(flagSquare.column);
  let sum = 0;
  for (const square of homeSquares("white")) {
    if (halfOfColumn(square.column) !== flagHalf) {
      continue;
    }
    const piece = pieceAt(whiteArrangement, square);
    if (piece !== undefined && piece.kind === "numbered") {
      sum += piece.rank;
    }
  }
  return sum;
}

/** `square` turned 180 degrees or reflected top-to-bottom, per `turn` (start-position.md §3). */
function turnSquare(square: Square, turn: Turn): Square {
  const row = ROW_COUNT + 1 - square.row;
  if (turn === "reflection") {
    return { column: square.column, row };
  }
  const column = columnLetter(COLUMN_COUNT - 1 - columnIndexOf(square.column));
  return { column, row };
}

/** Black's arrangement, and which turn produced it, as returned by `deriveBlackArrangement`. */
export interface BlackArrangement {
  readonly position: PositionState;
  readonly turn: Turn;
}

/**
 * Derives Black's arrangement from White's (start-position.md §3): sums the
 * ranks of the seven numbered pieces sharing White's Flag's half, then turns
 * every White piece by the resulting branch's mapping, with the side flipped
 * to Black. Takes White's arrangement alone (no random source) - Black's
 * arrangement is entirely determined by White's, never generated
 * independently.
 */
export function deriveBlackArrangement(
  whiteArrangement: PositionState,
): BlackArrangement {
  const flagSquare = findFlag(whiteArrangement, "white");
  if (flagSquare === undefined) {
    throw new Error(
      "startPosition.ts: deriveBlackArrangement: white arrangement has no Flag.",
    );
  }

  const turn: Turn = isHalfTurn(flagHalfRankSum(whiteArrangement, flagSquare))
    ? "halfTurn"
    : "reflection";

  let blackArrangement: PositionState = EMPTY_POSITION;
  for (const square of homeSquares("white")) {
    const piece = pieceAt(whiteArrangement, square);
    if (piece === undefined) {
      continue;
    }
    const target = turnSquare(square, turn);
    const turnedPiece: PlacedPiece =
      piece.kind === "flag"
        ? { side: "black", kind: "flag" }
        : { side: "black", kind: "numbered", rank: piece.rank };
    blackArrangement = placePiece(blackArrangement, target, turnedPiece);
  }
  return { position: blackArrangement, turn };
}

/** A freshly generated starting position, as returned by `generateStartPosition`. */
export interface GeneratedStartPosition {
  /** The full 32-piece board: White's generated arrangement plus Black's derived one. */
  readonly position: PositionState;
  /** White's arrangement alone, encoded (`positionId.ts`) - names the whole position (start-position.md §5). */
  readonly positionId: PositionId;
  /** Which turn produced Black's arrangement from White's (start-position.md §3). */
  readonly turn: Turn;
}

/**
 * Generates a complete major-3 starting position: White's arrangement drawn
 * uniformly (`generateWhiteArrangement`), then Black's derived from it
 * (`deriveBlackArrangement`). `random` defaults to `Math.random`; pass a
 * seeded generator for a deterministic test.
 */
export function generateStartPosition(
  random: RandomSource = Math.random,
): GeneratedStartPosition {
  const whiteArrangement = generateWhiteArrangement(random);
  const { position: blackArrangement, turn } =
    deriveBlackArrangement(whiteArrangement);
  return {
    position: { ...whiteArrangement, ...blackArrangement },
    positionId: encodePositionId(whiteArrangement),
    turn,
  };
}
