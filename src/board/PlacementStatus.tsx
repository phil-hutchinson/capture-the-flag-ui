// Placement status bar: whose turn it is, progress, auto-fill, and confirm
// (story 00000001, Step 10).
//
// This is the session-level action row, distinct from PlacementControls
// (which acts on a single selected/placed piece). It shows the active
// player's own color (never the internal "White"/"Black" turn-order labels -
// see story.md's "Players and colors"), a live "N / 48 placed" readout
// (Step 3's `progress`), a one-click auto-fill/randomize button (Step 4's
// `autoFill`), and the Confirm action that both stores the active player's
// layout and hands off to the next player - Confirm stays disabled until the
// active player's army is complete.

import type { Side } from "../rules/primary/v1_1/board.ts";
import type { PlacementProgress } from "../rules/primary/v1_1/placement.ts";
import "./PlacementStatus.css";

/** Player-facing color name for a side. Internal-only; never shown as "White"/"Black". */
function sideColorName(side: Side): string {
  return side === "white" ? "Red" : "Blue";
}

export interface PlacementStatusProps {
  /** The active player's side, used only to pick the color name shown. */
  readonly side: Side;
  readonly progress: PlacementProgress;
  /** Whether the active player's army is complete (Confirm is enabled only then). */
  readonly canConfirm: boolean;
  /** Fills every remaining empty square with the active player's remaining pieces. */
  readonly onAutoFill: () => void;
  /** Stores the active player's layout and hands off to the next player. */
  readonly onConfirm: () => void;
}

export function PlacementStatus({
  side,
  progress,
  canConfirm,
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
    </div>
  );
}
