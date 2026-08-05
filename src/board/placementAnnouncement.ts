// Player-facing wording for accessible placement (story 00000002 "Accessible
// placement board", Step 1; consumed by `HotSeatGame.tsx` starting Step 5).
//
// The single home for every string this story adds: a placement square's
// accessible name (consumed by `Board.tsx`, Step 3), a tray entry's
// accessible name (consumed by `Tray.tsx`, Step 6), and a sentence for every
// placement event pushed into the board's live region (consumed by
// `HotSeatGame.tsx`, Step 5). It was unit-tested on its own first, before
// anything called into it, so it is entirely unit-testable in this
// repository's `node`-only Vitest environment, per story.md's "Verification"
// (no jsdom, no component-testing library).
//
// Step 5 adds one function Step 1 did not anticipate: `describePieceDeselected`,
// for clicking an already-selected board square again (cancelling the pickup
// without moving it) - Step 1's event list paired "selected"/"deselected" only
// for a tray type, not for a picked-up board piece, but Step 5's key grammar
// (Decisions item 2's table) needs exactly that sentence for
// `HotSeatGame.tsx`'s `handleSquareClick`.
//
// Peer review finding #4: `describePiecePlaced` gained an optional
// `exhausted` flag. Placing the last piece of a type silently cleared the
// tray selection, which a screen-reader user could not perceive - the next
// Enter on an empty square with nothing selected is a silent no-op. Rather
// than announce that separately, the "placed" sentence itself now names the
// type running out, since it is the direct, in-the-moment cause.
//
// Modelled on `playAnnouncement.ts` (Phase 2's own live-region wording) and
// `towerPlacementMessages.ts` (this story's nearest placement-side
// precedent): no React import, no DOM, pure string-building over the rule
// layer's own types (`Square`, `Side`, `PieceTypeId`) and `boardView.ts`'s
// `RowBand`. `sideColorName` (never the internal "white"/"black") and
// `squareKey` are the only place sides and squares are turned into words;
// piece names always come from `PIECE_CATALOG[...].displayName`; every
// sentence says "move", never "ply", and none of it assumes a particular
// board size or roster.
//
// Square labels (`placementSquareLabel`) follow `FullBoard.tsx`'s
// `squareLabel`: the square's name, then what occupies it, then any state
// suffixes. Unlike Phase 2's full board, placement's view is a *partial* one
// (`Board.tsx`'s module comment; `boardView.ts`'s `visibleRows`) - only the
// `"home"` band is ever interactive, with a greyed `"buffer"` row (Battle
// only) and the near `"lake-row"` shown above it purely as a reminder that
// the lakes and the neutral zone are there. A square outside the home band
// reads as outside the active player's placement area - the non-visual
// equivalent of that grey band - rather than describing an occupant, since
// nothing is ever placed there.
//
// "Closed to Towers" (the plan's "Decisions resolved at plan time", item 3)
// is a trailing suffix on a home square's own label, on top of whatever the
// square's base label already is (empty, or occupied-and-selected) - it is
// meaningful only for a home square, since `squaresClosedToTowers` only ever
// names home squares.
//
// Progress ("N of M placed", `PlacementProgress` from
// `../rules/primary/v2/placement.ts`) is always spoken in words - never a
// bare "N / M" - since `PlacementStatus`'s visible "N / M placed" readout is
// not itself a live region (story.md, in-scope item 2). Every event sentence
// below that follows a change in how many pieces are placed carries it;
// events that only relocate or select pieces (pick up, move, swap, tray
// select/deselect) do not, since the count did not change.

