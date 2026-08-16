// Combat resolution for ruleset major 3, written from `reference/rules.md`
// §4.3 (Combat, including its "Rank reduction" and "Sacrificial attacks"
// subsections) and its Glossary entries for "Formation bonus", "Rank
// reduction" and "Sacrificial attack" alone (this story's implementation
// plan, Step 7) - major 2 has no formation bonus, no rank reduction and no
// mutable piece rank at all, so there is nothing there to copy from.
//
// This module resolves what happens when a piece already known to be
// attacking (`movement.ts`'s `legalAttacks` decided that it may - sacrificial
// attacks are always legal there, so this module never re-checks relative
// strength before resolving) moves onto an enemy-occupied square:
//
// - **Higher rank wins**: the defender is removed and the attacker advances
//   onto the target square.
// - **Attacker loses**: the attacker is removed; the defender stays where it
//   is.
// - **Equal rank**: a draw - both pieces are removed, the square left empty.
//
// **Formation bonus** (§4.3, glossary "Formation bonus"): a piece with a
// *friendly piece of equal rank* on any of its eight surrounding squares
// (orthogonal or diagonal) draws against a piece exactly one rank stronger,
// instead of losing - both are removed. Checked for the attacker at its
// *origin* square, before its move, and for the defender at the moment it is
// attacked - both read against the position as it stood *before* this
// combat, since the attacker has not yet moved when either check happens.
// The check is always against the position's *current* ranks, recomputed
// fresh every time and never cached: an earlier combat in the same game may
// have demoted a piece into, or out of, a rank that matches its neighbor.
//
// **Rank reduction** (§4.3, "Rank reduction"): any piece that survives
// combat - attacker or defender, whichever is left standing - is immediately
// and permanently reduced one rank (`position.ts`'s `reduceRank`, which
// already clamps at rank 1 - reused here rather than reimplemented, per this
// plan's Step 2 notes). A draw leaves no survivor, so it reduces nothing.
//
// **Capturing the Flag is not combat** (§4.3): the Flag never fights, so a
// piece that captures it is not reduced. This module reports a Flag capture
// as its own kind of result (`CombatResult`'s `"flagCapture"` kind),
// distinct from the three ordinary combat outcomes above, rather than
// folding it into "attacker wins" and then having to remember not to reduce
// it.
//
// **Sacrificial attacks** (§4.3, "Sacrificial attacks") need no
// special-casing here: a weaker piece attacking a stronger one simply
// resolves as an ordinary `"attackerLoses"` - a *complete* sacrifice -
// unless the formation bonus turns it into a `"draw"` - a *partial*
// sacrifice. Either way the surviving defender is reduced for having
// survived, exactly as it would be against any other attack; that reduction
// is the point of a complete sacrifice, and it falls out of the ordinary
// rank-reduction rule with no extra logic.
//
// Builds on the board geometry (`board.ts`), the piece catalog (`pieces.ts`)
// and the board-state model (`position.ts`), all earlier steps; it has no
// further dependencies.

import {
  DIAGONAL_DIRECTIONS,
  ORTHOGONAL_DIRECTIONS,
  stepFrom,
  type Direction,
  type Side,
  type Square,
} from "./board.ts";
import type { Rank } from "./pieces.ts";
import {
  demotePiece,
  pieceAt,
  reduceRank,
  relocatePiece,
  removePiece,
  type FlagPiece,
  type NumberedPiece,
  type PositionState,
} from "./position.ts";

/**
 * All eight squares surrounding a square, orthogonal and diagonal alike -
 * the formation bonus's reach (rules.md §4.3: "within one square (orthogonal
 * or diagonal)").
 */
const SURROUNDING_DIRECTIONS: readonly Direction[] = [
  ...ORTHOGONAL_DIRECTIONS,
  ...DIAGONAL_DIRECTIONS,
];

/**
 * True if the numbered piece belonging to `side` at rank `rank`, standing on
 * `square`, has the *formation bonus* (rules.md §4.3, glossary "Formation
 * bonus"): a friendly piece of **equal** rank stands on one of its eight
 * surrounding squares. Always read fresh from `position`'s current ranks -
 * never cached - so a demotion elsewhere on the board can grant or remove
 * the bonus between one combat and the next.
 */
function hasFormationBonus(
  position: PositionState,
  square: Square,
  side: Side,
  rank: Rank,
): boolean {
  return SURROUNDING_DIRECTIONS.some((direction) => {
    const neighbor = stepFrom(square, direction);
    if (neighbor === null) {
      return false;
    }
    const occupant = pieceAt(position, neighbor);
    return (
      occupant !== undefined &&
      occupant.kind === "numbered" &&
      occupant.side === side &&
      occupant.rank === rank
    );
  });
}

/**
 * Which of the three ordinary combat results occurred (rules.md §4.3). Not
 * used for a Flag capture - see `CombatResult`'s `"flagCapture"` kind, which
 * is reported separately because capturing the Flag is not combat.
 */
export type CombatOutcome = "attackerWins" | "attackerLoses" | "draw";

/**
 * Which of the three ordinary outcomes an attack by `attacker` on `defender`
 * produces, applying rank and the formation bonus (rules.md §4.3). Both
 * bonus checks read `position` as it stood before the attacker's move - the
 * attacker's own square (its bonus is checked "before its move") and the
 * defender's square (checked "at the moment it is attacked", which is still
 * before the attacker has moved onto it).
 */
