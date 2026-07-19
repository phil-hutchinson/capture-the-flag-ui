// Placement status bar: whose turn it is, progress, auto-fill, and confirm
// (story 00000001, Step 10).
//
// This is the session-level action row, distinct from PlacementControls
// (which acts on a single selected/placed piece). It shows the active
// player's own color (never the internal "White"/"Black" turn-order labels -
// see story.md's "Players and colors"), a live "N / 25 placed" readout
// (Step 3's `progress`) - placement is sparse under rules 1.2, so a complete
// army fills only 25 of the player's 48 home squares and the rest stay empty,
// which is expected, not an error - a one-click auto-fill/randomize button
// (Step 4's `autoFill`), and the Confirm action that both stores the active
// player's layout and hands off to the next player.
//
// Story 00000016, Step 6: Confirm stays disabled until the active player's
// army is both complete *and* satisfies the Tower-adjacency rule (rules
// §3 - no two of a side's Towers may sit next to each other, not even
// diagonally). When the army is fully placed but that rule is violated, the
// button being disabled is not enough on its own - `towerAdjacencyBlocked`
// additionally surfaces a plain-language, visible explanation the player can
// act on, so the reason Confirm won't work is never a mystery.

import type { Side } from "../rules/primary/v1/board.ts";
import type { PlacementProgress } from "../rules/primary/v1/placement.ts";
import { sideColorName } from "./sideNames.ts";
import "./PlacementStatus.css";

export interface PlacementStatusProps {
  /** The active player's side, used only to pick the color name shown. */
  readonly side: Side;
  readonly progress: PlacementProgress;
  /** Whether the active player's army is complete (Confirm is enabled only then). */
  readonly canConfirm: boolean;
  /**
   * True once the active player has placed all 25 pieces but two of their
   * Towers are adjacent (orthogonally or diagonally), which is blocking
   * Confirm. Shows a plain-language explanation of what to fix.
   */
  readonly towerAdjacencyBlocked: boolean;
  /** Fills every remaining empty square with the active player's remaining pieces. */
  readonly onAutoFill: () => void;
  /** Stores the active player's layout and hands off to the next player. */
  readonly onConfirm: () => void;
}

export function PlacementStatus({
  side,
  progress,
  canConfirm,
  towerAdjacencyBlocked,
  onAutoFill,
  onConfirm,
}: PlacementStatusProps) {
  return (
    <div className="placement-status" data-side={side}>
      <span className="placement-status__side">
        {sideColorName(side)}'s turn to place their army
      </span>
      <span className="placement-status__progress">
        {progress.placed} / {progress.total} placed
      </span>
      <button
        type="button"
        onClick={onAutoFill}
        disabled={progress.placed >= progress.total}
      >
        Auto-fill
      </button>
      <button
        type="button"
        className="placement-status__confirm"
        onClick={onConfirm}
        disabled={!canConfirm}
      >
        Confirm
      </button>
      {towerAdjacencyBlocked && (
        <p className="placement-status__tower-warning" role="status">
          Two of your Towers are next to each other - no two Towers may touch,
          even diagonally. Move one apart to finish.
        </p>
      )}
    </div>
  );
}
