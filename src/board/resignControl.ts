// Pure logic behind the resign control's two-step confirmation (story
// 00000036, implementation plan Step 16, Decision 9).
//
// A resignation itself needs no acceptance and cannot be declined (rules.md
// §5.5) - `v3PlaySession.ts`'s `resign` already ends the game the instant it
// is called, and is already fully tested there (Step 13). The confirmation
// this module supports is purely the *resigning player's own* guard against
// a misclick: nothing here is game state, and nothing here is sent to (or
// read back from) the play session. It is deliberately small and separate
// from `ResignControl.tsx` so it can be unit-tested without a DOM or a
// rendering library, exactly as `v3PlaySession.ts`'s transitions are.
//
// The wording is fixed by Decision 9 and must never imply the opponent
// accepts anything - it names the side that would *win*, not the side being
// asked to agree, because there is nobody to agree.

import { otherSide, type Side } from "../rules/primary/v3/board.ts";
import { sideColorName } from "./sideNames.ts";

/**
 * The resign control's own two-step state: `confirming: false` shows a plain
 * "Resign" button; `confirming: true` shows the inline confirmation prompt
 * (Resign / Cancel).
 */
export interface ResignConfirmState {
  readonly confirming: boolean;
}

/** The control's state before the first press: not confirming. */
export function initialResignConfirmState(): ResignConfirmState {
  return { confirming: false };
}

/** Pressing "Resign" the first time opens the inline confirmation. */
export function startResignConfirmation(): ResignConfirmState {
  return { confirming: true };
}

/** Pressing "Cancel" closes the confirmation without resigning; nothing about the game changes. */
export function cancelResignConfirmation(): ResignConfirmState {
  return { confirming: false };
}

/**
 * The inline confirmation sentence (Decision 9's exact wording), naming the
 * side that would **win** if `resigningSide` goes through with it - e.g.
 * "Resign the game? Blue wins immediately. This can't be undone." Never
 * phrased as an offer or a request for the opponent's agreement: a
 * resignation needs no acceptance and cannot be declined (rules.md §5.5), so
 * this confirmation is the resigning player's own guard against a misclick
 * and nothing more.
 */
export function describeResignConfirmation(resigningSide: Side): string {
  const winner = sideColorName(otherSide(resigningSide));
  return `Resign the game? ${winner} wins immediately. This can't be undone.`;
}
