// Player-facing sentences for the Tower-placement rules (story 00000025,
// Step 4): the existing spacing rule (rules §3 - no two of a side's Towers
// may touch, even diagonally) and, on a `spacing_and_lanes` edition
// (`2-1:SKIRMISH`), the new lane rule (no Tower may stand directly in front
// of a lane).
//
// Mirrors `playAnnouncement.ts`/`gameNames.ts`'s precedent for testing
// player-facing UI text as pure functions - there is no component-test
// harness in this project, so every sentence here is unit-tested directly
// against its input rather than by rendering a component.
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
//
// Step 5 adds `towerLiveRegionMessage`, the single place that resolves
// Decisions item 4's precedence (refusal wins, then the closed-squares hint,
// then the confirm-time block, then nothing) into the one string
// `PlacementStatus`'s always-mounted live region shows - so `HotSeatGame.tsx`
// never has to reason about that ordering itself.
//
// Step 8 (peer review finding #7) adds one more sentence and one more tier:
// auto-fill can find no legal arrangement for a Skirmish player's remaining
// Towers once their own hand-placed pieces have left the free squares too
// clustered. That is a transient "the action you just took didn't work"
// event, exactly like a drop-time refusal, so it is reported and cleared the
// same way and slots into the precedence right alongside it.

import { squareKey, type Square } from "../rules/primary/v2/board.ts";
import type {
  TowerLegalityResult,
  TowerLegalityViolation,
} from "../rules/primary/v2/placement.ts";

/**
 * The plain-language explanation of the lane rule itself, reused by every
 * lane-related sentence below so a player reads the same "why" wherever it
 * appears. "Lane" is explained in passing (one of the open columns running
 * through the middle of the board) rather than assumed known, per story.md.
 */
const LANE_RULE_EXPLANATION =
  "no Tower may stand directly in front of a lane, one of the open columns running through the middle of the board";

/**
 * "A3" / "A3 or D3" / "A3, D3 or H3" (and the "and" equivalents) - a
 * natural-language list of square names, in the given order. `conjunction`
 * defaults to "or", the disjunctive form used for a *prohibition* ("Towers
 * can't go on A3 or D3" - each square alone is forbidden). Callers naming
 * squares that are simultaneously true of a single army (e.g. "your Towers
 * are on A3 and D3") must pass `"and"` instead - see
 * `describeTowerLaneBlocked`, below.
 */
function listSquareNames(
  squares: readonly Square[],
  conjunction: "and" | "or" = "or",
): string {
  const names = squares.map((square) => squareKey(square));
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return names[0];
  }
  return `${names.slice(0, -1).join(", ")} ${conjunction} ${names[names.length - 1]}`;
}

/**
 * The drop-time refusal sentence (story 00000025's Step 5) for a Tower
 * placement refused specifically by the lane rule - naming the one square
 * that was just refused, why, and what to do next. E.g. "A Tower can't go on
 * A3 - no Tower may stand directly in front of a lane, one of the open
 * columns running through the middle of the board. Choose another square."
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
 * directly in front of a lane, one of the open columns running through the
 * middle of the board." Returns the empty string for an empty `closedSquares` (Battle,
 * where the lane rule closes nothing - Step 5 is not expected to call this
 * then, but an empty result is the sensible answer if it does).
 */
export function describeClosedToTowersHint(
  closedSquares: readonly Square[],
): string {
  if (closedSquares.length === 0) {
    return "";
  }
  return `Towers can't go on ${listSquareNames(closedSquares)} in this game - those squares stand directly in front of a lane, one of the open columns running through the middle of the board.`;
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
 * lane, one of the open columns running through the middle of the board - no
 * Tower may stand there. Move it to another square to finish."; (more than
 * one) "Some of your Towers are on A3 and D3, directly in front of a lane,
 * one of the open columns running through the middle of the board - no Tower
 * may stand there. Move them to other squares to finish." (Squares joined
 * with "and",
 * not "or" - unlike `describeClosedToTowersHint`'s prohibition, this sentence
 * names squares that are simultaneously true: the Towers really are on both
 * A3 and D3 at once.)
 */