function combatOutcome(
  position: PositionState,
  origin: Square,
  target: Square,
  attacker: NumberedPiece,
  defender: NumberedPiece,
): CombatOutcome {
  if (attacker.rank === defender.rank) {
    return "draw";
  }
  if (attacker.rank > defender.rank) {
    const defenderIsOneWeaker = defender.rank === attacker.rank - 1;
    if (
      defenderIsOneWeaker &&
      hasFormationBonus(position, target, defender.side, defender.rank)
    ) {
      return "draw";
    }
    return "attackerWins";
  }
  const attackerIsOneWeaker = attacker.rank === defender.rank - 1;
  if (
    attackerIsOneWeaker &&
    hasFormationBonus(position, origin, attacker.side, attacker.rank)
  ) {
    return "draw";
  }
  return "attackerLoses";
}

interface CombatResultCommon {
  /** Where the attacking piece stood before the attack. */
  readonly origin: Square;
  /** The square attacked - where the defending piece stood before the attack. */
  readonly target: Square;
  /** The attacking piece as it stood *before* resolution. */
  readonly attacker: NumberedPiece;
  /** The position *after* resolving this combat. */
  readonly position: PositionState;
}

/**
 * The result of resolving one attack (`resolveCombat`). A `"combat"` result
 * is one of the three ordinary outcomes (rules.md §4.3); a `"flagCapture"`
 * result is reported separately, because capturing the Flag is not combat -
 * the capturing piece is never reduced (§4.3, "Capturing the Flag is not
 * combat").
 */
export type CombatResult =
  | (CombatResultCommon & {
      readonly kind: "combat";
      readonly outcome: CombatOutcome;
      /** The defending piece as it stood *before* resolution. */
      readonly defender: NumberedPiece;
      /**
       * The new rank of whichever piece survived - the attacker's for
       * `"attackerWins"`, the defender's for `"attackerLoses"` - already
       * reduced one rank (`reduceRank`, clamped at rank 1). `null` for a
       * `"draw"`, which leaves no survivor to reduce.
       */
      readonly survivorRank: Rank | null;
    })
  | (CombatResultCommon & {
      readonly kind: "flagCapture";
      /** The captured Flag, as it stood before capture. */
      readonly defender: FlagPiece;
    });

/**
 * Resolves an attack by the piece on `origin` against the enemy piece on
 * `target` (rules.md §4.3), returning what happened and the position after
 * it. This function does not decide whether the attack is legal to *make* -
 * `movement.ts`'s `legalAttacks` already decided that, and sacrificial
 * attacks (any piece against any enemy, regardless of relative strength) are
 * always legal there - it only resolves what combat between the two pieces
 * produces. Throws (a programming-invariant guard, not a rules check) if
 * `origin` is empty or holds the Flag (which never attacks), if `target` is
 * empty, or if the two pieces belong to the same side.
 */
export function resolveCombat(
  position: PositionState,
  origin: Square,
  target: Square,
): CombatResult {
  const attacker = pieceAt(position, origin);
  if (attacker === undefined) {
    throw new Error(
      `combat.ts: resolveCombat: no piece stands on the origin square to attack with.`,
    );
  }
  if (attacker.kind !== "numbered") {
    throw new Error(
      `combat.ts: resolveCombat: the Flag never attacks (rules.md §4.2).`,
    );
  }
  const defender = pieceAt(position, target);
  if (defender === undefined) {
    throw new Error(
      `combat.ts: resolveCombat: there is no piece on the target square to attack.`,
    );
  }
  if (defender.side === attacker.side) {
    throw new Error(
      `combat.ts: resolveCombat: a piece may never attack a friendly piece.`,
    );
  }

  if (defender.kind === "flag") {
    // Capturing the Flag is not combat (rules.md §4.3): the attacker simply
    // advances onto the Flag's square, unreduced.
    return {
      kind: "flagCapture",
      origin,
      target,
      attacker,
      defender,
      position: relocatePiece(position, origin, target),
    };
  }

  const outcome = combatOutcome(position, origin, target, attacker, defender);
  switch (outcome) {
    case "draw": {
      const nextPosition = removePiece(removePiece(position, origin), target);
      return {
        kind: "combat",
        outcome,
        origin,
        target,
        attacker,
        defender,
        survivorRank: null,
        position: nextPosition,
      };
    }
    case "attackerWins": {
      const advanced = relocatePiece(position, origin, target);
      const nextPosition = demotePiece(advanced, target);
      return {
        kind: "combat",
        outcome,
        origin,
        target,
        attacker,
        defender,
        survivorRank: reduceRank(attacker.rank),
        position: nextPosition,
      };
    }
    case "attackerLoses": {
      const withoutAttacker = removePiece(position, origin);
      const nextPosition = demotePiece(withoutAttacker, target);
      return {
        kind: "combat",
        outcome,
        origin,
        target,
        attacker,
        defender,
        survivorRank: reduceRank(defender.rank),
        position: nextPosition,
      };
    }
    default: {
      const exhaustive: never = outcome;
      throw new Error(
        `combat.ts: resolveCombat: unreachable outcome "${String(exhaustive)}".`,
      );
    }
  }
}
