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

import {
  COLUMNS,
  isLake,
  ROWS,
  squareKey,
  type Side,
  type Square,
} from "./board.ts";
import { PIECE_CATALOG, PIECE_TYPES, type PieceTypeId } from "./pieces.ts";
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

/** Reverse lookup: position-block symbol -> piece type id (see `pieces.ts`). */
const PIECE_TYPE_BY_SYMBOL: Readonly<Record<string, PieceTypeId>> =
  Object.fromEntries(PIECE_TYPES.map((id) => [PIECE_CATALOG[id].symbol, id]));

/**
 * Everything that can go wrong parsing a position block, per
 * `parsePositionBlock`: a wrong overall shape (not 12 rows, or a row that is
 * not 12 cells), a cell matching none of the four cell forms, a piece symbol
 * not in `PIECE_CATALOG`, or a mismatch between a cell's lake marking and
 * `isLake` for that square. These are structured for callers (recordFile.ts,
 * Step 3) to word into a player-facing message; this module never produces
 * text itself.
 */
export type PositionBlockError =
  | { readonly kind: "wrongRowCount"; readonly rowCount: number }
  | {
      readonly kind: "wrongCellCount";
      readonly row: Square["row"];
      readonly cellCount: number;
    }
  | {
      readonly kind: "unrecognizedCell";
      readonly square: Square;
      readonly cell: string;
    }
  | {
      readonly kind: "unknownPieceSymbol";
      readonly square: Square;
      readonly symbol: string;
    }
  | { readonly kind: "lakeCellOffLake"; readonly square: Square }
  | {
      readonly kind: "lakeSquareNotXxx";
      readonly square: Square;
      readonly cell: string;
    };

/** The result of parsing a position block: a `BoardState`, or a structured error. Never throws. */
export type PositionBlockResult =
  | { readonly kind: "parsed"; readonly board: BoardState }
  | { readonly kind: "error"; readonly error: PositionBlockError };

/** One already-recognized cell token, before it is checked against `isLake` and `PIECE_CATALOG`. */
type ParsedCell =
  | { readonly kind: "empty" }
  | { readonly kind: "lake" }
  | { readonly kind: "piece"; readonly side: Side; readonly symbol: string };

/** A single cell token's shape: `---`, `XXX`, `[X]` (White) or `*X*` (Black). */
const WHITE_PIECE_CELL = /^\[(.)\]$/;
const BLACK_PIECE_CELL = /^\*(.)\*$/;

/** Parses one cell token already split out of a line; `undefined` if it matches none of the four forms. */
function parseCell(cell: string): ParsedCell | undefined {
  if (cell === "---") {
    return { kind: "empty" };
  }
  if (cell === "XXX") {
    return { kind: "lake" };
  }
  const whiteMatch = WHITE_PIECE_CELL.exec(cell);
  if (whiteMatch !== null) {
    return { kind: "piece", side: "white", symbol: whiteMatch[1] };
  }
  const blackMatch = BLACK_PIECE_CELL.exec(cell);
  if (blackMatch !== null) {
    return { kind: "piece", side: "black", symbol: blackMatch[1] };
  }
  return undefined;
}

/**
 * Parses the position-block text form (see `renderPositionBlock`, its
 * inverse) back into a `BoardState`, or a structured `PositionBlockError` if
 * the block is not a valid 12x12 board. Accepts exactly what
 * `renderPositionBlock` writes, plus reasonable whitespace slop: CRLF or LF
 * line endings, leading/trailing spaces on a line, extra spaces between
 * cells, and blank lines (tolerated wherever they fall, not just at the
 * edges). Terrain *is* checked - a lake cell (`XXX`) must land exactly on one
 * of the 12 lake squares (`isLake`), and a lake square's cell must be `XXX` -
 * because the position block draws the full board including terrain, so a
 * mismatch is not a valid rendering of any board; this is the format's own
 * self-description, not a rules check. Army composition and piece counts are
 * not checked - any position, including a partial one, is accepted. Never
 * throws.
 */
export function parsePositionBlock(text: string): PositionBlockResult {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length !== 12) {
    return {
      kind: "error",
      error: { kind: "wrongRowCount", rowCount: lines.length },
    };
  }

  const rowsTopToBottom = [...ROWS].reverse();
  const board: Record<string, PlacedPiece> = {};

  for (const [lineIndex, line] of lines.entries()) {
    const row = rowsTopToBottom[lineIndex];
    const cells = line.split(/\s+/);
    if (cells.length !== 12) {
      return {
        kind: "error",
        error: { kind: "wrongCellCount", row, cellCount: cells.length },
      };
    }

    for (const [columnIndex, cellText] of cells.entries()) {
      const column = COLUMNS[columnIndex];
      const square: Square = { column, row };
      const parsedCell = parseCell(cellText);

      if (parsedCell === undefined) {
        return {
          kind: "error",
          error: { kind: "unrecognizedCell", square, cell: cellText },
        };
      }

      const onLake = isLake(square);

      if (parsedCell.kind === "lake") {
        if (!onLake) {
          return { kind: "error", error: { kind: "lakeCellOffLake", square } };
        }
        continue;
      }

      if (onLake) {
        return {
          kind: "error",
          error: { kind: "lakeSquareNotXxx", square, cell: cellText },
        };
      }

      if (parsedCell.kind === "empty") {
        continue;
      }

      const pieceType = PIECE_TYPE_BY_SYMBOL[parsedCell.symbol];
      if (pieceType === undefined) {
        return {
          kind: "error",
          error: {
            kind: "unknownPieceSymbol",
            square,
            symbol: parsedCell.symbol,
          },
        };
      }

      board[squareKey(square)] = { side: parsedCell.side, pieceType };
    }
  }

  return { kind: "parsed", board };
}
