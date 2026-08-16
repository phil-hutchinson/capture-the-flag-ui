// The Demotion (ruleset major 3) play surface (story 00000036, Step 14).
//
// For this step, the game only **starts and draws** - nothing responds.
// `HotSeatGame.tsx` mounts this in place of its placement/Phase-2 branches
// once a major-3 game is chosen (Decision 11), inside the same persistent
// shell (the `<h1>`, "Back to start", `LeaveGameDialog`, and game-
// announcement live region all stay in `HotSeatGame.tsx` itself, unchanged
// in every branch - this component owns only the game's own content).
//
// The board draws through `FullBoard` (Step 11's major-agnostic renderer),
// fed by the fixed major-3 geometry and the current position
// (`boardViewAdapterV3.ts`, this step). **No square is activatable** - Step
// 15 wires interaction through `v3PlaySession.ts`'s `activateSquare`; until
// then this component passes no `activatableSquares`/`onActivate` at all, so
// `FullBoard` renders every square focusable and readable but inert.
//
// The turn indicator (`PlayStatus`) and the flip-board toggle
// (`FlipBoardToggle`) are the same major-agnostic/shared components major
// 2's own Phase-2 branch already uses - see `v3PlaySession.ts`'s `viewSide`
// for the orientation contract, identical to major 2's `playSession.ts`.

import { FlipBoardToggle } from "./FlipBoardToggle.tsx";
import {
  boardGeometryForDemotion,
  boardPositionForDemotion,
} from "./boardViewAdapterV3.ts";
import { FullBoard } from "./FullBoard.tsx";
import { PlayStatus } from "./PlayStatus.tsx";
import { viewSide, type PlaySession } from "./v3PlaySession.ts";

export interface DemotionGameProps {
  /** The in-progress major-3 session: whose turn, the board, and (from Step 15) any selection. */
  readonly session: PlaySession;
  /**
   * The player's "Flip board between turns" setting (mirrors major 2's own
   * `PlayBoard.tsx` prop of the same name), passed straight through to
   * `viewSide`.
   */
  readonly flipBetweenTurns: boolean;
  /** Called with the new value whenever the player toggles the flip-board switch. */
  readonly onFlipBetweenTurnsChange: (flipBetweenTurns: boolean) => void;
}

/**
 * The Demotion play surface: the turn indicator, the flip-board toggle, and
 * the full board, drawn from `viewSide`'s perspective. No square responds to
 * activation yet - see module comment.
 */
export function DemotionGame({
  session,
  flipBetweenTurns,
  onFlipBetweenTurnsChange,
}: DemotionGameProps) {
  const side = viewSide(session, flipBetweenTurns);

  return (
    <>
      <PlayStatus
        sideToMove={session.play.sideToMove}
        drawOfferPending={session.drawOffer !== null}
      />
      <FlipBoardToggle
        flipBetweenTurns={flipBetweenTurns}
        onChange={onFlipBetweenTurnsChange}
      />
      <FullBoard
        position={boardPositionForDemotion(session.play.board)}
        side={side}
        geometry={boardGeometryForDemotion()}
      />
    </>
  );
}
