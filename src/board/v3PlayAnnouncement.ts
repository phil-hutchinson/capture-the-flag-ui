// Screen-reader announcement wording for ruleset major 3's play (story
// 00000036, Step 13, implementation plan Decision 1) - the major-3
// counterpart of `playAnnouncement.ts`, deliberately duplicated rather than
// shared, per Decision 1: major 3 has an extra declared action (resign) and
// a brand-new event to announce (a demotion) that major 2 has no analogue
// of, so a shared abstraction over both majors' wording would be a leaky
// union for no real gain.
//
// Player-facing vocabulary throughout, exactly as major 2's module: sides are
// always named by **colour** ("Red"/"Blue"), never "White"/"Black"; the word
// is always **"move"**, never "ply"; and nothing here ever speaks an edition
// id, a flag id, or a value token - none of that is player-facing.
//
// Given a `v3PlaySession.ts` `PlaySession` immediately before and immediately
// after a board-cell activation (`activateSquare`), plus the activated
// square, `describeActivation` derives a short sentence describing what just
// happened:
//
//  - selecting a piece names it by **colour, rank name and rank number**,
//    plus how many moves it has available (e.g. "Red Champion, rank 4
//    selected, 3 moves available.") - the rank number matters more here than
//    at major 2, since a piece's name is decoration over a rank that can
//    change mid-game (rules.md §2.2, §4.3);
//  - completing a plain move announces what moved and where, followed by
//    whose turn it now is;
//  - completing an **attack** announces both combatants, who fell, and whose
//    turn it now is - and, per this plan's Decision 6, when the attacker or
//    the defender **survives**, names its **new** rank explicitly, in words
//    (e.g. "Red Champion attacked Blue Foot Soldier at D5: Blue Foot Soldier
//    falls, Red Champion advances and is demoted to Foot Soldier, rank 3.
//    Blue to move."). A **draw** reduces nothing (no survivor to name), and
//    capturing the **Flag** is not combat (the capturing piece is never
//    reduced) - neither sentence names a new rank;
//  - deselecting a piece (activating the same square again) announces that
//    plainly;
//  - a ply that **ends the game** still describes what the ply did, but
//    replaces the trailing "{Colour} to move." clause with the
//    result-and-reason sentence (`describeResult`).
//
// `describeResult` renders the result-and-reason sentence directly from a
// `GameOutcome`, producing exactly the six sentences fixed by this plan's
// Decision 5 - used above for a game-ending ply, standalone for a
// resignation (`describeResignation`) and for accepting a draw offer
// (`describeDrawAccepted`), and by a future step's live region for an ending
// detected with no ply of its own.
//
// No React dependency - pure string building over `v3PlaySession.ts`'s
// `PlaySession` and the v3 rule-layer catalog, so it is unit-tested in the
// project's `node` Vitest environment.

