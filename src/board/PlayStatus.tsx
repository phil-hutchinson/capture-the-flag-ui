// Phase 2 turn indicator (story 00000004, Step 7).
//
// Mirrors PlacementStatus.tsx's established player-facing color convention:
// side "white" -> "Red", side "black" -> "Blue" (never the internal
// "White"/"Black" turn-order labels), and the word "move" (never "ply") in
// player-facing text.

import type { Side } from "../rules/primary/v1_1/board.ts";
import "./PlayStatus.css";

/** Player-facing color name for a side. Internal-only; never shown as "White"/"Black". */
function sideColorName(side: Side): string {
  return side === "white" ? "Red" : "Blue";
}

export interface PlayStatusProps {
  /** The side whose turn it currently is to move. */
  readonly sideToMove: Side;
}

/** "Red to move" / "Blue to move" - the current player's own color, never a pass/skip option. */
export function PlayStatus({ sideToMove }: PlayStatusProps) {
  return (
    <div className="play-status" data-side={sideToMove}>
      <span className="play-status__side">
        {sideColorName(sideToMove)} to move
      </span>
    </div>
  );
}