import {
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v2/board.ts";
import type { PlacementProgress } from "../rules/primary/v2/placement.ts";
import { PIECE_CATALOG, type PieceTypeId } from "../rules/primary/v2/pieces.ts";
import type { RowBand } from "./boardView.ts";
import { sideColorName } from "./sideNames.ts";

/** "{Color} {Piece display name}" - the one place a placed piece is named in words. */
function pieceDescription(pieceType: PieceTypeId, side: Side): string {
  return `${sideColorName(side)} ${PIECE_CATALOG[pieceType].displayName}`;
}

/** "N of M placed" - the one place placement progress is put into words. */
function progressPhrase(progress: PlacementProgress): string {
  return `${progress.placed} of ${progress.total} placed`;
}

/** The inputs `placementSquareLabel` needs to name one placement-board square. */
export interface PlacementSquareLabelInput {
  /** The square being named. */
  readonly square: Square;
  /** The square's role in the cropped placement view (`boardView.ts`). */
  readonly band: RowBand;
  /** Whether the square is a lake - always `false` for a `"home"` square. */
  readonly lake: boolean;
  /** The piece type placed on this square, if any (always the active side's own). */
  readonly pieceType?: PieceTypeId;
  /** The active player's side, for naming an occupying piece's color. */
  readonly side: Side;
  /** Whether this is the currently selected (picked-up) square. */
  readonly selected: boolean;
  /** Whether this square is currently closed to Towers (Decisions item 3). */
  readonly closedToTowers: boolean;
}

/**
 * The accessible name for one placement-board square (`Board.tsx`, Step 3):
 * the square's name, then what occupies it, then any state suffixes - see
 * the module comment above for the shape this follows and why.
 *
 *  - A square outside the `"home"` band (`"buffer"` / `"lake-row"`) reads as
 *    outside the active player's placement area, naming "lake" first when it
 *    is one - it is never occupied, selected, or closed to Towers, so none of
 *    those inputs are consulted for it.
 *  - An empty home square reads as empty; an occupied one names the piece by
 *    color and display name, adding ", selected" when it is the picked-up
 *    square.
 *  - "closed to Towers" is always a *trailing* suffix on the square's base
 *    label (Decisions item 3), whether the square is empty or occupied.
 */
export function placementSquareLabel({
  square,
  band,
  lake,
  pieceType,
  side,
  selected,
  closedToTowers,
}: PlacementSquareLabelInput): string {
  const name = squareKey(square);

  if (band !== "home") {
    return lake
      ? `${name}, lake, outside your placement area`
      : `${name}, outside your placement area`;
  }

  const base =
    pieceType === undefined
      ? `${name}, empty`
      : selected
        ? `${name}, ${pieceDescription(pieceType, side)}, selected`
        : `${name}, ${pieceDescription(pieceType, side)}`;

  return closedToTowers ? `${base}, closed to Towers` : base;
}

/**
 * The accessible name for one tray entry (`Tray.tsx`, Step 6): the piece
 * type and its remaining count, unambiguous when read aloud - never a bare
 * number - and correct for a count of exactly one. Selection state is
 * carried separately by the tray button's own `aria-pressed`, so it is not
 * repeated in this name.
 */
export function trayEntryLabel(
  pieceType: PieceTypeId,
  remaining: number,
): string {
  const name = PIECE_CATALOG[pieceType].displayName;
  if (remaining <= 0) {
    return `${name}, no pieces left`;
  }
  if (remaining === 1) {
    return `${name}, 1 piece left`;
  }
  return `${name}, ${remaining} pieces left`;
}

/** The live-region sentence for selecting a type from the tray. */
export function describeTraySelected(
  pieceType: PieceTypeId,
  side: Side,
): string {
  return `${pieceDescription(pieceType, side)} selected.`;
}

/** The live-region sentence for deselecting an already-selected tray type. */
export function describeTrayDeselected(
  pieceType: PieceTypeId,
  side: Side,
): string {
  return `${pieceDescription(pieceType, side)} deselected.`;
}

/**
 * The live-region sentence for placing a piece from the tray onto `square`,
 * carrying the resulting progress (this changes how many pieces are placed).
 * `exhausted` (peer review finding #4) marks that this placement used up the
 * last of `pieceType` - the resulting auto-deselect (`HotSeatGame.tsx`'s
 * `handleSquareClick`) is a state change the player caused but cannot see, so
 * a trailing clause names it rather than leaving the next Enter a silent
 * no-op.
 */
export function describePiecePlaced(
  pieceType: PieceTypeId,
  side: Side,
  square: Square,
  progress: PlacementProgress,
  exhausted = false,
): string {
  const base = `${pieceDescription(pieceType, side)} placed on ${squareKey(square)}. ${progressPhrase(progress)}.`;
  return exhausted
    ? `${base} No ${PIECE_CATALOG[pieceType].displayName} pieces left.`
    : base;
}

/**
 * The live-region sentence for picking up an already-placed piece (selecting
 * it for a move, swap, or return to tray). Progress is unchanged by picking
 * a piece up, so none is spoken here.
 */
export function describePiecePickedUp(
  pieceType: PieceTypeId,
  side: Side,
  square: Square,
): string {
  return `${pieceDescription(pieceType, side)} picked up from ${squareKey(square)}.`;
}

/**
 * The live-region sentence for deselecting an already-picked-up placed piece
 * (activating the same board square a second time, cancelling the pickup
 * without moving it) - symmetric with `describePiecePickedUp` above. Shares
 * `describeTrayDeselected`'s wording (a bare "{Color} {Piece} deselected.")
 * since "deselected" reads the same whether the piece came from the tray or
 * was picked up from the board; kept as its own function so each call site in
 * `HotSeatGame.tsx` names the event it actually means.
 */
export function describePieceDeselected(
  pieceType: PieceTypeId,
  side: Side,
): string {
  return `${pieceDescription(pieceType, side)} deselected.`;
}

/**
 * The live-region sentence for moving a picked-up piece to an empty square.
 * Progress is unchanged by a move (the piece was already placed), so none is
 * spoken here.
 */
export function describePieceMoved(
  pieceType: PieceTypeId,
  side: Side,
  square: Square,
): string {
  return `${pieceDescription(pieceType, side)} moved to ${squareKey(square)}.`;
}

/**
 * The live-region sentence for swapping two already-placed pieces. Both
 * belong to the active side (placement only ever shows one player's own
 * pieces), so the color is named once, up front, rather than for each piece.
 * Progress is unchanged by a swap, so none is spoken here.
 */
export function describePiecesSwapped(
  pieceTypeA: PieceTypeId,
  squareA: Square,
  pieceTypeB: PieceTypeId,
  squareB: Square,
  side: Side,
): string {
  const nameA = PIECE_CATALOG[pieceTypeA].displayName;
  const nameB = PIECE_CATALOG[pieceTypeB].displayName;
  return `${sideColorName(side)} ${nameA} and ${nameB} swapped places between ${squareKey(squareA)} and ${squareKey(squareB)}.`;
}

/**
 * The live-region sentence for returning a picked-up piece to the tray,
 * carrying the resulting progress (this changes how many pieces are
 * placed).
 */
export function describeReturnedToTray(
  pieceType: PieceTypeId,
  side: Side,
  square: Square,
  progress: PlacementProgress,
): string {
  return `${pieceDescription(pieceType, side)} returned to the tray from ${squareKey(square)}. ${progressPhrase(progress)}.`;
}

/**
 * The live-region sentence for clearing the whole board, carrying the
 * resulting (always-zero) progress.
 */
export function describeBoardCleared(progress: PlacementProgress): string {
  return `Board cleared. ${progressPhrase(progress)}.`;
}

/**
 * The live-region sentence for a successful Auto-fill, carrying the
 * resulting progress. Only for a *successful* completion - an exhausted
 * Auto-fill attempt (`placement.ts`'s `autoFill` reporting `{ ok: false }`)
 * is a Tower-rule refusal, reported instead by
 * `towerPlacementMessages.ts`'s `AUTO_FILL_TOWERS_EXHAUSTED_MESSAGE` through
 * the status region (Decisions item 4) - this sentence must not also speak
 * for that case.
 */
export function describeAutoFillCompleted(progress: PlacementProgress): string {
  return `Auto-fill complete. ${progressPhrase(progress)}.`;
}

/**
 * The live-region sentence for Confirm handing off to the next player
 * (Decisions item 6): names the *incoming* player by color and their
 * progress, which is always zero at that moment - this sentence
 * deliberately **replaces** the board's announcement rather than appending
 * to it, so nothing about the outgoing player's layout is left in the
 * region for the next player to hear.
 *
 * Also reused by `handleChooseGame` (peer review finding #2) to announce the
 * *opening* player's turn and starting progress, folded into the game-choice
 * sentence rather than the board's own region - the wording ("{Color}'s turn
 * to place their army. N of M placed.") fits both a hand-off from another
 * player and the very first turn equally well.
 */
export function describeHandOff(
  incomingSide: Side,
  progress: PlacementProgress,
): string {
  return `${sideColorName(incomingSide)}'s turn to place their army. ${progressPhrase(progress)}.`;
}

/**
 * The sentence for the moment both armies are placed and Phase 2 begins,
 * naming the side to move. Pushed into the *Phase-2* `playAnnouncement`
 * live region by `HotSeatGame.tsx` (Step 5), not the placement board's -
 * placement is over by the time this is said.
 */
export function describePlacementComplete(sideToMove: Side): string {
  return `Both armies are placed. ${sideColorName(sideToMove)} to move.`;
}
