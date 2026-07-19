// Confirmation dialog shown before leaving a hot-seat game in progress
// (story 00000014, Step 15). A finished game, and a review, leave without
// this prompt at all (see `HotSeatGame.tsx` / `ReviewScreen.tsx`) - this
// component only ever appears for a game that is still being placed or
// played, where leaving would lose it.
//
// Built on the platform's native <dialog> element, shown modally via
// `showModal()` rather than the plain `open` attribute (which would render
// it as an ordinary, non-modal block): focus containment, Escape-to-cancel
// and assistive-technology "dialog" semantics all come from the browser, per
// the story's own instruction not to add a dependency for this.
//
// Accessible name and description come from `aria-labelledby` /
// `aria-describedby` pointing at the heading and the warning paragraph
// inside. Focus moves to **Cancel** - the harmless option, following
// `DrawOffer.tsx`'s precedent of defaulting focus to whichever action costs
// nothing if fired by a stray Enter - each time the dialog opens. Focus
// returning to the control that opened it is the browser's own doing: a
// native dialog's `close()` restores focus to whatever was focused when
// `showModal()` was called (here, always the "Back to start" button that
// triggered this dialog), so nothing extra is needed for that half.

import { useEffect, useRef } from "react";
import "./LeaveGameDialog.css";

export interface LeaveGameDialogProps {
  /** Whether the confirmation prompt should be showing. */
  readonly open: boolean;
  /** Confirms leaving: the game in progress is discarded. */
  readonly onConfirm: () => void;
  /** Cancels: the game is left exactly as it was, selection included. */
  readonly onCancel: () => void;
}

/** The "leave this game?" confirmation prompt, native-<dialog>-backed. */
export function LeaveGameDialog({
  open,
  onConfirm,
  onCancel,
}: LeaveGameDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      cancelButtonRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="leave-game-dialog"
      aria-labelledby="leave-game-dialog-title"
      aria-describedby="leave-game-dialog-description"
      onCancel={(event) => {
        // The Escape key fires this (cancelable) native event just before the
        // dialog would close itself. Treat it exactly like clicking Cancel -
        // routed through the same `onCancel` prop, so the caller's `open`
        // state (and this component's own `close()` call above) stays the
        // single source of truth for whether the dialog is showing, rather
        // than letting the browser close it out from under that state.
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id="leave-game-dialog-title">Leave this game?</h2>
      <p id="leave-game-dialog-description">
        The game in progress will be lost. This can't be undone.
      </p>
      <div className="leave-game-dialog__actions">
        <button type="button" ref={cancelButtonRef} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="leave-game-dialog__confirm"
          onClick={onConfirm}
        >
          Leave game
        </button>
      </div>
    </dialog>
  );
}
