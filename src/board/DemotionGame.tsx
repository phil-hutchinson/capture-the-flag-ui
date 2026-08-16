// The Demotion (ruleset major 3) play surface (story 00000036, Step 14;
// wired for interaction in Step 15; endings, the draw offer and resignation
// added in Step 16).
//
// `HotSeatGame.tsx` mounts this in place of its placement/Phase-2 branches
// once a major-3 game is chosen (Decision 11), inside the same persistent
// shell (the `<h1>`, "Back to start", `LeaveGameDialog`, and game-
// announcement live region all stay in `HotSeatGame.tsx` itself, unchanged
// in every branch - this component owns only the game's own content).
//
// The board draws through `FullBoard` (Step 11's major-agnostic renderer),
// fed by the fixed major-3 geometry and the current position
// (`boardViewAdapterV3.ts`, Step 14). Step 15 wires activation through
// `v3PlaySession.ts` exactly as `PlayBoard.tsx` does for major 2: the
// selected square, the selected piece's legal plain-move destinations and
// attack targets (`actionableSquares`/`attackTargets`), and the strictly
// larger `activatableSquares` set that actually responds to a click or
// Enter/Space are all derived from `session` here, mirroring
// `PlayBoard.tsx`'s own derivation one-for-one. With nothing selected, no
// square is highlighted (`actionableSquares` returns the side-to-move's own
// movable pieces in that state, deliberately left unhighlighted - see
// `PlayBoard.tsx`'s module comment for why). `onActivate` and `announcement`
// are owned by `HotSeatGame.tsx`, which turns a raw activation into a call to
// `v3PlaySession.ts`'s `activateSquare` and derives the live-region text via
// `v3PlayAnnouncement.ts`'s `describeActivation` - this component never calls
// either itself.
//
// Rank reduction needs no special handling here: `boardPositionForDemotion`
// (`boardViewAdapterV3.ts`) already reads each piece's *current* rank on
// every render, so a demoted piece's artwork and corner numeral update the
// moment `session.play.board` reflects the demotion - nothing about this
// component's own rendering depends on whether a piece has been demoted.
//
// The turn indicator (`PlayStatus`) and the flip-board toggle
// (`FlipBoardToggle`) are the same major-agnostic/shared components major
// 2's own Phase-2 branch already uses - see `v3PlaySession.ts`'s `viewSide`
// for the orientation contract, identical to major 2's `playSession.ts`.
//
// Step 16 (this plan's Decision 5, 9 and 10): while the game is ongoing this
// component renders the turn indicator, the shared inactivity countdown
// (`playWarnings.ts`, parameterized against v3's own `INACTIVITY_LIMIT` -
// 40, not major 2's 50), the shared `DrawOffer` control, and - new to this
// app - `ResignControl` (Decision 9), which is hidden while a draw offer is
// pending an answer (the board is already inert in that state, and the
// offer is itself a decision already in progress). Once the game has ended,
// all four of those are replaced by the shared, presentational `GameResult`
// panel (Step 11), fed by `v3PlayAnnouncement.ts`'s own `describeResult` -
// the same six sentences fixed by this plan's Decision 5. Every one of these
// endings is pushed into the same board live region the ply narrative
// already uses (`HotSeatGame.tsx`'s `demotionAnnouncement`), never a second
// region, so nothing is ever announced twice. The board itself (`FullBoard`)
// keeps rendering even once the game has ended, showing the final position -
// `activatableSquares`/`destinationSquares`/`attackSquares` are already
// empty by then (`v3PlaySession.ts`'s `isInert`), so it simply stops
// responding.

import type { Square } from "../rules/primary/v3/board.ts";
import { INACTIVITY_LIMIT } from "../rules/primary/v3/outcome.ts";
import {
  boardGeometryForDemotion,
  boardPositionForDemotion,
} from "./boardViewAdapterV3.ts";
import { DrawOffer } from "./DrawOffer.tsx";
import { FlipBoardToggle } from "./FlipBoardToggle.tsx";
import { FullBoard } from "./FullBoard.tsx";
import { GameResult } from "./GameResult.tsx";
import { computeCountdownWarnings } from "./playWarnings.ts";
import { PlayStatus } from "./PlayStatus.tsx";
import { PlayWarnings } from "./PlayWarnings.tsx";
import { ResignControl } from "./ResignControl.tsx";
import { describeResult } from "./v3PlayAnnouncement.ts";
import {
  actionableSquares,
  activatableSquares,
  attackTargets,
  viewSide,
  type PlaySession,
} from "./v3PlaySession.ts";

