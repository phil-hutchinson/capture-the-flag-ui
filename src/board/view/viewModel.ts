// Major-agnostic board view model (story 00000036, Step 11, implementation
// plan Decision 1).
//
// `FullBoard.tsx` used to take a major-2 `BoardState`/`BoardLayout` directly.
// Once a second ruleset major exists, that stops being possible - the board
// renderer, its accessible grid plumbing, and its highlighting/activation
// policy are exactly the "thick, carefully-built, accessible code" the
// story's Decision 1 says must not be duplicated per major. This module (and
// its sibling `boardOrientation.ts`) is the seam both majors render through:
// a fixed board shape (`BoardGeometry`), the pieces standing on it
// (`BoardPosition`, keyed by square), and the vocabulary (`ViewSide`,
// `ViewSquare`) they're expressed in.
//
// **This module imports nothing from `src/rules/`.** That is what makes it
// major-agnostic rather than major-2-shaped: `ViewSide`
// (`"white" | "black"`) and `ViewSquare` (`{ column, row }`) are declared
// fresh here rather than imported from `src/rules/primary/v2/board.ts`,
// exactly the way `src/art/pieceArt.ts` already declares its own
// `PieceArtSide` for the same reason. Major 2's own `Side`/`Square` are
// *structurally* identical to these (a coincidence the plan calls out
// explicitly), so a major-2 value is already assignable to a `ViewSide`/
// `ViewSquare` with no import in either direction and no edit inside
// `src/rules/primary/v2/`. When a major-3 board exists, its own `Side`/
// `Square` (`src/rules/primary/v3/board.ts`) will be assignable here the
// same way, for the same reason.
//
// Each rules major gets its own adapter turning its rule-layer board into a
// `BoardGeometry` (a `BoardLayout`, for major 2 - see
// `src/board/boardViewAdapter.ts`) and a `BoardState` into a `BoardPosition`.
// Adapters live in `src/board/`, never in this folder or in `src/rules/`:
// this is the seam *above* both majors' rules layers, not inside either one.

import type { PieceArt } from "../../art/pieceArt.ts";

/** A side, structurally identical to every rules major's own `Side` type (see module comment). */
export type ViewSide = "white" | "black";

/** A board square, structurally identical to every rules major's own `Square` type. */
export interface ViewSquare {
  readonly column: string;
  readonly row: number;
}

/** A stable string key for a `ViewSquare`, e.g. "A1" - mirrors every major's own `squareKey`. */
export function viewSquareKey(square: ViewSquare): string {
  return `${square.column}${square.row}`;
}

/**
 * A board's fixed shape: how many columns and rows it has, and which
 * squares (by `viewSquareKey`) are impassable terrain. Major 2's lakes
 * populate this; major 3's fixed 8x8 board (story.md: "every square open")
 * has none - `impassableSquares` is simply empty.
 */
export interface BoardGeometry {
  readonly columnCount: number;
  readonly rowCount: number;
  readonly impassableSquares: ReadonlySet<string>;
}

/**
 * One piece standing on the board: which side it belongs to, its art (a
 * `(major, glyph)` key - `src/art/pieceArt.ts`, story 00000036's Step 10),
 * and the player-facing name `FullBoard`'s accessible square labels read
 * (e.g. "Champion" at major 2; "Master-of-Arms, rank 5" at major 3, per the
 * plan's Step 14). The label carries the piece's name alone, without a
 * color - `FullBoard` composes "{color} {label}" itself via `sideNames.ts`,
 * exactly as it always has.
 */
export interface BoardToken {
  readonly side: ViewSide;
  readonly art: PieceArt;
  readonly label: string;
}

/** A position: every occupied square's token, keyed by `viewSquareKey`. Absent keys mean empty. */
export interface BoardPosition {
  readonly tokens: Readonly<Record<string, BoardToken>>;
}