import {
  otherSide,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v3/board.ts";
import {
  legalAttacks,
  legalDestinations,
} from "../rules/primary/v3/movement.ts";
import type {
  GameEndReason,
  GameOutcome,
} from "../rules/primary/v3/outcome.ts";
import {
  FLAG_DISPLAY_NAME,
  RANK_CATALOG,
  type Rank,
} from "../rules/primary/v3/pieces.ts";
import { pieceAt, type PlacedPiece } from "../rules/primary/v3/position.ts";
import type { PlyOutcome } from "../rules/primary/v3/play.ts";
import type { PlaySession } from "./v3PlaySession.ts";
import { sideColorName } from "./sideNames.ts";

/** "{Colour} {Piece display name}" for a `PlacedPiece` (a numbered piece or the Flag), independent of the board. */
function describePiece(piece: PlacedPiece): string {
  const name =
    piece.kind === "flag"
      ? FLAG_DISPLAY_NAME
      : RANK_CATALOG[piece.rank].displayName;
  return `${sideColorName(piece.side)} ${name}`;
}

/** "{Colour} {Piece display name}" for whatever occupies `square` on `session`'s board. */
function pieceDescription(session: PlaySession, square: Square): string {
  const piece = pieceAt(session.play.board, square);
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
 * "{Colour} {Piece display name}, rank {N}" for whatever numbered piece
 * occupies `square` on `session`'s board - the fuller form Decision 6 asks
 * selection to use, since a rank digit disambiguates a piece whose name alone
 * is decoration over game state that can change mid-game. Falls back to the
 * plain `pieceDescription` for the Flag - never reachable via selection (the
 * Flag has no legal moves or attacks, so `v3PlaySession.ts` never offers it)
 * but handled rather than throwing.
 */
function pieceDescriptionWithRank(
  session: PlaySession,
  square: Square,
): string {
  const piece = pieceAt(session.play.board, square);
  if (piece === undefined) {
    return "Piece";
  }
  if (piece.kind === "flag") {
    return describePiece(piece);
  }
  return `${sideColorName(piece.side)} ${RANK_CATALOG[piece.rank].displayName}, rank ${piece.rank}`;
}

/** "{Rank display name}, rank {N}" - the words a demotion is announced in (Decision 6). */
function rankLabel(rank: Rank): string {
  return `${RANK_CATALOG[rank].displayName}, rank ${rank}`;
}

/**
 * Bare, capitalized label for one of `outcome.ts`'s six stable
 * `GameEndReason` identifiers - never used directly in a result sentence
 * (see `winReasonClause`/`drawReasonClause` below, which build this plan's
 * Decision 5 wording instead); only a fallback for the three reasons each
 * clause-builder can never actually receive, so each switch stays exhaustive.
 */
function reasonLabel(reason: GameEndReason): string {
  switch (reason) {
    case "flagCapture":
      return "Flag captured";
    case "attrition":
      return "Attrition";
    case "mutualAttrition":
      return "Mutual attrition";
    case "inactivity":
      return "Inactivity";
    case "resignation":
      return "Resignation";
    case "agreement":
      return "Agreement";
    default:
      return reason satisfies never;
  }
}

/**
 * Player-facing clause completing "{Winner} wins — ..." (no trailing period)
 * for a win outcome, exactly per this plan's Decision 5: `flagCapture` ->
 * "Flag captured", `attrition` -> "{Loser} has no pieces left", `resignation`
 * -> "{Loser} resigned". `mutualAttrition`, `inactivity` and `agreement`
 * never occur for a win at major 3 (all three only ever produce a *draw*) -
 * listed only so this switch is exhaustive.
 */
function winReasonClause(winner: Side, reason: GameEndReason): string {
  const loser = sideColorName(otherSide(winner));
  switch (reason) {
    case "flagCapture":
      return "Flag captured";
    case "attrition":
      return `${loser} has no pieces left`;
    case "resignation":
      return `${loser} resigned`;
    case "mutualAttrition":
    case "inactivity":
    case "agreement":
      return reasonLabel(reason);
    default:
      return reason satisfies never;
  }
}

/**
 * Player-facing clause completing "The game is a draw — ..." (no trailing
 * period) for a draw outcome, exactly per this plan's Decision 5:
 * `mutualAttrition` -> "neither player has any pieces left", `inactivity` ->
 * "by inactivity", `agreement` -> "by agreement". `flagCapture`, `attrition`
 * and `resignation` never occur for a draw - listed only so this switch is
 * exhaustive.
 */
function drawReasonClause(reason: GameEndReason): string {
  switch (reason) {
    case "mutualAttrition":
      return "neither player has any pieces left";
    case "inactivity":
      return "by inactivity";
    case "agreement":
      return "by agreement";
    case "flagCapture":
    case "attrition":
    case "resignation":
      return reasonLabel(reason);
    default:
      return reason satisfies never;
  }
}

/**
 * The player-facing result-and-reason sentence for a finished `GameOutcome` -
 * exactly the six sentences fixed by this plan's Decision 5 (e.g. "Red wins —
 * Flag captured." / "Blue wins — Red has no pieces left." / "The game is a
 * draw — by inactivity."). Returns the empty string for `{ kind: "ongoing" }`
 * (not itself an ending to announce).
 */
export function describeResult(result: GameOutcome): string {
  if (result.kind === "win") {
    const winnerLabel = sideColorName(result.winner);
    return `${winnerLabel} wins — ${winReasonClause(result.winner, result.reason)}.`;
  }
  if (result.kind === "draw") {
    return `The game is a draw — ${drawReasonClause(result.reason)}.`;
  }
  return "";
}

/**
 * The announcement for the active player **offering** a draw, naming the
 * offering side and asking the opponent to answer (e.g. "Red offers a draw.
 * Blue, accept or decline?"). For the UI to push into the board's live
 * region when `v3PlaySession.ts`'s `offerDraw` is invoked.
 */
export function describeDrawOffer(offeringSide: Side): string {
  const offerer = sideColorName(offeringSide);
  const opponent = sideColorName(otherSide(offeringSide));
  return `${offerer} offers a draw. ${opponent}, accept or decline?`;
}

/**
 * The announcement for **declining** a pending draw offer, naming who
 * declined and that the offering player still has their turn. For the UI to
 * push into the board's live region when `v3PlaySession.ts`'s `declineDraw`
 * is invoked.
 */
export function describeDrawDecline(offeringSide: Side): string {
  const decliner = sideColorName(otherSide(offeringSide));
  const offerer = sideColorName(offeringSide);
  return `${decliner} declines the draw offer. ${offerer} to move.`;
}

/**
 * The announcement for **accepting** a pending draw offer, ending the game
 * immediately in an agreed draw. Reuses `describeResult` - an agreed draw is
 * just another finished `GameOutcome`.
 */
export function describeDrawAccepted(result: GameOutcome): string {
  return describeResult(result);
}

/**
 * The announcement for a **resignation** (rules.md §5.5, this plan's
 * Decision 9), ending the game immediately as a win for the opponent. Reuses
 * `describeResult` - a resignation is just another finished `GameOutcome`,
 * exactly as an agreed draw is above.
 */
export function describeResignation(result: GameOutcome): string {
  return describeResult(result);
}

/**
 * The announcement for a resolved **attack** (`outcome.kind === "attack"`),
 * naming both combatants and stating who fell, followed by `trailingClause`.
 * A **Flag capture** is not combat (rules.md §4.3), so the capturing piece is
 * never reduced and no new rank is ever named for it - it reads exactly like
 * an ordinary attacker win, minus the demotion clause. An ordinary combat
 * result additionally names the **survivor's new rank**, in words, for
 * `attackerWins` (the attacker survives) and `attackerLoses` (the defender
 * survives) - per this plan's Decision 6. A **draw** reduces nothing (§4.3:
 * "a draw reduces nothing, because it leaves no survivor"), so neither
 * sentence names a new rank there either.
 */
function describeAttack(
  outcome: Extract<PlyOutcome, { kind: "attack" }>,
  trailingClause: string,
): string {
  const { combat } = outcome;
  const attackerName = describePiece(combat.attacker);
  const defenderName = describePiece(combat.defender);
  const squareName = squareKey(combat.target);

  if (combat.kind === "flagCapture") {
    return `${attackerName} attacked ${defenderName} at ${squareName}: ${defenderName} falls, ${attackerName} advances. ${trailingClause}`;
  }

  switch (combat.outcome) {
    case "attackerWins": {
      const demotion =
        combat.survivorRank === null
          ? ""
          : ` and is demoted to ${rankLabel(combat.survivorRank)}`;
      return `${attackerName} attacked ${defenderName} at ${squareName}: ${defenderName} falls, ${attackerName} advances${demotion}. ${trailingClause}`;
    }
    case "attackerLoses": {
      const demotion =
        combat.survivorRank === null
          ? ""
          : ` and is demoted to ${rankLabel(combat.survivorRank)}`;
      return `${attackerName} attacked ${defenderName} at ${squareName} and falls; ${defenderName} holds${demotion}. ${trailingClause}`;
    }
    case "draw":
      return `${attackerName} attacked ${defenderName} at ${squareName}: both fall. ${trailingClause}`;
    default: {
      const exhaustive: never = combat.outcome;
      throw new Error(
        `v3PlayAnnouncement.ts: describeAttack: unreachable outcome "${String(exhaustive)}".`,
      );
    }
  }
}

/**
 * The screen-reader announcement for activating `square`, given the session
 * immediately `before` and immediately `after` that activation. Returns an
 * empty string for an activation that changed nothing (not currently
 * reachable through the UI, since only actionable cells can be activated,
 * but handled gracefully rather than throwing).
 *
 * When the applied ply left `after.play.result` finished, the trailing
 * "{Colour} to move." clause - wrong, since nobody is to move - is replaced
 * with the result-and-reason sentence (`describeResult`).
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
    const description = pieceDescriptionWithRank(after, after.selection);
    // An attack is a kind of move in player-facing wording, so the count
    // combines plain-move destinations and attack targets into the single
    // number a player hears.
    const firstMoveRestricted = after.play.moves.length === 0;
    const count =
      legalDestinations(after.play.board, after.selection, firstMoveRestricted)
        .length +
      legalAttacks(after.play.board, after.selection, firstMoveRestricted)
        .length;
    const moveWord = count === 1 ? "move" : "moves";
    return `${description} selected, ${count} ${moveWord} available.`;
  }

  if (before.selection !== null && after.selection === null) {
    return `${pieceDescription(before, before.selection)} deselected.`;
  }

  return "";
}
