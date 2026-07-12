// Draw-offer control and prompt (story 00000006, Step 13).
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
//  - **an offer pending**: a prompt panel naming both sides explicitly
//    (e.g. "Red offers a draw. Blue, do you accept?"), with Accept/Decline
//    buttons. The board is already inert while an offer is pending
//    (`playSession.ts`'s `isInert`) - this component does not itself
//    disable anything - and the board is drawn from the *responder's*
//    perspective while they answer (`playSession.ts`'s `viewSide`), since a
//    pending offer hands them the physical board even though it never flips
//    `play.sideToMove`. Naming both sides here keeps the hot-seat hand-off
//    unambiguous on top of that.
//
// `App.tsx` pushes `playAnnouncement.ts`'s `describeDrawOffer` /
// `describeDrawDecline` / `describeDrawAccepted` sentences into the board's
// existing live region for each transition. This component renders no live
// region of its own - mirroring `GameResult.tsx`'s rationale: the board's
// live region already carries the narrative, so a second one would
// double-speak it.

import type { Side } from "../rules/primary/v1_1/board.ts";
import "./DrawOffer.css";

/** Player-facing color name for a side. Internal-only; never shown as "White"/"Black". */
function sideColorName(side: Side): string {
  return side === "white" ? "Red" : "Blue";
}

/** The other side. Internal-only turn-order helper (mirrors `playAnnouncement.ts`'s private `otherSide`). */
function otherSide(side: Side): Side {
  return side === "white" ? "black" : "white";
}

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
  if (drawOffer === null) {
    return (
      <button type="button" className="draw-offer__offer" onClick={onOffer}>
        Offer a draw
      </button>
    );
  }

  const offerer = sideColorName(drawOffer);
  const opponent = sideColorName(otherSide(drawOffer));

  return (
    <div className="draw-offer-prompt" data-offering-side={drawOffer}>
      <span className="draw-offer-prompt__text">
        {offerer} offers a draw. {opponent}, do you accept?
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
      >
        Decline
      </button>
    </div>
  );
}
