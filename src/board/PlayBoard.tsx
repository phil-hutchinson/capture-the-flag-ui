// Thin `PlaySession`-to-`FullBoard` adapter for the hot-seat game. Story
// 00000014, Step 7 extracted the presentational board (orientation,
// highlighting, activation, accessibility) into `FullBoard.tsx` so the game
// reviewer could share it without depending on `PlaySession`; this module now
// only derives `FullBoard`'s props from a `PlaySession`, exactly as the
// combined component did before the extraction, so the hot-seat game's
// behavior and appearance are unchanged.
//
// Orientation follows `playSession.ts`'s `viewSide` (story 00000004, Step 4's
// `fullBoardRows`): each hand-off re-renders the board from the perspective
// of the player now sitting at it, their home edge nearest them. That is
// normally the side to move, the exception being a pending draw offer, which
// hands the board to the opponent to answer without changing whose turn it
// is (story 00000006, Step 13). This component itself is
// unaware of the move grammar (select/deselect/move) - it only derives
// whichever squares are highlighted and which respond to activation, and
// reports raw square activations up to the caller via `onActivate`; App.tsx
// owns turning an activation into a selection, a deselect, a switch, or a
// move (via `activateSquare`).
//
// Only an *in-progress selection* is ever highlighted here: the picked-up
// piece, its legal plain-move destinations, and its legal attack targets
// (`actionableSquares`/`attackTargets`, `playSession.ts`) - see
// `FullBoard.tsx`'s module comment for the full visual policy, including why
// each of those, the keyboard-focus ring, and the review-only `lastMove`
// highlight (unused here) all stay visually distinct. With nothing selected,
// no square is highlighted at all: which of your own pieces can move is left
// self-evident.
//
// That visual set is strictly smaller than the set of squares that actually
// *respond* to activation. The accessible grid's activation gate is driven by
// `activatableSquares` from `playSession.ts` - every own movable piece plus,
// while one is selected, its legal destinations and legal attack targets - so
// picking up a piece, deselecting it, and switching to a different own piece
// are all reachable by mouse and keyboard even though an unselected movable
// piece shows no highlight.

import type { Side, Square } from "../rules/primary/v1/board.ts";
import { FullBoard } from "./FullBoard.tsx";
import {
  actionableSquares,
  activatableSquares,
  attackTargets,
  viewSide,
  type PlaySession,
} from "./playSession.ts";

export interface PlayBoardProps {
  /** The in-progress Phase-2 session: whose turn, the board, and any selection. */
  readonly session: PlaySession;
  /**
   * The player's "Flip board between turns" setting (story 00000012, Step
   * 2), passed straight through to `viewSide`: `true` (today's behavior)
   * flips to whichever side is sitting at the board at each hand-off and
   * while a draw offer is answered; `false` always draws from red's
   * (`"white"`'s) perspective, throughout Phase 2. Ignored when `side` is
   * given (below). Defaults to `true`.
   */
  readonly flipBetweenTurns?: boolean;
  /**
   * Overrides orientation to always draw from this side's perspective,
   * regardless of whose turn it is or `flipBetweenTurns` (story 00000019:
   * the against-the-computer mode always shows the human player's own side,
   * which `flipBetweenTurns`'s hardcoded-to-red `false` case cannot express
   * when the human is playing blue). When given, `viewSide`/`flipBetweenTurns`
   * are not consulted at all.
   */
  readonly side?: Side;
  /** Called with the domain square of an actionable cell when it is activated. */
  readonly onActivate: (square: Square) => void;
  /**
   * Text pushed into the board's polite live region (Gate D) - what a piece
   * was selected with how many moves it has, what just moved and where, and
   * whose turn it now is. The caller (`App.tsx`) derives this from session
   * transitions via `playAnnouncement.ts`'s `describeActivation`.
   */
  readonly announcement?: string;
  /**
   * Presents the board as fully inert - no selection, no destination/attack
   * highlight, no activatable square - regardless of `session`'s own state
   * (story 00000019: while it is the computer's turn, its own pieces are
   * structurally "the side to move's own movable pieces" per
   * `playSession.ts`, but the human must not be able to act on them).
   * Defaults to `false` (hot-seat's existing behavior, unchanged).
   */
  readonly disabled?: boolean;
  /**
   * The computer's just-applied move, mid-slide (story 00000019, Step 9) -
   * threaded straight through to `FullBoard`'s prop of the same name (see
   * its own doc comment for the full contract). Additive and default-off,
   * exactly like `side`/`disabled` above; omitted by hot-seat and review, so
   * neither is affected.
   */
  readonly animatedMove?: { readonly from: Square; readonly to: Square };
}

/**
 * The full 12x12 board, oriented to `viewSide(session, flipBetweenTurns)`
 * (Step 4; the flag added in story 00000012, Step 2), drawn via `FullBoard`
 * (story 00000014, Step 7). The only highlighted squares are for an
 * in-progress selection: the selected piece and its legal destinations (from
 * `actionableSquares` once a piece is selected); with nothing selected no
 * square is highlighted. Which squares actually respond to activation come
 * from the larger `activatableSquares` (Step 9), so illegal moves are never
 * offered while selecting, deselecting, and switching selection remain
 * reachable.
 */
export function PlayBoard({
  session,
  flipBetweenTurns = true,
  side: fixedSide,
  onActivate,
  announcement,
  disabled = false,
  animatedMove,
}: PlayBoardProps) {
  const side = fixedSide ?? viewSide(session, flipBetweenTurns);

  return (
    <FullBoard
      board={session.play.board}
      side={side}
      selected={disabled ? undefined : (session.selection ?? undefined)}
      // Only a selected piece's legal destinations are highlighted; with
      // nothing selected `actionableSquares` returns own movable pieces,
      // which we deliberately leave unhighlighted (see the module comment).
      destinationSquares={
        disabled || !session.selection ? [] : actionableSquares(session)
      }
      // The subset of the above that are attacks rather than plain moves
      // (Step 5's `attackTargets` - empty with nothing selected), so
      // `FullBoard` can render and label them distinctly from plain move
      // destinations.
      attackSquares={disabled ? [] : attackTargets(session)}
      activatableSquares={disabled ? [] : activatableSquares(session)}
      onActivate={onActivate}
      announcement={announcement}
      animatedMove={animatedMove}
    />
  );
}
