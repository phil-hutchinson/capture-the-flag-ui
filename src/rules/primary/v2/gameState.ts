// Versioned initial game-state serialization for ruleset major 2.
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
// This module builds on the board geometry (Step 1; parametric over a
// `BoardLayout` since story 00000023's Step 3), the piece catalog (Step 2),
// the placement-state model (Step 3), and the edition registry
// (`edition.ts`, story 00000023's Step 2); it has no further dependencies.
//
// The position-block render/parse (`renderPositionBlock`/`parsePositionBlock`)
// are sized to a `BoardLayout` rather than the fixed 12x12 grid:
// `renderPositionBlock` reads it off `gameState.edition` (defaulting to
// Battle when omitted - see `InitialGameState`'s doc comment);
// `parsePositionBlock` takes it as an optional parameter, also defaulting to
// Battle.

import {
  BATTLE_LAYOUT,
  columnsOf,
  isLake,
  rowsOf,
  squareKey,
  type Side,
  type Square,
} from "./board.ts";
import type { BoardLayout } from "./boardLayout.ts";
import { armySize } from "./armyComposition.ts";
import { EDITIONS, type Edition } from "./edition.ts";
import { PIECE_CATALOG, PIECE_TYPES, type PieceTypeId } from "./pieces.ts";
import { isComplete, type PlacementState } from "./placement.ts";

/** The edition `buildInitialGameState`/position-block rendering falls back to when none is given. */
const DEFAULT_EDITION: Edition = EDITIONS["2-0:BATTLE"];

/**
 * The `Ruleset` record tag value for the default edition (`2-0:BATTLE`),
 * per `technical-notes.md`'s "editions and flags" model: the tag is the
 * full edition id, with no deviating flags (story 00000023's Step 8). This
 * remains exported (rather than removed) because many fixtures elsewhere in
 * this codebase build an `InitialGameState`/`PlayState` with no `edition`
 * field - defaulting, like every other consumer, to Battle - and use this
 * constant as their matching `ruleset` tag. `buildInitialGameState` below
 * does **not** use this constant directly; it tags every artifact with the
 * *actual* resolved edition's id, so a Skirmish game is correctly tagged
 * `2-0:SKIRMISH`, not this Battle default.
 */