export interface DemotionGameProps {
  /** The in-progress major-3 session: whose turn, the board, and any current selection. */
  readonly session: PlaySession;
  /**
   * The player's "Flip board between turns" setting (mirrors major 2's own
   * `PlayBoard.tsx` prop of the same name), passed straight through to
   * `viewSide`.
   */
  readonly flipBetweenTurns: boolean;
  /** Called with the new value whenever the player toggles the flip-board switch. */
  readonly onFlipBetweenTurnsChange: (flipBetweenTurns: boolean) => void;
  /** Called with the domain square of an actionable cell when it is activated. */
  readonly onActivate: (square: Square) => void;
  /**
   * Text pushed into the board's polite live region - what a piece was
   * selected with how many moves it has, what just moved (or attacked) and
   * where, any demotion the survivor suffered, whose turn it now is, and -
   * once the game ends by any route - the result sentence. `HotSeatGame.tsx`
   * derives this from session transitions via `v3PlayAnnouncement.ts`'s
   * `describeActivation`/`describeResult`/`describeResignation`.
   */
  readonly announcement?: string;
  /** Starts a fresh game: back to the "Choose a game" screen. */
  readonly onNewGame: () => void;
  /** Offers a draw (rules.md §5.6) on behalf of the current side to move. */
  readonly onOfferDraw: () => void;
  /** Accepts the pending draw offer, ending the game immediately as an agreed draw. */
  readonly onAcceptDraw: () => void;
  /** Declines the pending draw offer; play returns to the offering player. */
  readonly onDeclineDraw: () => void;
  /**
   * Resigns (rules.md §5.5, Decision 9) on behalf of the current side to
   * move, ending the game immediately as a win for the opponent - called
   * only after `ResignControl`'s own two-step confirmation.
   */
  readonly onResign: () => void;
}

/**
 * The Demotion play surface: the turn indicator (or, once the game has
 * ended, the result panel), the inactivity countdown, the draw offer and
 * resign controls, the flip-board toggle, and the full board, drawn from
 * `viewSide`'s perspective, with the current selection's destinations and
 * attack targets highlighted and the activatable set driving which squares
 * respond - see module comment.
 */
export function DemotionGame({
  session,
  flipBetweenTurns,
  onFlipBetweenTurnsChange,
  onActivate,
  announcement,
  onNewGame,
  onOfferDraw,
  onAcceptDraw,
  onDeclineDraw,
  onResign,
}: DemotionGameProps) {
  const side = viewSide(session, flipBetweenTurns);
  const { result } = session.play;

  return (
    <>
      {result.kind === "ongoing" ? (
        <>
          <PlayStatus
            sideToMove={session.play.sideToMove}
            drawOfferPending={session.drawOffer !== null}
          />
          <PlayWarnings
            warnings={computeCountdownWarnings(
              result.kind === "ongoing",
              session.play.inactivityCounter,
              INACTIVITY_LIMIT,
            )}
          />
          <DrawOffer
            drawOffer={session.drawOffer}
            onOffer={onOfferDraw}
            onAccept={onAcceptDraw}
            onDecline={onDeclineDraw}
          />
          {session.drawOffer === null && (
            <ResignControl
              resigningSide={session.play.sideToMove}
              onResign={onResign}
            />
          )}
        </>
      ) : (
        <GameResult
          outcomeKind={result.kind === "win" ? "win" : "draw"}
          winner={result.kind === "win" ? result.winner : null}
          summary={describeResult(result)}
          onNewGame={onNewGame}
        />
      )}
      <FlipBoardToggle
        flipBetweenTurns={flipBetweenTurns}
        onChange={onFlipBetweenTurnsChange}
      />
      <FullBoard
        position={boardPositionForDemotion(session.play.board)}
        side={side}
        geometry={boardGeometryForDemotion()}
        selected={session.selection ?? undefined}
        // Only a selected piece's legal destinations are highlighted; with
        // nothing selected `actionableSquares` returns the side-to-move's own
        // movable pieces, deliberately left unhighlighted (see
        // `PlayBoard.tsx`'s module comment for the same policy at major 2).
        destinationSquares={session.selection ? actionableSquares(session) : []}
        attackSquares={attackTargets(session)}
        activatableSquares={activatableSquares(session)}
        onActivate={onActivate}
        announcement={announcement}
      />
    </>
  );
}