export function describeTowerLaneBlocked(squares: readonly Square[]): string {
  const plural = squares.length > 1;
  const subject = plural ? "Some of your Towers are" : "One of your Towers is";
  const pronoun = plural ? "them" : "it";
  const destination = plural ? "other squares" : "another square";
  return `${subject} on ${listSquareNames(squares, "and")}, directly in front of a lane, one of the open columns running through the middle of the board - no Tower may stand there. Move ${pronoun} to ${destination} to finish.`;
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

/**
 * A drop-time refusal, paired with a monotonically increasing sequence
 * number (peer review finding #5, story 00000025): `HotSeatGame.tsx` bumps
 * `seq` every time a Tower placement is refused, including a refusal of the
 * *same* square as last time. Without a distinguishing token, refusing A3
 * twice in a row produces the identical text twice, React leaves the DOM
 * untouched, and the `aria-live="polite"` region announces nothing the
 * second time - `seq` gives the caller something that always changes so it
 * can force a fresh announcement (e.g. using it as the message element's
 * `key`).
 */
export interface TowerRefusal {
  /** `describeTowerLaneRefusal`'s result for the square that was just refused. */
  readonly text: string;
  /** Incremented on every refusal, even a repeat of the same square/text. */
  readonly seq: number;
}

/**
 * The sentence shown when Auto-fill could not place the remaining Towers
 * (story 00000025's Step 8, peer review finding #7): `placement.ts`'s
 * `autoFill` reports `{ ok: false }` when no arrangement of the remaining
 * Towers avoids two of them touching (orthogonally or diagonally) - not a
 * bug, but a board the player themselves left with too few, too clustered
 * squares free. Says what happened, why, and what to do next, in the same
 * voice as its neighbours above.
 */
export const AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE =
  "Auto-fill couldn't place your remaining Towers - there's no square left for them where two Towers wouldn't end up touching, even diagonally. Clear a few of your placed pieces and try Auto-fill again.";

/**
 * A transient "Auto-fill just failed" event (story 00000025's Step 8),
 * paired with a monotonically increasing `seq` - mirroring `TowerRefusal`'s
 * own `seq` (peer review finding #5) for the same reason: clicking Auto-fill
 * twice in a row while stuck must still announce the (identical) message
 * twice, not just once.
 */
export interface TowerAutoFillExhausted {
  /** Incremented on every exhausted Auto-fill attempt, even a repeat. */
  readonly seq: number;
}

/** The inputs `towerLiveRegionMessage` resolves into the one live-region message. */
export interface TowerLiveRegionInputs {
  /**
   * The most recent drop-time refusal, or `null` if none is currently
   * pending. Transient - the caller clears it the moment the player moves on
   * (`HotSeatGame.tsx`'s Step 5 wiring), so this is only ever non-`null` for
   * the render right after a refusal.
   */
  readonly refusal: TowerRefusal | null;
  /**
   * The most recent exhausted Auto-fill attempt (story 00000025's Step 8), or
   * `null` if none is currently pending. Transient in exactly the same way as
   * `refusal` - the caller clears it the moment the player moves on.
   */
  readonly autoFillExhausted: TowerAutoFillExhausted | null;
  /**
   * `state.side`'s closed-to-Towers squares (`squaresClosedToTowers`), but
   * only when the caller has determined a Tower is currently in hand
   * (Decisions item 3) - pass `[]` otherwise, which is also always correct on
   * Battle and under `spacing_only` regardless of what is in hand, since
   * `squaresClosedToTowers` is empty there anyway.
   */
  readonly closedSquares: readonly Square[];
  /**
   * `towerPlacementLegality`'s result, but only meaningful once the army is
   * complete (the caller passes `{ legal: true }` beforehand, matching the
   * pre-existing "only judge the confirm-time rule once everything is
   * placed" behaviour `towerAdjacencyBlocked` had before this story).
   */
  readonly legality: TowerLegalityResult;
}

/**
 * The one message `PlacementStatus`'s live region shows right now, paired
 * with a `seq` token the caller can use (e.g. as a `key`) to force a fresh
 * DOM node - and so a fresh announcement - whenever the message changes,
 * even when the new text is identical to what was already showing (peer
 * review finding #5). `seq` changes whenever a new drop-time refusal *or* a
 * new exhausted Auto-fill attempt (Step 8, second-round peer review finding
 * #14) is the reason `text` is what it is - each of those two transient
 * tiers carries its own counter (`TowerRefusal.seq` /
 * `TowerAutoFillExhausted.seq`); the hint and confirm-time tiers reuse `0`,
 * since neither reported the same "identical text twice in a row" defect.
 * Both counters restart at 1 after being cleared (`HotSeatGame.tsx`'s
 * `clearTowerFeedback`), so `seq` is only monotonic within one uninterrupted
 * run of the same tier's events - that is safe here because every clear
 * coincides with that tier no longer being the one shown (a different
 * tier's text takes its place, or the component unmounts), so a restarted
 * counter is never compared against a still-visible message carrying the
 * same value.
 */
export interface TowerLiveRegionMessage {
  readonly text: string;
  readonly seq: number;
}

/**
 * Resolves the one message `PlacementStatus`'s always-mounted live region
 * shows right now (story 00000025, Step 5; the plan's "Decisions resolved at
 * plan time", item 4, extended by Step 8's peer-review fix) - so a player is
 * never told two things by two mechanisms at once:
 *
 *  1. a drop-time refusal, if one just happened - wins outright;
 *  2. otherwise, an exhausted Auto-fill attempt, if one just happened (Step
 *     8) - the two are mutually exclusive in practice (each caller-side event
 *     clears the other), so their relative order here never matters;
 *  3. otherwise, the "Towers can't go on …" hint, if a Tower is in hand and
 *     `closedSquares` is non-empty (inert on Battle, where it is always
 *     empty);
 *  4. otherwise, the confirm-time block explanation, if `legality` reports a
 *     violation;
 *  5. otherwise, nothing (`""`).
 */
export function towerLiveRegionMessage({
  refusal,
  autoFillExhausted,
  closedSquares,
  legality,
}: TowerLiveRegionInputs): TowerLiveRegionMessage {
  if (refusal !== null) {
    return { text: refusal.text, seq: refusal.seq };
  }
  if (autoFillExhausted !== null) {
    return {
      text: AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE,
      seq: autoFillExhausted.seq,
    };
  }
  if (closedSquares.length > 0) {
    return { text: describeClosedToTowersHint(closedSquares), seq: 0 };
  }
  if (!legality.legal) {
    return { text: describeTowerLegalityViolation(legality), seq: 0 };
  }
  return { text: "", seq: 0 };
}
