// Player-facing sentences for the Tower-placement rules (story 00000025,
// Step 4): the existing spacing rule (rules §3 - no two of a side's Towers
// may touch, even diagonally) and, on a `spacing_and_lanes` edition
// (`2-1:SKIRMISH`), the new lane rule (no Tower may stand directly in front
// of a lane).
//
// Mirrors `playAnnouncement.ts`/`gameNames.ts`'s precedent for testing
// player-facing UI text as pure functions - there is no component-test
// harness in this project, so every sentence here is unit-tested directly
// against its input rather than by rendering a component. Nothing here is
// wired into a live region yet; that is story 00000025's Step 5.
//
// Both rules are one rule family, surfaced in one voice (the plan's
// "Decisions resolved at plan time", item 1): every sentence below follows
// the same shape - what is wrong, why, and what to do - and the spacing and
// lane sentences always read as distinguishable problems (Gate A). "Lane" is
// player-facing vocabulary (rules.md's glossary), but is explained in
// passing rather than assumed known, per story.md's "Players and colors".
// Sides are never named here - a Tower-placement message only ever concerns
// the active player's own army, so `PlacementStatus`'s existing "{Color}'s
// turn to place their army" heading already establishes whose army is being
// discussed.

import { squareKey, type Square } from "../rules/primary/v2/board.ts";
import type { TowerLegalityViolation } from "../rules/primary/v2/placement.ts";

/**
 * The plain-language explanation of the lane rule itself, reused by every
 * lane-related sentence below so a player reads the same "why" wherever it
 * appears. "Lane" is explained in passing (the open column through the
 * middle of the board) rather than assumed known, per story.md.
 */
const LANE_RULE_EXPLANATION =
  "no Tower may stand directly in front of a lane, the open column running through the middle of the board";

/** "A3" / "A3 or D3" / "A3, D3 or H3" - a natural-language list of square names, in the given order. */
function listSquareNames(squares: readonly Square[]): string {
  const names = squares.map((square) => squareKey(square));
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return names[0];
  }
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/**
 * The drop-time refusal sentence (story 00000025's Step 5) for a Tower
 * placement refused specifically by the lane rule - naming the one square
 * that was just refused, why, and what to do next. E.g. "A Tower can't go on
 * A3 - no Tower may stand directly in front of a lane, the open column
 * running through the middle of the board. Choose another square."
 */
export function describeTowerLaneRefusal(square: Square): string {
  return `A Tower can't go on ${squareKey(square)} - ${LANE_RULE_EXPLANATION}. Choose another square.`;
}

/**
 * The hint shown while a Tower is in hand (story.md's Design decisions - "the
 * closed squares should be visible, not just enforced"; Step 5 shows it only
 * while a Tower is selected from the tray or picked up from the board),
 * naming every one of the active player's own closed squares at once. E.g.
 * "Towers can't go on A3, D3, E3 or H3 in this game - those squares stand
 * directly in front of a lane, the open column running through the middle of
 * the board." Returns the empty string for an empty `closedSquares` (Battle,
 * where the lane rule closes nothing - Step 5 is not expected to call this
 * then, but an empty result is the sensible answer if it does).
 */
export function describeClosedToTowersHint(
  closedSquares: readonly Square[],
): string {
  if (closedSquares.length === 0) {
    return "";
  }
  return `Towers can't go on ${listSquareNames(closedSquares)} in this game - those squares stand directly in front of a lane, the open column running through the middle of the board.`;
}

/**
 * The existing confirm-time Tower-spacing block sentence (story 00000016,
 * Step 6's `PlacementStatus.tsx`, moved here unchanged by story 00000025's
 * Step 4 so both Tower rules' sentences live in one module). Shown when
 * `towerPlacementLegality` reports a `"spacing"` violation.
 */
export const TOWER_SPACING_BLOCKED_MESSAGE =
  "Two of your Towers are next to each other - no two Towers may touch, even diagonally. Move one apart to finish.";

/**
 * The confirm-time block sentence for a `"lane"` violation (story 00000025's
 * Step 4/5) - the backstop case (the plan's "Decisions resolved at plan
 * time", item 2): drop-time refusal should mean a player never reaches this,
 * but `towerPlacementLegality` still reports it, so Confirm always has an
 * explanation to show. Names every currently-placed Tower that is in
 * violation. E.g. (one) "One of your Towers is on A3, directly in front of a
 * lane, the open column running through the middle of the board - no Tower
 * may stand there. Move it to another square to finish."; (more than one)
 * "Some of your Towers are on A3 or D3, directly in front of a lane, the open
 * column running through the middle of the board - no Tower may stand there.
 * Move them to other squares to finish."
 */
export function describeTowerLaneBlocked(squares: readonly Square[]): string {
  const plural = squares.length > 1;
  const subject = plural ? "Some of your Towers are" : "One of your Towers is";
  const pronoun = plural ? "them" : "it";
  const destination = plural ? "other squares" : "another square";
  return `${subject} on ${listSquareNames(squares)}, directly in front of a lane, the open column running through the middle of the board - no Tower may stand there. Move ${pronoun} to ${destination} to finish.`;
}

/**
 * The confirm-time block sentence for `towerPlacementLegality`'s violation,
 * whichever rule it names - `TOWER_SPACING_BLOCKED_MESSAGE` for `"spacing"`,
 * `describeTowerLaneBlocked` for `"lane"`. The single place the UI (Step 5)
 * turns a structured violation into the sentence `PlacementStatus`'s live
 * region shows when Confirm is blocked.
 */
export function describeTowerLegalityViolation(
  violation: TowerLegalityViolation,
): string {
  if (violation.rule === "spacing") {
    return TOWER_SPACING_BLOCKED_MESSAGE;
  }
  return describeTowerLaneBlocked(violation.squares);
}
