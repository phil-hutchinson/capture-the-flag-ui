// Screen-reader announcement wording for Phase 2 movement, combat, game end,
// and the draw-offer flow (story 00000004, Step 9 / Gate D; extended for
// attacks in story 00000005, Step 6; extended for game end and draw offers in
// story 00000006, Step 7).
//
// `PlayBoard`'s accessible grid (`AccessibleGrid.tsx`, Step 5) exposes a
// polite live region driven by a plain `announcement` string; nothing pushed
// text into it until this step. This module is the pure piece that decides
// *what* to say: given a `PlaySession` immediately before and immediately
// after a board-cell activation (`playSession.ts`'s `activateSquare`, Step
// 6), plus the activated square, it derives a short, player-facing sentence
// describing what just happened, per Gate D:
//
//  - selecting a piece announces the piece and how many moves it has
//    available (e.g. "Red Infantry selected, 3 moves available.");
//  - completing a plain move announces what moved and where, immediately
//    followed by whose turn it now is (e.g. "Red Infantry moved to A3. Blue
//    to move.");
//  - completing an **attack** (story 00000005, Step 6) announces both
//    combatants by color and piece name, who fell, and whose turn it now is
//    (e.g. "Red Knight attacked Blue Halberdier at D6: Blue Halberdier
//    falls, Red Knight advances. Blue to move."), read off the resolved
//    `CombatOutcome` the session carries as `lastOutcome` rather than diffing
//    the board, since a fallen piece can no longer be looked up on it;
//  - deselecting a piece (activating the same square again) announces that
//    plainly;
//  - a ply that **ends the game** (story 00000006, `outcome.ts`'s
//    `GameOutcome` on `after.play.result`) still describes what the ply did,
//    but replaces the trailing "{Color} to move." clause - nobody is to move
//    - with the result-and-reason sentence (e.g. "Red Knight attacked Blue
//    Flag at F12: Blue Flag falls, Red Knight advances. Red wins - Flag
//    captured.").
//
// This module also exposes `describeResult`, a small standalone function
// rendering the result-and-reason sentence directly from a `GameOutcome` -
// used above for a game-ending ply, and by `App.tsx` (Step 9) to announce an
// ending detected with **no** ply at all (a §6.2 win already holding at the
// Phase 2 reveal) - and the draw-offer flow's three transition sentences
// (offer, decline, accept - rules.md §6.6), for `App.tsx` to push into the
// same live region alongside the ply narrative.
//
// Whichever of the above just happened, whose-turn (and now whose-victory)
// wording is appended in exactly one place - this remains the *only* spot
// that pushes whose-turn/whose-victory information to assistive technology,
// so it is never announced twice from two different live regions in a way
// that could read as conflicting; `PlayStatus` and the end-of-game panel
// (Step 9) remain plain visual indicators.
//
// No React dependency - pure string building over `PlaySession` (from
// `playSession.ts`) and the rule-layer catalog, so it is unit-tested in the
// project's `node` Vitest environment like the rest of the rule/session
// layer.

