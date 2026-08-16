// Orthogonal movement and attack-target rule logic for ruleset major 3,
// written from `reference/rules.md` §4.1 (turn order - White's first-move
// restriction) and §4.2 (movement) alone (this story's implementation plan,
// Step 5) - never by copying the existing major-2 rule engine, whose
// encumbrance rule is fundamentally different (see below).
//
// This module computes, for a piece standing at a given origin:
//
// - `legalDestinations` - the empty-square moves it may make;
// - `legalAttacks` - the enemy-occupied squares it may legally attack (moving
//   onto them resolves combat elsewhere - `combat.ts`, a later step).
//
// The two are kept deliberately disjoint, the way major 2 does it: an
// enemy-occupied square is never a `legalDestinations` result and an empty
// square is never a `legalAttacks` result, so a caller never has to
// re-derive intent.
//
// **Diagonal attacks are deliberately not in this module yet** - a later
// step (§4.4) extends `legalAttacks` with them. Every result produced here is
// orthogonal.
//
// Baseline (§4.2): one square orthogonally, into an empty square (a move) or
// onto an enemy (an attack). A piece that is *unencumbered in the direction
// it is moving* may instead go two squares in a straight orthogonal line,
// provided the square it passes through is empty; the far square may be
// empty (a move) or hold an enemy (an attack).
//
// **Encumbrance is direction-relative - the rule this ruleset major changes
// most from major 2.** At major 2, any enemy on any of a piece's eight
// surrounding squares blocks its two-square move in *every* direction. Here
// (§4.2, and the glossary's "Encumbered"), a piece is encumbered *for a given
// direction of travel* only: an enemy on any of the **five squares ahead of
// or beside it** in that direction. For a move north those are NW, N, NE, W,
// E; the three squares behind (SW, S, SE) never encumber, so an enemy behind
// a piece never slows it down, and the same piece may be free to move two
// squares one way while restricted to one square another. Judged only from
// where the piece stands when the move begins, and only from its own eight
// surrounding squares - what stands near the destination is irrelevant.
// Only an *enemy* piece encumbers; a friendly piece never does.
//
// White's first move of the game is limited to one square (§4.1) - a
// property of the game's first ply, not of White generally, so this module
// takes it as an explicit `firstMoveRestricted` flag from its caller
// (`play.ts`, a later step) rather than inferring it from any state held
// here. Passing is never allowed (§4.1) and never needs to be: a player with
// at least one numbered piece always has a legal move (see `outcome.ts`, a
// later step, for the attrition ending that covers the alternative).
//
// The Flag never moves (§4.2) and never attacks. No piece may move onto a
// square occupied by a friendly piece. A piece may never step diagonally
// onto an empty square - the diagonal is an attacking direction only (§4.2,
// §4.4).
//
// Builds only on the board geometry (`board.ts`) and the board-state model
// (`position.ts`), both earlier steps; it has no further dependencies.

import {
  ORTHOGONAL_DIRECTIONS,
  stepFrom,
  type Direction,
  type Side,
  type Square,
} from "./board.ts";
import { pieceAt, type PlacedPiece, type PositionState } from "./position.ts";

/**
 * The five directions that encumber a piece traveling in `direction`
 * (rules.md §4.2, glossary "Encumbered"): the direction itself, its two
 * neighboring diagonals, and the two orthogonal directions perpendicular to
 * it. The three directions centered on the opposite direction (the direction
 * itself opposite, and its two neighboring diagonals) never encumber - "the
 * three squares behind."
 */
function encumberingDirections(direction: Direction): readonly Direction[] {
  switch (direction) {
    case "north":
      return ["northwest", "north", "northeast", "west", "east"];
    case "south":
      return ["southwest", "south", "southeast", "west", "east"];
    case "east":
      return ["northeast", "east", "southeast", "north", "south"];
    case "west":
      return ["northwest", "west", "southwest", "north", "south"];
    default:
      throw new Error(
        `movement.ts: encumberingDirections: "${direction}" is not an orthogonal direction.`,
      );
  }
}

