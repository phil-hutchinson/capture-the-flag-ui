// Screen-reader announcement wording for Phase 2 movement (story 00000004,
// Step 9 / Gate D).
//
// `PlayBoard`'s accessible grid (`AccessibleGrid.tsx`, Step 5) exposes a
// polite live region driven by a plain `announcement` string; nothing pushed
// text into it until this step. This module is the pure piece that decides
// *what* to say: given a `PlaySession` immediately before and immediately
// after a board-cell activation (`playSession.ts`'s `activateSquare`, Step
// 6), plus the activated square, it derives a short, player-facing sentence
// describing what just happened, per Gate D:
//
//  - selecting a piece announces the piece and how many moves it has
//    available (e.g. "Red Infantry selected, 3 moves available.");
//  - completing a move announces what moved and where, immediately followed
//    by whose turn it now is (e.g. "Red Infantry moved to A3. Blue to
//    move.") - this is deliberately the *only* place whose-turn information
//    is pushed to assistive technology, so it is never announced twice from
//    two different live regions in a way that could read as conflicting;
//    `PlayStatus` remains a plain visual indicator.
//  - deselecting a piece (activating the same square again) announces that
//    plainly.
//
// No React dependency - pure string building over `PlaySession` (from
// `playSession.ts`) and the rule-layer catalog, so it is unit-tested in the
// project's `node` Vitest environment like the rest of the rule/session
// layer.

import {
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v1_1/board.ts";
import { legalDestinations } from "../rules/primary/v1_1/movement.ts";
import { PIECE_CATALOG } from "../rules/primary/v1_1/pieces.ts";
import type { PlaySession } from "./playSession.ts";

/** Player-facing color name for a side. Internal-only; never shown as "White"/"Black". */
function sideColorName(side: Side): string {
  return side === "white" ? "Red" : "Blue";
}

/** "{Color} {Piece display name}" for whatever occupies `square` on `session`'s board. */
function pieceDescription(session: PlaySession, square: Square): string {
  const piece = session.play.board[squareKey(square)];
  if (piece === undefined) {
    // Should not happen for any of the transitions this module describes -
    // every case below only looks up a square that just held a piece - but
    // fall back to something sensible rather than throwing from an
    // announcement helper.
    return "Piece";
  }
  return `${sideColorName(piece.side)} ${PIECE_CATALOG[piece.pieceType].displayName}`;
}

/**
 * The screen-reader announcement for activating `square`, given the session
 * immediately `before` and immediately `after` that activation. Returns an
 * empty string for an activation that changed nothing (not currently
 * reachable through the UI, since only actionable cells can be activated,
 * but handled gracefully rather than throwing).
 */
export function describeActivation(
  before: PlaySession,
  after: PlaySession,
  square: Square,
): string {
  const moveApplied = after.play.moves.length > before.play.moves.length;
  if (moveApplied) {
    // `before.selection` is the piece that just moved (from its origin
    // square) - look it up on the *pre*-move board, since `square` (the
    // destination) is where it now lives on `after`'s board.
    const mover = before.selection;
    const moverDescription =
      mover !== null ? pieceDescription(before, mover) : "Piece";
    const destinationName = squareKey(square);
    const nextToMove = sideColorName(after.play.sideToMove);
    return `${moverDescription} moved to ${destinationName}. ${nextToMove} to move.`;
  }

  const selectionChanged =
    after.selection !== null &&
    (before.selection === null ||
      squareKey(before.selection) !== squareKey(after.selection));
  if (selectionChanged && after.selection !== null) {
    const description = pieceDescription(after, after.selection);
    const count = legalDestinations(after.play.board, after.selection).length;
    const moveWord = count === 1 ? "move" : "moves";
    return `${description} selected, ${count} ${moveWord} available.`;
  }

  if (before.selection !== null && after.selection === null) {
    return `${pieceDescription(before, before.selection)} deselected.`;
  }

  return "";
}
