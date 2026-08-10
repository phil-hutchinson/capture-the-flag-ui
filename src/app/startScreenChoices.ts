// The start screen's four choices, as plain data (story 00000034, Step 1).
// Pulling the choices out of `StartScreen.tsx` and into a React-free module
// makes their order, their copy and the hide/show filter unit-testable in
// this repository's Vitest environment, which has no DOM (see
// `rulesCopy.ts` and `figures.ts` for the same pattern). `StartScreen.tsx`
// stays a thin renderer over `visibleStartScreenChoices(START_SCREEN_CHOICES)`.
//
// Two of the four choices are hidden by a constant from
// `../featureVisibility.ts`; the other two are unconditionally visible. All
// four choices - visible or not - stay declared here, in their original
// order, with their original copy, so that flipping a visibility constant
// restores a choice exactly as it was, with nothing to edit in this file.

import {
  SHOW_PLAY_AGAINST_THE_COMPUTER,
  SHOW_REVIEW_A_GAME,
} from "../featureVisibility.ts";
import { HOW_TO_PLAY_BUTTON } from "./rules/rulesCopy.ts";

/** Stable ids for the start screen's four choices, in their display order. */
export type StartScreenChoiceId =
  "howToPlay" | "playAGame" | "playAgainstTheComputer" | "reviewAGame";

/**
 * One of the start screen's choices: its title and detail line, an optional
 * note explaining why it can't be activated (only `playAgainstTheComputer`
 * carries one), and whether it is currently shown.
 */
export interface StartScreenChoice {
  readonly id: StartScreenChoiceId;
  readonly title: string;
  readonly detail: string;
  /** Present only for a choice that is visible but not activatable. */
  readonly note?: string;
  readonly visible: boolean;
}

/**
 * All four start-screen choices, in their current display order. `visible`
 * is a literal `true` for the two choices that are never hidden, and the
 * matching constant from `../featureVisibility.ts` for the two that are.
 */
export const START_SCREEN_CHOICES: readonly StartScreenChoice[] = [
  {
    id: "howToPlay",
    title: HOW_TO_PLAY_BUTTON.title,
    detail: HOW_TO_PLAY_BUTTON.detail,
    visible: true,
  },
  {
    id: "playAGame",
    title: "Play a game",
    detail: "Two players, one device",
    visible: true,
  },
  {
    id: "playAgainstTheComputer",
    title: "Play against the computer",
    detail: "Choose a side, place your army, then play",
    note: "Not available right now - the rules changed and the computer player needs to catch up.",
    visible: SHOW_PLAY_AGAINST_THE_COMPUTER,
  },
  {
    id: "reviewAGame",
    title: "Review a game",
    detail: "Watch a recorded game",
    visible: SHOW_REVIEW_A_GAME,
  },
];

/**
 * Returns the choices that should be shown, preserving the input order.
 * Pure and order-preserving so the filter can be exercised on synthetic
 * catalogs in tests without reading the real visibility constants.
 */
export function visibleStartScreenChoices(
  choices: readonly StartScreenChoice[],
): StartScreenChoice[] {
  return choices.filter((choice) => choice.visible);
}
