// Move notation for ruleset major 3, written from `reference/rules.md` §4.5
// (Recording a move) alone (this story's implementation plan, Step 9) - major
// 2's own `notation.ts` was read only for folder shape, per this plan's
// version-wall constraint, and is not built on: its grammar is a different
// one (a plain `x` per square, no `=N`, and it *parses* as well as renders,
// since records are a major-2 concern this ruleset version never touches).
//
// A move is written from-square, `-`, to-square (`squareKey`, board.ts), with
// a mark placed immediately after a square describing the piece that stood
// there **when the move began**:
//
//   x    that piece did not survive the move
//   =N   that piece survived and is now rank N
//
// **In any move involving combat, each of the two squares carries exactly one
// mark - never both, never neither** (rules.md §4.5): every piece in a fight
// either dies or survives and is reduced, so there is no third case. A move
// with no combat carries no marks at all, and a Flag capture - which is not
// combat (rules.md §4.3) - marks only the captured square, never the
// capturing one: `A2-A4x` is therefore the *only* shape with one square
// marked and the other not, and it always means a Flag capture.
//
//   A2-A4      no combat
//   A2=3-A4x   attacker won; defender removed; attacker now rank 3
//   A2x-A4=2   attacker lost; defender survived and is now rank 2
//   A2x-A4x    both removed
//   A2-A4x     Flag captured (capturing the Flag is not combat)
//
// **The simplified form (`A2A4`, no marks, no separator) is never produced by
// this module, or by anything in this ruleset version.** Rules.md §4.5 itself
// says why: it cannot carry the marks above, so a game recorded that way
// cannot be replayed correctly. This plan's Decision 12 is why that matters
// here even though records are out of scope for this story: `play.ts` (below)
// stores every move in the extended form at the moment it is applied, so
// whichever follow-up story writes a record file finds the text already
// correct.
//
// This module only ever *renders* a move - there is no parser here, unlike
// major 2's, because there is nothing to parse: records are out of scope for
// major 3 (this story's out-of-scope list).
//
// Builds on the board geometry (`board.ts`, Step 1) and the combat resolution
// (`combat.ts`, Step 7), whose `CombatResult` already carries everything a
// mark needs (which of the three ordinary outcomes occurred, whether the Flag
// was captured, and the surviving piece's new rank).

import { squareKey, type Square } from "./board.ts";
import type { CombatResult } from "./combat.ts";

/**
 * The mark to place immediately after the *origin* square's token - the
 * square the attacking piece started the move from (rules.md §4.5): `"=N"`
 * when the attacker survived and was reduced to rank `N`, `"x"` when it did
 * not survive, or `""` when the move was not combat at all (a plain move, or
 * a Flag capture - which never marks the capturing piece).
 */
function originMark(combat: CombatResult | null): string {
  if (combat === null || combat.kind === "flagCapture") {
    return "";
  }
  switch (combat.outcome) {
    case "attackerWins":
      return `=${combat.survivorRank}`;
    case "attackerLoses":
    case "draw":
      return "x";
    default: {
      const exhaustive: never = combat.outcome;
      throw new Error(
        `notation.ts: originMark: unreachable outcome "${String(exhaustive)}".`,
      );
    }
  }
}

/**
 * The mark to place immediately after the *target* square's token - the
 * square the defending piece (or Flag) stood on (rules.md §4.5): `"=N"` when
 * the defender survived and was reduced to rank `N`, `"x"` when it did not
 * survive (including the Flag, on capture), or `""` for a plain move with no
 * target at all.
 */
function targetMark(combat: CombatResult | null): string {
  if (combat === null) {
    return "";
  }
  if (combat.kind === "flagCapture") {
    return "x";
  }
  switch (combat.outcome) {
    case "attackerWins":
    case "draw":
      return "x";
    case "attackerLoses":
      return `=${combat.survivorRank}`;
    default: {
      const exhaustive: never = combat.outcome;
      throw new Error(
        `notation.ts: targetMark: unreachable outcome "${String(exhaustive)}".`,
      );
    }
  }
}

/**
 * Renders a single move as extended notation (rules.md §4.5): `from`, `-`,
 * `to`, each optionally suffixed with a mark. Pass `combat` as `null` for a
 * plain move with no attack (the from-square and to-square carry no marks);
 * pass the `CombatResult` `resolveCombat` (combat.ts) returned for an attack
 * - its `kind`/`outcome`/`survivorRank` decide each square's mark, per the
 * module comment's table. `from` and `to` are taken from the caller rather
 * than read off `combat.origin`/`combat.target`, so this function renders a
 * plain move (which has no `CombatResult` to read them from) the same way it
 * renders an attack.
 */
export function renderMoveToken(
  from: Square,
  to: Square,
  combat: CombatResult | null,
): string {
  return `${squareKey(from)}${originMark(combat)}-${squareKey(to)}${targetMark(combat)}`;
}
