// Placement controls: return-to-tray and clear-all-board (story 00000001,
// Step 9; always-mounted buttons and input-neutral wording - story
// 00000002, Step 7).
//
// Move and swap are reachable purely by activating squares on the board (see
// HotSeatGame.tsx's selection grammar), but return-to-tray has no natural
// expression as a second square activation - choosing an empty square
// already means "move here," and choosing another placed piece already
// means "swap." Returning a piece to the tray is instead an explicit
// action, surfaced here while a placed piece is selected. Clearing the
// whole board back to the tray is likewise an explicit, always-available
// action with no square-activation equivalent.
//
// "Return to tray" and "Cancel" used to be rendered only while a piece was
// selected, which unmounted the focused button the moment either was
// activated - dropping a keyboard user onto `<body>` (story 00000002's
// decision 7, and its finding-#10-adjacent "focus is never dropped"
// requirement, Step 7). Both buttons - and "Clear board", which disables
// itself the moment it succeeds - now stay mounted at all times, marked
// `aria-disabled="true"` with a no-op activation when there is nothing to
// act on, exactly like `Tray.tsx`'s used-up entries (Step 6). Only the
// descriptive text above them still switches between the
// "something selected" and "nothing selected" wording.

import { PieceIcon } from "../art/PieceIcon.tsx";
import type { Side } from "../rules/primary/v2/board.ts";
import { PIECE_CATALOG, type PieceTypeId } from "../rules/primary/v2/pieces.ts";
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
 * A small action panel below the board: descriptive text switches between
 * naming the selected piece and a general hint, but "Return to tray",
 * "Cancel" and "Clear board" all stay mounted at all times, `aria-disabled`
 * (rather than removed from the tab order) whenever there is nothing for
 * them to act on.
 */
export function PlacementControls({
  side,
  selectedPieceType,
  onReturnToTray,
  onCancelSelection,
  onClearBoard,
  canClear,
}: PlacementControlsProps) {
  const hasSelection = selectedPieceType !== undefined;
  return (
    <div className="placement-controls">
      {selectedPieceType !== undefined ? (
        <div className="placement-controls__selection">
          <PieceIcon
            type={selectedPieceType}
            side={side}
            className="placement-controls__icon"
          />
          <span className="placement-controls__label">
            {PIECE_CATALOG[selectedPieceType].displayName} selected - choose an
            empty square to move it there, or another placed piece to swap them.
          </span>
        </div>
      ) : (
        <p className="placement-controls__hint">
          Select a placed piece to move it, swap it with another, or return it
          to the tray.
        </p>
      )}
      <div className="placement-controls__actions">
        <button
          type="button"
          aria-disabled={!hasSelection}
          onClick={() => {
            if (!hasSelection) {
              return;
            }
            onReturnToTray();
          }}
        >
          Return to tray
        </button>
        <button
          type="button"
          aria-disabled={!hasSelection}
          onClick={() => {
            if (!hasSelection) {
              return;
            }
            onCancelSelection();
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="placement-controls__clear"
          aria-disabled={!canClear}
          onClick={() => {
            if (!canClear) {
              return;
            }
            onClearBoard();
          }}
        >
          Clear board
        </button>
      </div>
    </div>
  );
}