import {
  otherSide,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v1_1/board.ts";
import type { PlacedPiece } from "../rules/primary/v1_1/gameState.ts";
import {
  legalAttacks,
  legalDestinations,
} from "../rules/primary/v1_1/movement.ts";
import type {
  GameEndReason,
  GameOutcome,
} from "../rules/primary/v1_1/outcome.ts";
import { PIECE_CATALOG } from "../rules/primary/v1_1/pieces.ts";
import type { PlyOutcome } from "../rules/primary/v1_1/play.ts";
import type { PlaySession } from "./playSession.ts";
import { sideColorName } from "./sideNames.ts";

/**
 * Bare, capitalized label for one of `outcome.ts`'s six stable
 * `GameEndReason` identifiers - never "ply", the rules' own terms otherwise.
 * Used only where a reason can occur without a losing side to name plainly
 * (see `winReasonClause`/`drawReasonClause` below): a Flag capture already
 * names the fallen Flag's color in the preceding ply description, and a
 * no-progress or agreed draw has no single "loser" to name.
 */
function reasonLabel(reason: GameEndReason): string {
  switch (reason) {
    case "flagCapture":
      return "Flag captured";
    case "unbreachableFlag":
      return "Unbreachable Flag";
    case "noLegalMove":
      return "No legal move";
    case "inactivity":
      return "Inactivity";
    case "noProgress":
      return "No progress";
    case "agreement":
      return "Agreement";
    default:
      return reason satisfies never;
  }
}

/**
 * Player-facing clause completing "{Winner} wins — ..." (no trailing period)
 * for a win outcome. Peer-review fix (Minor 7): names the *losing* side
 * plainly wherever the reason needs a subject to avoid reading as rules
 * jargon - e.g. "Blue can no longer reach Red's flag" rather than
 * "Unbreachable Flag". `noProgress` and `agreement` never occur for a win
 * (`computeOutcome`/`agreeDraw` only ever produce them as draws) - listed
 * only so this switch is exhaustive.
 */
function winReasonClause(winner: Side, reason: GameEndReason): string {
  const loser = sideColorName(otherSide(winner));
  switch (reason) {
    case "unbreachableFlag":
      return `${loser} can no longer reach ${sideColorName(winner)}'s flag`;
    case "noLegalMove":
      return `${loser} has no legal move left`;
    case "inactivity":
      return `${loser} ran out of moves without attacking`;
    case "flagCapture":
    case "noProgress":
    case "agreement":
      return reasonLabel(reason);
    default:
      return reason satisfies never;
  }
}

/**
 * Player-facing clause completing "The game is a draw — ..." (no trailing
 * period) for a draw outcome. `flagCapture`, `noLegalMove`, and `inactivity`
 * never occur for a draw - listed only so this switch is exhaustive.
 */
function drawReasonClause(reason: GameEndReason): string {
  switch (reason) {
    case "unbreachableFlag":
      return "Neither side can reach the other's flag anymore";
    case "flagCapture":
    case "noLegalMove":
    case "inactivity":
    case "noProgress":
    case "agreement":
      return reasonLabel(reason);
    default:
      return reason satisfies never;
  }
}

/**
 * The player-facing result-and-reason sentence for a finished `GameOutcome`
 * (e.g. "Red wins - Flag captured." / "Blue wins - Red ran out of moves
 * without attacking." / "The game is a draw - No progress."). Returns the
 * empty string for `{ kind: "ongoing" }` (not itself an ending to announce);
 * callers only call this once `result.kind !== "ongoing"`. Standalone from
 * `describeActivation` so it can render the same wording both as the
 * trailing clause of a game-ending ply's announcement and on its own - for
 * an ending detected with no ply (a §6.2 win already holding at the Phase 2
 * reveal - see `App.tsx`, Step 9) and for accepting a draw offer (see
 * `describeDrawAccepted` below).
 */
export function describeResult(result: GameOutcome): string {
  if (result.kind === "win") {
    return `${sideColorName(result.winner)} wins — ${winReasonClause(result.winner, result.reason)}.`;
  }
  if (result.kind === "draw") {
    return `The game is a draw — ${drawReasonClause(result.reason)}.`;
  }
  return "";
}

/**
 * The announcement for the active player **offering** a draw (rules.md
 * §6.6), naming the offering side and asking the opponent to answer (e.g.
 * "Red offers a draw. Blue, accept or decline?"). For `App.tsx` to push into
 * the board's live region when `playSession.ts`'s `offerDraw` is invoked.
 */
export function describeDrawOffer(offeringSide: Side): string {
  const offerer = sideColorName(offeringSide);
  const opponent = sideColorName(otherSide(offeringSide));
  return `${offerer} offers a draw. ${opponent}, accept or decline?`;
}

/**
 * The announcement for **declining** a pending draw offer, naming who
 * declined and that the offering player still has their turn - a decline is
 * quiet per rules.md §6.6 (no penalty, no record entry), but the offer never
 * changed `sideToMove`, so the trailing clause reads exactly like an ordinary
 * "to move" clause. For `App.tsx` to push into the board's live region when
 * `playSession.ts`'s `declineDraw` is invoked.
 */
export function describeDrawDecline(offeringSide: Side): string {
  const decliner = sideColorName(otherSide(offeringSide));
  const offerer = sideColorName(offeringSide);
  return `${decliner} declines the draw offer. ${offerer} to move.`;
}

/**
 * The announcement for **accepting** a pending draw offer, ending the game
 * immediately in an agreed draw. Reuses `describeResult` - an agreed draw is
 * just another finished `GameOutcome` (`{ kind: "draw", reason: "agreement"
 * }`, from `play.ts`'s `agreeDraw`) - so this is the same sentence a detected
 * ending would produce. For `App.tsx` to push into the board's live region
 * when `playSession.ts`'s `acceptDraw` is invoked.
 */
export function describeDrawAccepted(result: GameOutcome): string {
  return describeResult(result);
}

/** "{Color} {Piece display name}" for a `PlacedPiece`, independent of the board. */
function describePiece(piece: PlacedPiece): string {
  return `${sideColorName(piece.side)} ${PIECE_CATALOG[piece.pieceType].displayName}`;
}

/** "{Color} {Piece display name}" for whatever occupies `square` on `session`'s board. */
function pieceDescription(session: PlaySession, square: Square): string {
  const piece = session.play.board[squareKey(square)];
  if (piece === undefined) {
    // Should not happen for any of the transitions this module describes -
    // every case below only looks up a square that just held a piece - but
    // fall back to something sensible rather than throwing from an
    // announcement helper.
    return "Piece";
  }
  return describePiece(piece);
}

/**
 * The announcement for a resolved **attack** (`outcome.kind === "attack"`),
 * naming both combatants (color + piece name) and stating who fell, followed
 * by `trailingClause` - either "{Color} to move." for an ordinary attack, or
 * the result-and-reason sentence (`describeResult`) when this attack ended
 * the game (story 00000006 - e.g. a Flag capture). Reads the combatants off
 * `outcome` itself, not off either board, since the fallen piece (and, on an
 * attacker-wins result, the attacker's *origin*) can no longer be looked up
 * after the ply applied. Mentions Archer support only when it fired (it
 * always accompanies a `mutualLoss` result - see `resolveCombat`), as a short
 * trailing clause, so the primary who-fought/who-fell sentence is not
 * overloaded.
 */
function describeAttack(
  outcome: Extract<PlyOutcome, { kind: "attack" }>,
  trailingClause: string,
): string {
  const attackerName = describePiece(outcome.attacker);
  const defenderName = describePiece(outcome.defender);
  const squareName = squareKey(outcome.square);
  const supportClause = outcome.archerSupport
    ? " Archer support turns the attack back."
    : "";

  switch (outcome.result) {
    case "attackerWins":
      return `${attackerName} attacked ${defenderName} at ${squareName}: ${defenderName} falls, ${attackerName} advances. ${trailingClause}`;
    case "attackerLoses":
      return `${attackerName} attacked ${defenderName} at ${squareName} and falls; ${defenderName} holds. ${trailingClause}`;
    case "mutualLoss":
      return `${attackerName} attacked ${defenderName} at ${squareName}: both fall.${supportClause} ${trailingClause}`;
    default:
      return outcome.result satisfies never;
  }
}

/**
 * The screen-reader announcement for activating `square`, given the session
 * immediately `before` and immediately `after` that activation. Returns an
 * empty string for an activation that changed nothing (not currently
 * reachable through the UI, since only actionable cells can be activated,
 * but handled gracefully rather than throwing).
 *
 * When the applied ply left `after.play.result` finished (story 00000006 -
 * e.g. capturing the Flag, or leaving the opponent with no legal ply), the
 * trailing "{Color} to move." clause - wrong, since nobody is to move - is
 * replaced with the result-and-reason sentence (`describeResult`), so a
 * player who did not see the board change hears both what the ply did and
 * how the game ended.
 */
export function describeActivation(
  before: PlaySession,
  after: PlaySession,
  square: Square,
): string {
  const moveApplied = after.play.moves.length > before.play.moves.length;
  if (moveApplied) {
    const trailingClause =
      after.play.result.kind === "ongoing"
        ? `${sideColorName(after.play.sideToMove)} to move.`
        : describeResult(after.play.result);
    const outcome = after.lastOutcome;
    if (outcome !== null && outcome.kind === "attack") {
      return describeAttack(outcome, trailingClause);
    }

    // A plain move: `before.selection` is the piece that just moved (from
    // its origin square) - look it up on the *pre*-move board, since
    // `square` (the destination) is where it now lives on `after`'s board.
    const mover = before.selection;
    const moverDescription =
      mover !== null ? pieceDescription(before, mover) : "Piece";
    const destinationName = squareKey(square);
    return `${moverDescription} moved to ${destinationName}. ${trailingClause}`;
  }

  const selectionChanged =
    after.selection !== null &&
    (before.selection === null ||
      squareKey(before.selection) !== squareKey(after.selection));
  if (selectionChanged && after.selection !== null) {
    const description = pieceDescription(after, after.selection);
    // An attack is a kind of move in player-facing wording (per the rules'
    // use of "move"), so the count combines plain-move destinations and
    // attack targets into the single number a player hears.
    const count =
      legalDestinations(after.play.board, after.selection).length +
      legalAttacks(after.play.board, after.selection).length;
    const moveWord = count === 1 ? "move" : "moves";
    return `${description} selected, ${count} ${moveWord} available.`;
  }

  if (before.selection !== null && after.selection === null) {
    return `${pieceDescription(before, before.selection)} deselected.`;
  }

  return "";
}
