// Versioned initial game-state serialization for ruleset PRIMARY:1.1.
//
// Once both players have completed placement, the two `PlacementState`s
// (Step 3) are combined into a single, versioned `InitialGameState` artifact:
// a plain, JSON-serializable snapshot of both armies keyed by absolute square
// (White's frame - see board.ts), tagged with the ruleset it was created
// under so recorded games stay replayable even if a future ruleset version
// changes the rules. This anticipates the replay record file format described
// in the companion repository's `doc/ruleset/technical-notes.md` (the
// `Ruleset` tag and the position-block render) without implementing replay
// itself - there is deliberately no "load a game" path here.
//
// This module builds on the board geometry (Step 1), the piece catalog
// (Step 2), and the placement-state model (Step 3); it has no further
// dependencies.

import { COLUMNS, isLake, ROWS, squareKey, type Square } from "./board.ts";
import { PIECE_CATALOG, type PieceTypeId } from "./pieces.ts";
import { isComplete, type PlacementState } from "./placement.ts";

/**
 * The `NAME:VERSION` ruleset tag every serialized artifact carries, per
 * `technical-notes.md`'s "Record file format" `Ruleset` tag. `PRIMARY` is
 * currently the only ruleset name/variant.
 */
export const RULESET_TAG = "PRIMARY:1.1";

/** One placed piece on the board: which side owns it and what type it is. */
export interface PlacedPiece {
  readonly side: PlacementState["side"];
  readonly pieceType: PieceTypeId;
}

/**
 * The full board, keyed by `squareKey` (absolute White frame, e.g. `"A1"`).
 * Squares absent from this map are empty; lake and buffer squares are never
 * present (only home squares can ever hold a placed piece - see placement.ts).
 */
export type BoardState = Readonly<Record<string, PlacedPiece>>;

/**
 * A completed, versioned initial game state: both armies' final placement,
 * tagged with the ruleset they were created under. This is a plain,
 * JSON-serializable structure (no `Map`s, no functions) so it round-trips
 * through `JSON.stringify`/`JSON.parse` unchanged, and is the foundation
 * Phase 2 and recorded-game replay will build on.
 */
export interface InitialGameState {
  readonly ruleset: string;
  readonly board: BoardState;
}

/**
 * Combines both players' completed placement states into a single, versioned
 * `InitialGameState` artifact. Rejects (throws) if either state belongs to
 * the wrong side or is not a complete 48-piece army - by this point in the
 * flow (both players have confirmed) both are structural invariants, not
 * recoverable user errors.
 */
export function buildInitialGameState(
  white: PlacementState,
  black: PlacementState,
): InitialGameState {
  if (white.side !== "white") {
    throw new Error(
      "buildInitialGameState: `white` must be White's placement state.",
    );
  }
  if (black.side !== "black") {
    throw new Error(
      "buildInitialGameState: `black` must be Black's placement state.",
    );
  }
  if (!isComplete(white) || !isComplete(black)) {
    throw new Error(
      "buildInitialGameState: both armies must be complete (48/48 placed) before serializing.",
    );
  }

  const board: Record<string, PlacedPiece> = {};
  for (const [key, pieceType] of white.placements) {
    board[key] = { side: "white", pieceType };
  }
  for (const [key, pieceType] of black.placements) {
    board[key] = { side: "black", pieceType };
  }

  return { ruleset: RULESET_TAG, board };
}

/** The three-character position-block cell for `square` given `board`. */
function positionBlockCell(square: Square, board: BoardState): string {
  if (isLake(square)) {
    return "XXX";
  }
  const placed = board[squareKey(square)];
  if (placed === undefined) {
    return "---";
  }
  const symbol = PIECE_CATALOG[placed.pieceType].symbol;
  return placed.side === "white" ? `[${symbol}]` : `*${symbol}*`;
}

/**
 * Renders the position-block text form of `gameState.board`: the full 12x12
 * board in White's absolute frame - row 12 at top, row 1 at bottom, column A
 * at left - as 12 lines of 12 three-character cells separated by single
 * spaces. Cell encoding: White piece `[X]`, Black piece `*X*`, empty `---`,
 * lake `XXX`, where `X` is the piece's position-block symbol. See
 * `technical-notes.md`'s "Record file format" for the source of this format.
 */
export function renderPositionBlock(gameState: InitialGameState): string {
  const rowsTopToBottom = [...ROWS].reverse();
  return rowsTopToBottom
    .map((row) =>
      COLUMNS.map((column) =>
        positionBlockCell({ column, row }, gameState.board),
      ).join(" "),
    )
    .join("\n");
}