/**
 * True if the piece belonging to `side` standing at `origin` is *encumbered*
 * for a two-square move in `direction` (rules.md §4.2): an enemy piece stands
 * on any of the five squares ahead of or beside it in that direction. Judged
 * only from `origin`, before the piece moves - what stands near the
 * destination has no bearing. `direction` must be one of the four orthogonal
 * directions; the two-square move is orthogonal only (§4.2).
 */
export function isEncumbered(
  position: PositionState,
  origin: Square,
  side: Side,
  direction: Direction,
): boolean {
  for (const watchDirection of encumberingDirections(direction)) {
    const neighbor = stepFrom(origin, watchDirection);
    if (neighbor === null) {
      continue;
    }
    const occupant = pieceAt(position, neighbor);
    if (occupant !== undefined && occupant.side !== side) {
      return true;
    }
  }
  return false;
}

/** True if `piece` never moves and never attacks - only the Flag (rules.md §4.2). */
function isImmobile(piece: PlacedPiece): boolean {
  return piece.kind === "flag";
}

/**
 * The legal empty-square destinations for the piece standing on `origin`,
 * given `position`. Returns an empty array if `origin` is empty or holds the
 * Flag (which never moves). Every mobile piece may step one square
 * orthogonally into an empty square in each of the four directions; a piece
 * unencumbered in a given direction (`isEncumbered`) may additionally reach
 * the square two away in that direction, provided the one-away intermediate
 * square is empty and the far square is itself empty. Never diagonal, never
 * off-board, never onto an occupied square.
 *
 * When `firstMoveRestricted` is `true` (rules.md §4.1 - White's first move of
 * the game only), every two-square result is withheld regardless of
 * encumbrance, leaving only the one-square destinations. The caller decides
 * when that applies; this function never infers it.
 */
export function legalDestinations(
  position: PositionState,
  origin: Square,
  firstMoveRestricted = false,
): Square[] {
  const occupant = pieceAt(position, origin);
  if (occupant === undefined || isImmobile(occupant)) {
    return [];
  }
  const { side } = occupant;

  const destinations: Square[] = [];
  for (const direction of ORTHOGONAL_DIRECTIONS) {
    const near = stepFrom(origin, direction);
    if (near === null || pieceAt(position, near) !== undefined) {
      continue;
    }
    destinations.push(near);

    if (
      firstMoveRestricted ||
      isEncumbered(position, origin, side, direction)
    ) {
      continue;
    }
    const far = stepFrom(near, direction);
    if (far === null || pieceAt(position, far) !== undefined) {
      continue;
    }
    destinations.push(far);
  }
  return destinations;
}

/**
 * The enemy-occupied squares the piece standing on `origin` may legally
 * attack orthogonally, given `position`. Returns an empty array if `origin`
 * is empty or holds the Flag (which never attacks). Every mobile piece may
 * attack an orthogonally adjacent enemy square in each of the four
 * directions; a piece unencumbered in a given direction may additionally
 * attack the enemy-occupied square two away in that direction, provided the
 * one-away intermediate square is empty. A friendly piece is never a target.
 * Never off-board.
 *
 * **Diagonal attacks are added by a later step** (rules.md §4.4) - this
 * function is orthogonal-only for now. `firstMoveRestricted` behaves exactly
 * as it does for `legalDestinations`.
 */
export function legalAttacks(
  position: PositionState,
  origin: Square,
  firstMoveRestricted = false,
): Square[] {
  const occupant = pieceAt(position, origin);
  if (occupant === undefined || isImmobile(occupant)) {
    return [];
  }
  const { side } = occupant;

  const attacks: Square[] = [];
  for (const direction of ORTHOGONAL_DIRECTIONS) {
    const near = stepFrom(origin, direction);
    if (near !== null) {
      const nearOccupant = pieceAt(position, near);
      if (nearOccupant !== undefined && nearOccupant.side !== side) {
        attacks.push(near);
      }
    }

    if (
      firstMoveRestricted ||
      near === null ||
      pieceAt(position, near) !== undefined ||
      isEncumbered(position, origin, side, direction)
    ) {
      continue;
    }
    const far = stepFrom(near, direction);
    if (far === null) {
      continue;
    }
    const farOccupant = pieceAt(position, far);
    if (farOccupant !== undefined && farOccupant.side !== side) {
      attacks.push(far);
    }
  }
  return attacks;
}
