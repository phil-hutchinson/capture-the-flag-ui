// The resign control (story 00000036, implementation plan Step 16, Decision
// 9) - new to this app, and rendered only for a Demotion game (major 2 has
// no resignation, rules.md §5.5). Sits beside `DrawOffer` in the same status
// area, but is its own, structurally separate control: resigning needs no
// acceptance and cannot be declined, so it must never share `DrawOffer`'s
// offer/accept/decline vocabulary or wording.
//
// Two faces, mirroring `DrawOffer.tsx`'s own two-face shape:
//
//  - **not confirming**: a plain "Resign" button.
//  - **confirming**: an inline prompt with the fixed wording from Decision 9
//    ("Resign the game? {Opponent} wins immediately. This can't be undone.",
//    `resignControl.ts`'s `describeResignConfirmation`) and two buttons,
//    **Resign** and **Cancel**.
//
// The two-step state itself is `resignControl.ts`'s pure `ResignConfirmState`
// - not game state, and never read by or written to the play session; it
// exists purely so a misclick on "Resign" cannot end the game outright. Only
// pressing **Resign** a second time, in the confirmation prompt, calls
// `onResign` (which the caller wires to `v3PlaySession.ts`'s `resign`).
//
// Focus management mirrors `DrawOffer.tsx`'s and `LeaveGameDialog.tsx`'s
// established precedent exactly: on a real transition (not the first
// render), focus moves to whichever face just replaced the other, and while
// confirming it goes to **Cancel** - the harmless option if fired by a stray
// Enter, since a mistaken Resign ends the game and a mistaken Cancel costs
// nothing (the player can simply press Resign again). Each target is a
// button, never the prompt sentence, so nothing is announced twice by a
// screen reader landing on newly-focused text.
//
// Rendered by `DemotionGame.tsx` only while the game is ongoing and no draw
// offer is pending an answer (Decision 9: "hidden while a draw offer is
// awaiting an answer" - the board is already inert in that state, and the
// pending offer is itself already a decision in progress).
//
// The confirmation prompt gets a `useId`-generated `id`, referenced by both
// **Resign** and **Cancel** via `aria-describedby`, mirroring
// `LeaveGameDialog.tsx`'s `aria-labelledby`/`aria-describedby` precedent -
// this is deliberately a local, per-button description rather than a live
// region announcement, so the sentence is spoken once, when the button that
// reads it receives focus, and not a second time as an unrequested
// interruption.
//
// `resigningSide` is supplied fresh from `session.play.sideToMove` on every
// render, so the prompt closes itself (see the `useEffect` keyed on
// `resigningSide` below) the instant the side to move changes - otherwise a
// prompt left open across a turn change would silently re-attribute itself
// to whoever is now to move, and a stray Enter from the player who never
// opened it could resign their game instead.

import { useEffect, useId, useRef, useState } from "react";
import type { Side } from "../rules/primary/v3/board.ts";
import {
  cancelResignConfirmation,
  describeResignConfirmation,
  initialResignConfirmState,
  startResignConfirmation,
} from "./resignControl.ts";
import "./ResignControl.css";

export interface ResignControlProps {
  /** The side that would be resigning - always the side currently to move. */
  readonly resigningSide: Side;
  /** Confirmed: resigns on behalf of `resigningSide`, ending the game immediately. */
  readonly onResign: () => void;
}

/** The resign control: a "Resign" button, or its own-guard inline confirmation. */
export function ResignControl({ resigningSide, onResign }: ResignControlProps) {
  const [state, setState] = useState(initialResignConfirmState());
  const resignButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousConfirming = useRef<boolean | undefined>(undefined);
  const promptId = useId();

  useEffect(() => {
    const previous = previousConfirming.current;
    previousConfirming.current = state.confirming;
    if (previous === undefined || previous === state.confirming) {
      // Either the very first render (nothing to transition from), or no
      // actual change - do not steal focus.
      return;
    }
    if (state.confirming) {
      cancelButtonRef.current?.focus();
    } else {
      resignButtonRef.current?.focus();
    }
  }, [state.confirming]);

  // The confirmation is this component's own guard, not game state (see
  // module comment) - but `resigningSide` is supplied fresh from
  // `session.play.sideToMove` on every render, so if the prompt were left
  // open across a turn change it would silently re-attribute itself to
  // whoever is now to move. Closing it the instant `resigningSide` changes
  // means the prompt can never outlive the turn it was opened on.
  useEffect(() => {
    setState(initialResignConfirmState());
  }, [resigningSide]);

  if (!state.confirming) {
    return (
      <button
        type="button"
        className="resign-control__resign"
        onClick={() => setState(startResignConfirmation())}
        ref={resignButtonRef}
      >
        Resign
      </button>
    );
  }

  return (
    <div className="resign-control-prompt">
      <span id={promptId} className="resign-control-prompt__text">
        {describeResignConfirmation(resigningSide)}
      </span>
      <button
        type="button"
        className="resign-control-prompt__resign"
        aria-describedby={promptId}
        onClick={onResign}
      >
        Resign
      </button>
      <button
        type="button"
        className="resign-control-prompt__cancel"
        aria-describedby={promptId}
        onClick={() => setState(cancelResignConfirmation())}
        ref={cancelButtonRef}
      >
        Cancel
      </button>
    </div>
  );
}
