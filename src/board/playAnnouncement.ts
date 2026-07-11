// Screen-reader announcement wording for Phase 2 movement and combat (story
// 00000004, Step 9 / Gate D; extended for attacks in story 00000005, Step 6).
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
//    plainly.
//
// Whichever of the above just happened, whose-turn wording is appended in
// exactly one place - this remains the *only* spot that pushes whose-turn
// information to assistive technology, so it is never announced twice from
// two different live regions in a way that could read as conflicting;
// `PlayStatus` remains a plain visual indicator.
//
// No React dependency - pure string building over `PlaySession` (from
// `playSession.ts`) and the rule-layer catalog, so it is unit-tested in the
// project's `node` Vitest environment like the rest of the rule/session
// layer.

import {
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v1_1/board.ts";
import type { PlacedPiece } from "../rules/primary/v1_1/gameState.ts";
import {
  legalAttacks,
  legalDestinations,
} from "../rules/primary/v1_1/movement.ts";
import { PIECE_CATALOG } from "../rules/primary/v1_1/pieces.ts";
import type { PlyOutcome } from "../rules/primary/v1_1/play.ts";
import type { PlaySession } from "./playSession.ts";

/** Player-facing color name for a side. Internal-only; never shown as "White"/"Black". */
function sideColorName(side: Side): string {
  return side === "white" ? "Red" : "Blue";
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
 * by whose turn it now is. Reads the combatants off `outcome` itself, not off
 * either board, since the fallen piece (and, on an attacker-wins result, the
 * attacker's *origin*) can no longer be looked up after the ply applied.
 * Mentions Archer support only when it fired (it always accompanies a
 * `mutualLoss` result - see `resolveCombat`), as a short trailing clause, so
 * the primary who-fought/who-fell sentence is not overloaded.
 */
function describeAttack(
  outcome: Extract<PlyOutcome, { kind: "attack" }>,
  nextToMove: string,
): string {
  const attackerName = describePiece(outcome.attacker);
  const defenderName = describePiece(outcome.defender);
  const squareName = squareKey(outcome.square);
  const supportClause = outcome.archerSupport
    ? " Archer support turns the attack back."
    : "";

  switch (outcome.result) {
    case "attackerWins":
      return `${attackerName} attacked ${defenderName} at ${squareName}: ${defenderName} falls, ${attackerName} advances. ${nextToMove} to move.`;
    case "attackerLoses":
      return `${attackerName} attacked ${defenderName} at ${squareName} and falls; ${defenderName} holds. ${nextToMove} to move.`;
    case "mutualLoss":
      return `${attackerName} attacked ${defenderName} at ${squareName}: both fall.${supportClause} ${nextToMove} to move.`;
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
 */
export function describeActivation(
  before: PlaySession,
  after: PlaySession,
  square: Square,
): string {
  const moveApplied = after.play.moves.length > before.play.moves.length;
  if (moveApplied) {
    const nextToMove = sideColorName(after.play.sideToMove);
    const outcome = after.lastOutcome;
    if (outcome !== null && outcome.kind === "attack") {
      return describeAttack(outcome, nextToMove);
    }

    // A plain move: `before.selection` is the piece that just moved (from
    // its origin square) - look it up on the *pre*-move board, since
    // `square` (the destination) is where it now lives on `after`'s board.
    const mover = before.selection;
    const moverDescription =
      mover !== null ? pieceDescription(before, mover) : "Piece";
    const destinationName = squareKey(square);
    return `${moverDescription} moved to ${destinationName}. ${nextToMove} to move.`;
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