export const RULESET_TAG: string = DEFAULT_EDITION.id;

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
 * tagged with the ruleset they were created under, and (story 00000023's
 * Step 3) the resolved `edition` the board was built for - the parametric
 * board geometry a later step's rendering/records read rather than assuming
 * Battle's 12x12. `edition` is **optional** so hand-built fixtures from
 * earlier stories (and this story's own tests, and the frozen encoding/engine
 * modules' fixtures) that predate this field remain valid: every function
 * here treats a missing `edition` as Battle, exactly today's behavior. This
 * is a plain, JSON-serializable structure (no `Map`s, no functions) so it
 * round-trips through `JSON.stringify`/`JSON.parse` unchanged, and is the
 * foundation Phase 2 and recorded-game replay will build on.
 */
export interface InitialGameState {
  readonly ruleset: string;
  readonly edition?: Edition;
  readonly board: BoardState;
}

/**
 * Combines both players' completed placement states into a single, versioned
 * `InitialGameState` artifact, tagged with `edition` (defaults to Battle) and
 * a `ruleset` string equal to `edition.id` - the full edition id, with no
 * deviating flags, exactly the `Ruleset` record tag `renderGameRecord`
 * (play.ts) writes (story 00000023's Step 8). Rejects (throws) if either
 * state belongs to the wrong side, was placed on a different board layout
 * than `edition`'s, or is not a complete army for its own roster (Battle 25
 * pieces, Skirmish 16) - by this point in the flow (both players have
 * confirmed) all three are structural invariants, not recoverable user
 * errors.
 */
export function buildInitialGameState(
  white: PlacementState,
  black: PlacementState,
  edition: Edition = DEFAULT_EDITION,
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
  if (
    white.boardLayout.id !== edition.boardLayoutId ||
    black.boardLayout.id !== edition.boardLayoutId
  ) {
    throw new Error(
      `buildInitialGameState: both placement states must be on ${edition.boardLayoutId} for ${edition.id}.`,
    );
  }
  if (!isComplete(white) || !isComplete(black)) {
    const size = armySize(edition.army);
    throw new Error(
      `buildInitialGameState: both armies must be complete (${size}/${size} placed) before serializing.`,
    );
  }

  const board: Record<string, PlacedPiece> = {};
  for (const [key, pieceType] of white.placements) {
    board[key] = { side: "white", pieceType };
  }
  for (const [key, pieceType] of black.placements) {
    board[key] = { side: "black", pieceType };
  }

  return { ruleset: edition.id, edition, board };
}

/** The three-character position-block cell for `square` given `board` and `layout`. */
function positionBlockCell(
  square: Square,
  board: BoardState,
  layout: BoardLayout,
): string {
  if (isLake(square, layout)) {
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
 * Renders the position-block text form of `gameState.board`: the full board
 * - sized to `gameState.edition`'s `BoardLayout` (Battle's 12x12 if
 * `edition` is omitted) - in White's absolute frame - highest row at top,
 * row 1 at bottom, column A at left - as one line per row of three-character
 * cells separated by single spaces. Cell encoding: White piece `[X]`, Black
 * piece `*X*`, empty `---`, lake `XXX`, where `X` is the piece's
 * position-block symbol. See `technical-notes.md`'s "Record file format" for
 * the source of this format.
 */
export function renderPositionBlock(gameState: InitialGameState): string {
  const layout = gameState.edition?.boardLayout ?? BATTLE_LAYOUT;
  const rowsTopToBottom = [...rowsOf(layout)].reverse();
  const columns = columnsOf(layout);
  return rowsTopToBottom
    .map((row) =>
      columns
        .map((column) =>
          positionBlockCell({ column, row }, gameState.board, layout),
        )
        .join(" "),
    )
    .join("\n");
}

/** Reverse lookup: position-block symbol -> piece type id (see `pieces.ts`). */
const PIECE_TYPE_BY_SYMBOL: Readonly<Record<string, PieceTypeId>> =
  Object.fromEntries(PIECE_TYPES.map((id) => [PIECE_CATALOG[id].symbol, id]));

/**
 * Everything that can go wrong parsing a position block, per
 * `parsePositionBlock`: a wrong overall shape (not the layout's row count, or
 * a row that is not the layout's column count), a cell matching none of the
 * four cell forms, a piece symbol not in `PIECE_CATALOG`, or a mismatch
 * between a cell's lake marking and `isLake` for that square. These are
 * structured for callers (recordFile.ts, Step 3) to word into a player-facing
 * message; this module never produces text itself. `wrongRowCount` and
 * `wrongCellCount` carry the `layout`'s own expected count alongside what was
 * actually found (story 00000023's Gate D defect fix), so the player-facing
 * wording (`reviewText.ts`) can name the *right* board size instead of
 * assuming Battle's fixed 12x12 regardless of which edition was being parsed.
 */
export type PositionBlockError =
  | {
      readonly kind: "wrongRowCount";
      readonly rowCount: number;
      readonly expectedRowCount: number;
    }
  | {
      readonly kind: "wrongCellCount";
      readonly row: Square["row"];
      readonly cellCount: number;
      readonly expectedCellCount: number;
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
 * the block is not a valid board for `layout` (defaults to Battle's 12x12).
 * Accepts exactly what `renderPositionBlock` writes for that layout, plus
 * reasonable whitespace slop: CRLF or LF line endings, leading/trailing
 * spaces on a line, extra spaces between cells, and blank lines (tolerated
 * wherever they fall, not just at the edges). Terrain *is* checked - a lake
 * cell (`XXX`) must land exactly on one of `layout`'s lake squares
 * (`isLake`), and a lake square's cell must be `XXX` - because the position
 * block draws the full board including terrain, so a mismatch is not a valid
 * rendering of any board; this is the format's own self-description, not a
 * rules check. Army composition and piece counts are not checked - any
 * position, including a partial one, is accepted. Never throws.
 */
export function parsePositionBlock(
  text: string,
  layout: BoardLayout = BATTLE_LAYOUT,
): PositionBlockResult {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length !== layout.rowCount) {
    return {
      kind: "error",
      error: {
        kind: "wrongRowCount",
        rowCount: lines.length,
        expectedRowCount: layout.rowCount,
      },
    };
  }

  const rowsTopToBottom = [...rowsOf(layout)].reverse();
  const columns = columnsOf(layout);
  const board: Record<string, PlacedPiece> = {};

  for (const [lineIndex, line] of lines.entries()) {
    const row = rowsTopToBottom[lineIndex];
    const cells = line.split(/\s+/);
    if (cells.length !== layout.columnCount) {
      return {
        kind: "error",
        error: {
          kind: "wrongCellCount",
          row,
          cellCount: cells.length,
          expectedCellCount: layout.columnCount,
        },
      };
    }

    for (const [columnIndex, cellText] of cells.entries()) {
      const column = columns[columnIndex];
      const square: Square = { column, row };
      const parsedCell = parseCell(cellText);

      if (parsedCell === undefined) {
        return {
          kind: "error",
          error: { kind: "unrecognizedCell", square, cell: cellText },
        };
      }

      const onLake = isLake(square, layout);

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
