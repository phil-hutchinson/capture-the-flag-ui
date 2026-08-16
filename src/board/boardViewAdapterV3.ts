// Major 3's board-view adapter (story 00000036, Step 14).
//
// The sibling of `boardViewAdapter.ts` (major 2's own): turns major 3's
// rule-layer board model - the fixed board geometry
// (`src/rules/primary/v3/board.ts`) and a `PositionState`
// (`src/rules/primary/v3/position.ts`) - into the major-agnostic
// `BoardGeometry`/`BoardPosition` `FullBoard.tsx` renders
// (`src/board/view/viewModel.ts`). Lives in `src/board/`, not in
// `src/rules/` or in `src/board/view/`: this is the seam *above* both
// majors' rules layers - major 3 is adapted onto it, never rewritten
// beneath it (implementation plan, Decision 1) - so it is the only module
// that imports both the v3 rules layer and the view layer for major 3's
// sake.
//
// `boardGeometryForDemotion` takes no argument at all: unlike major 2's
// per-edition `BoardLayout`, major 3's board is fixed at 8x8 with **no
// impassable terrain of any kind** (rules.md §2.1 - "no lakes, no lanes, no
// buffer rows"), so `impassableSquares` is simply empty every time.
// `boardPositionForDemotion` reads each occupied square's side, art (Step
// 10's `pieceArtByRank.ts`) and player-facing occupant label into a
// `BoardToken`: a numbered piece reads "{Rank name}, rank {N}" (e.g.
// "Master-of-Arms, rank 5") rather than the name alone, since - unlike major
// 2 - a major-3 piece's rank is mutable and can change mid-game
// (`position.ts`'s own header comment); re-reading a square always confirms
// its *current* rank this way. The Flag reads plainly, "Flag".

import { COLUMN_COUNT, ROW_COUNT } from "../rules/primary/v3/board.ts";
import { FLAG_DISPLAY_NAME, RANK_CATALOG } from "../rules/primary/v3/pieces.ts";
import type {
  PlacedPiece,
  PositionState,
} from "../rules/primary/v3/position.ts";
import { pieceArtForRankOrFlag } from "./pieceArtByRank.ts";
import type {
  BoardGeometry,
  BoardPosition,
  BoardToken,
} from "./view/viewModel.ts";

/**
 * The `BoardGeometry` for a Demotion game: the fixed 8x8 board, with no
 * impassable squares (see module comment). Takes no argument - unlike major
 * 2, major 3 has exactly one board.
 */
export function boardGeometryForDemotion(): BoardGeometry {
  return {
    columnCount: COLUMN_COUNT,
    rowCount: ROW_COUNT,
    impassableSquares: new Set(),
  };
}

/**
 * The occupant label for `piece`: "{Rank name}, rank {N}" for a numbered
 * piece (e.g. "Master-of-Arms, rank 5"), or "Flag" for the Flag - see module
 * comment for why a numbered piece's label always names its current rank.
 */
function occupantLabel(piece: PlacedPiece): string {
  if (piece.kind === "flag") {
    return FLAG_DISPLAY_NAME;
  }
  return `${RANK_CATALOG[piece.rank].displayName}, rank ${piece.rank}`;
}

/** The `BoardPosition` for `board`: one `BoardToken` per occupied square, keyed as `board` itself is. */
export function boardPositionForDemotion(board: PositionState): BoardPosition {
  const tokens: Record<string, BoardToken> = {};
  for (const [key, piece] of Object.entries(board)) {
    tokens[key] = {
      side: piece.side,
      art: pieceArtForRankOrFlag(piece.kind === "flag" ? "flag" : piece.rank),
      label: occupantLabel(piece),
    };
  }
  return { tokens };
}
