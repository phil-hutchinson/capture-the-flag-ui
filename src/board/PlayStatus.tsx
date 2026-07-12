// Phase 2 turn indicator (story 00000004, Step 7).
//
// Mirrors PlacementStatus.tsx's established player-facing color convention:
// side "white" -> "Red", side "black" -> "Blue" (never the internal
// "White"/"Black" turn-order labels), and the word "move" (never "ply") in
// player-facing text.
//
// Peer-review fix (Minor 6, story 00000006): a pending draw offer (§6.6)
// does not change `sideToMove` - the board is drawn from the *responder's*
// perspective (`DrawOffer.tsx` / `playSession.ts`'s `viewSide`), but this
// status line still names the offering side as the one to move, which is
// literally correct. Left unqualified, that reads as if it contradicts the
// flipped board the responder is looking at, so while an offer is pending
// this adds "- draw offer pending" rather than hiding the turn information.

import type { Side } from "../rules/primary/v1_1/board.ts";
import { sideColorName } from "./sideNames.ts";
import "./PlayStatus.css";

export interface PlayStatusProps {
  /** The side whose turn it currently is to move. */
  readonly sideToMove: Side;
  /** True while a draw offer is pending an answer (rules.md §6.6). */
  readonly drawOfferPending?: boolean;
}

/**
 * "Red to move" / "Blue to move" - the current player's own color, never a
 * pass/skip option. While a draw offer is pending, reads "Red's turn - draw
 * offer pending" instead (owner's exact wording), since the turn has not
 * changed but the board has been handed to the other player to answer.
 */
export function PlayStatus({
  sideToMove,
  drawOfferPending = false,
}: PlayStatusProps) {
  const color = sideColorName(sideToMove);
  return (
    <div className="play-status" data-side={sideToMove}>
      <span className="play-status__side">
        {drawOfferPending
          ? `${color}'s turn — draw offer pending`
          : `${color} to move`}
      </span>
    </div>
  );
}
