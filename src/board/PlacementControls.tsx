// Placement controls: return-to-tray and clear-all-board (story 00000001,
// Step 9).
//
// Move and swap are reachable purely by clicking squares on the board (see
// App.tsx's click grammar), but return-to-tray has no natural expression as
// a second square click - clicking an empty square already means "move
// here," and clicking another placed piece already means "swap." Returning
// a piece to the tray is instead an explicit action, surfaced here while a
// placed piece is selected. Clearing the whole board back to the tray is
// likewise an explicit, always-available action with no square-click
// equivalent.

import { PieceIcon } from "../art/PieceIcon.tsx";
import type { Side } from "../rules/primary/v1/board.ts";
import { PIECE_CATALOG, type PieceTypeId } from "../rules/primary/v1/pieces.ts";
import "./PlacementControls.css";

export interface PlacementControlsProps {
  /** The active player's side, used to color the selected-piece icon. */
  readonly side: Side;
  /** The type of the currently board-selected piece, if any is selected. */
  readonly selectedPieceType?: PieceTypeId;
  /** Returns the selected placed piece to the tray. */
  readonly onReturnToTray: () => void;
  /** Deselects the currently selected placed piece, leaving it in place. */
  readonly onCancelSelection: () => void;
  /** Returns every placed piece to the tray. */
  readonly onClearBoard: () => void;
  /** Whether there is anything placed to clear. */
  readonly canClear: boolean;
}

/**
 * A small action panel below the board: while a placed piece is selected, it
 * shows which piece and offers "Return to tray" / "Cancel"; a "Clear board"
 * button (disabled once the board is empty) is always shown.
 */
export function PlacementControls({
  side,
  selectedPieceType,
  onReturnToTray,
  onCancelSelection,
  onClearBoard,
  canClear,
}: PlacementControlsProps) {
  return (
    <div className="placement-controls">
      {selectedPieceType ? (
        <div className="placement-controls__selection">
          <PieceIcon
            type={selectedPieceType}
            side={side}
            className="placement-controls__icon"
          />
          <span className="placement-controls__label">
            {PIECE_CATALOG[selectedPieceType].displayName} selected - click an
            empty square to move it there, or click another placed piece to swap
            them.
          </span>
          <button type="button" onClick={onReturnToTray}>
            Return to tray
          </button>
          <button type="button" onClick={onCancelSelection}>
            Cancel
          </button>
        </div>
      ) : (
        <p className="placement-controls__hint">
          Click a placed piece to move it, swap it with another, or return it to
          the tray.
        </p>
      )}
      <button
        type="button"
        className="placement-controls__clear"
        onClick={onClearBoard}
        disabled={!canClear}
      >
        Clear board
      </button>
    </div>
  );
}
