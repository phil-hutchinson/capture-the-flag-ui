// Draw-offer control and prompt (story 00000006, Step 13; focus management
// and wording added by the peer-review fixes below).
//
// Wires `playSession.ts`'s `offerDraw`/`acceptDraw`/`declineDraw` (Step 6)
// into the UI, following `PlacementStatus.tsx`'s plain-button precedent.
// Lives in the status area beside `PlayStatus` (see `App.tsx`) - the offer
// is a turn-level action, not a board-square gesture, so it is never added
// to the board grid's activation grammar (`playSession.ts`'s
// `activatableSquares` deliberately never includes it).
//
// Two mutually exclusive faces, driven by `drawOffer` (`Side | null`, from
// `PlaySession.drawOffer`):
//
//  - **no offer pending**: a plain "Offer a draw" button. `App.tsx` only
//    renders this component while the game is ongoing, so the action is
//    available to the active player on their turn and never once the game
//    is over.
//  - **an offer pending**: a prompt panel with Accept/Decline buttons while
//    one awaits an answer, naming both sides explicitly via
//    `playAnnouncement.ts`'s `describeDrawOffer` (e.g. "Red offers a draw.
//    Blue, accept or decline?") rather than composing its own wording
//    (peer-review fix, Minor 5) - so the visible prompt and the sentence
//    `App.tsx` pushes into the board's live region for the same transition
//    can never drift apart. The board is already inert while an offer is
//    pending (`playSession.ts`'s `isInert`) - this component does not
//    itself disable anything - and the board is drawn from the
//    *responder's* perspective while they answer (`playSession.ts`'s
//    `viewSide`), since a pending offer hands them the physical board even
//    though it never flips `play.sideToMove`. Naming both sides here keeps
//    the hot-seat hand-off unambiguous on top of that.
//
// `App.tsx` pushes `playAnnouncement.ts`'s `describeDrawOffer` /
// `describeDrawDecline` / `describeDrawAccepted` sentences into the board's
// existing live region for each transition. This component renders no live
// region of its own - mirroring `GameResult.tsx`'s rationale: the board's
// live region already carries the narrative, so a second one would
// double-speak it.
//
// Peer-review fix (Major 2): moves keyboard focus to whichever face just
// replaced the other on a real transition (offering a draw unmounts "Offer
// a draw" in favor of the prompt panel; a decline brings "Offer a draw"
// back), so a keyboard/screen-reader user is not left with focus stranded
// on a control that just vanished. Skips the very first render (nothing to
// transition *from* yet), so simply entering Phase 2 does not steal focus
// from wherever it already is. Each target is a *button* - never the prompt
// sentence, which the live region already speaks - so nothing is announced
// twice; while an offer is pending the target is **Decline**, the harmless
// option to fire by accident. Nothing traps focus: Tab/Shift+Tab continue
// exactly as normal from here. See the effect below.

import { useEffect, useRef } from "react";
import type { Side } from "../rules/primary/v1_1/board.ts";
import { describeDrawOffer } from "./playAnnouncement.ts";
import "./DrawOffer.css";

export interface DrawOfferProps {
  /** The side that has offered a draw and is awaiting an answer, or `null` if none is pending. */
  readonly drawOffer: Side | null;
  /** Offers a draw on behalf of the current side to move. */
  readonly onOffer: () => void;
  /** Accepts the pending offer, ending the game immediately as an agreed draw. */
  readonly onAccept: () => void;
  /** Declines the pending offer; play returns to the offering player. */
  readonly onDecline: () => void;
}

/**
 * The draw-offer control: an "Offer a draw" button when no offer is
 * pending, or a prompt panel with Accept/Decline buttons while one awaits
 * an answer.
 */
export function DrawOffer({
  drawOffer,
  onOffer,
  onAccept,
  onDecline,
}: DrawOfferProps) {
  const offerButtonRef = useRef<HTMLButtonElement>(null);
  const declineButtonRef = useRef<HTMLButtonElement>(null);
  const previousDrawOffer = useRef<Side | null | undefined>(undefined);

  // Focus targets are the owner's Gate-F decision, and are deliberately
  // *buttons* rather than the prompt sentence: `App.tsx` already pushes that
  // same sentence into the board's live region for this transition, so
  // focusing an element carrying it would make a screen reader speak it twice.
  // A button announces only its own name and role, so the sentence is heard
  // once.
  //
  // While an offer is pending, focus goes to **Decline**, not Accept: whichever
  // control holds focus can be fired by a stray Enter, and a mistaken decline
  // costs nothing (the offer can simply be made again) whereas a mistaken
  // accept would end the game. Accept remains one Tab away.
  useEffect(() => {
    const previous = previousDrawOffer.current;
    previousDrawOffer.current = drawOffer;
    if (previous === undefined || previous === drawOffer) {
      // Either the very first render (nothing to transition from), or no
      // actual change (shouldn't normally fire, since this effect's only
      // dependency is `drawOffer` itself) - do not steal focus.
      return;
    }
    if (drawOffer === null) {
      offerButtonRef.current?.focus();
    } else {
      declineButtonRef.current?.focus();
    }
  }, [drawOffer]);

  if (drawOffer === null) {
    return (
      <button
        type="button"
        className="draw-offer__offer"
        onClick={onOffer}
        ref={offerButtonRef}
      >
        Offer a draw
      </button>
    );
  }

  return (
    <div className="draw-offer-prompt" data-offering-side={drawOffer}>
      <span className="draw-offer-prompt__text">
        {describeDrawOffer(drawOffer)}
      </span>
      <button
        type="button"
        className="draw-offer-prompt__accept"
        onClick={onAccept}
      >
        Accept
      </button>
      <button
        type="button"
        className="draw-offer-prompt__decline"
        onClick={onDecline}
        ref={declineButtonRef}
      >
        Decline
      </button>
    </div>
  );
}
