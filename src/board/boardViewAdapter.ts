// Major 2's board-view adapter (story 00000036, Step 11).
//
// Turns major 2's own rule-layer board model - a `BoardLayout`
// (`src/rules/primary/v2/boardLayout.ts`) and a `BoardState`
// (`src/rules/primary/v2/gameState.ts`) - into the major-agnostic
// `BoardGeometry`/`BoardPosition` `FullBoard.tsx` now renders
// (`src/board/view/viewModel.ts`). Lives in `src/board/`, not in
// `src/rules/` or in `src/board/view/`: this is the seam *above* both
// majors' rules layers - major 2 is adapted onto it, never rewritten
// beneath it (implementation plan, Decision 1) - so it is the only module
// that imports both the rules layer and the view layer for major 2's sake.
//
// `boardGeometryFor` reads `layout`'s lake squares (`isLake`) into
// `BoardGeometry.impassableSquares`, so `FullBoard`'s lake icon and "lake"
// square label - unchanged by this step - come from exactly the same
// squares they always have. `boardPositionFor` reads each occupied square's
// side, art (via Step 10's `pieceArtByType.ts` adapter) and player-facing
// name (`PIECE_CATALOG`'s `displayName`, unchanged) into a `BoardToken`.

import { allSquares, isLake, squareKey } from "../rules/primary/v2/board.ts";
import type { BoardLayout } from "../rules/primary/v2/boardLayout.ts";
import type { BoardState } from "../rules/primary/v2/gameState.ts";
import { PIECE_CATALOG } from "../rules/primary/v2/pieces.ts";
import { pieceArtForType } from "./pieceArtByType.ts";
import type {
  BoardGeometry,
  BoardPosition,
  BoardToken,
} from "./view/viewModel.ts";

/** The `BoardGeometry` for `layout`: its dimensions, and its lake squares as impassable. */
export function boardGeometryFor(layout: BoardLayout): BoardGeometry {
  const impassableSquares = new Set<string>();
  for (const square of allSquares(layout)) {
    if (isLake(square, layout)) {
      impassableSquares.add(squareKey(square));
    }
  }
  return {
    columnCount: layout.columnCount,
    rowCount: layout.rowCount,
    impassableSquares,
  };
}

/** The `BoardPosition` for `board`: one `BoardToken` per occupied square, keyed as `board` itself is. */
export function boardPositionFor(board: BoardState): BoardPosition {
  const tokens: Record<string, BoardToken> = {};
  for (const [key, piece] of Object.entries(board)) {
    tokens[key] = {
      side: piece.side,
      art: pieceArtForType(piece.pieceType),
      label: PIECE_CATALOG[piece.pieceType].displayName,
    };
  }
  return { tokens };
}
