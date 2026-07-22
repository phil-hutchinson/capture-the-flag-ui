import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "../appInfo.ts";
import { PieceSpriteDefs } from "../art/PieceIcon.tsx";
import { chooseEnginePly } from "../engine/enginePlayer.ts";
import { Board } from "./Board.tsx";
import { EngineSideChoice } from "./EngineSideChoice.tsx";
import { GameRecord } from "./GameRecord.tsx";
import { GameResult } from "./GameResult.tsx";
import { LeaveGameDialog } from "./LeaveGameDialog.tsx";
import { PlacementControls } from "./PlacementControls.tsx";
import { PlacementStatus } from "./PlacementStatus.tsx";
import { describeActivation, describeResult } from "./playAnnouncement.ts";
import { PlayBoard } from "./PlayBoard.tsx";
import {
  activateSquare,
  startSession,
  type PlaySession,
} from "./playSession.ts";
import { PlayStatus } from "./PlayStatus.tsx";
import { computeCountdownWarnings } from "./playWarnings.ts";
import { PlayWarnings } from "./PlayWarnings.tsx";
import { Tray } from "./Tray.tsx";
import {
  otherSide,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v1/board.ts";
import { buildInitialGameState } from "../rules/primary/v1/gameState.ts";
import {
  autoFill,
  clear,
  emptyPlacement,
  isComplete,
  move,
  pieceAt,
  place,
  placedCount,
  progress,
  returnToTray,
  swap,
  towersLegallyPlaced,
  type PlacementState,
} from "../rules/primary/v1/placement.ts";
import type { PieceTypeId } from "../rules/primary/v1/pieces.ts";
import "../App.css";
import "./EngineGame.css";

// The against-the-computer game (story 00000019, Step 5): a side choice,
// then placement (Phase 1) for the human's own army only, then play (Phase
// 2) against the engine. `App.tsx` mounts this whenever `screen.kind ===
// "engine"` and nothing else, exactly as it mounts `HotSeatGame` for
// `"play"` - so mounting always starts fresh (no side chosen yet) and
// unmounting discards whatever was in progress.
//
// Unlike `HotSeatGame`'s two-player `PlacementSession` (`placementSession.ts`,
// which hands off between two human players sharing one device), only the
// human ever places an army here - the computer's is generated silently by
// `autoFill` the moment the human confirms - so this component holds a
// single `PlacementState` directly rather than the two-player session
// wrapper, driving it through the exact same pure operations
// (`place`/`move`/`swap`/`returnToTray`/`clear`/`autoFill`) and the exact
// same `Board`/`Tray`/`PlacementControls`/`PlacementStatus` components
// `HotSeatGame` uses - the same click grammar (Step 9 of story 00000001,
// copied verbatim below) reused, not forked, just for one player instead of
// two.
//
// Phase 2 reuses `PlaySession`/`activateSquare` unmodified. The only
// genuinely new thing is *who* supplies the next move: on the human's turn
// this behaves exactly like `HotSeatGame`'s Phase-2 branch; on the
// computer's turn `applyEnginePly` (below) drives the identical
// `activateSquare` -> `applyMove` path via `chooseEnginePly` (story
// 00000019, Step 4)'s async seam. Board orientation is always the human's
// own side (`PlayBoard`'s new `side` prop, Step 5) - there is no "flip
// between turns" control in this mode (story.md's "Board orientation is
// always yours"), and there is no draw-offer control either.
type Selection =
  | { readonly kind: "trayType"; readonly type: PieceTypeId }
  | { readonly kind: "boardSquare"; readonly square: Square }
  | null;

export interface EngineGameProps {
  /**
   * Returns to the start screen. Called directly from the side-choice phase
   * (nothing is in progress yet); while placing or playing, called only
   * after the player confirms in `LeaveGameDialog`, since the game is lost.
   */
  readonly onBack: () => void;
}

export function EngineGame({ onBack }: EngineGameProps) {
  const [humanSide, setHumanSide] = useState<Side | null>(null);
  const [placement, setPlacement] = useState<PlacementState | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  // Same purpose as `HotSeatGame.tsx`'s own flag: whether "Back to start"
  // needs to ask for confirmation first. Never touches `placement` /
  // `playSession` / `selection` - cancelling simply closes the dialog again.
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [playSession, setPlaySession] = useState<PlaySession | null>(null);
  // Text pushed into the board's one polite live region - both the ordinary
  // ply narrative (`describeActivation`, same as `HotSeatGame.tsx`) and the
  // "computer is thinking" sentence below, so nothing is ever announced
  // twice from two different live regions (the visible "thinking" text
  // rendered further down is deliberately plain, no live region of its own -
  // see its own comment).
  const [playAnnouncement, setPlayAnnouncement] = useState("");

  // Focus moves to this screen's own heading once, on mount - i.e. the
  // moment the player chooses "Play against the computer" from the start
  // screen - mirroring `HotSeatGame.tsx`/`StartScreen.tsx`'s identical
  // pattern. The same ref is reused across every phase's heading below
  // (side choice, placement, play) since they are all the same mounted
  // component, not separate screens; this effect never re-fires as the game
  // progresses from one phase to the next.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // True from the moment a side is chosen until the game ends - i.e.
  // exactly the condition under which leaving would lose something. False
  // throughout the side-choice phase (nothing chosen yet, nothing to lose).
  const gameInProgress =
    humanSide !== null &&
    (playSession === null || playSession.play.result.kind === "ongoing");

  function handleBackToStart() {
    if (gameInProgress) {
      setConfirmingLeave(true);
      return;
    }
    onBack();
  }

  // The computer's ply (story 00000019, Step 5). Fires exactly when it
  // becomes the computer's turn in an ongoing game - never during the side
  // choice or placement, never on the human's own turn, never once the game
  // has ended (the three guards below). `chooseEnginePly` (Step 4) is a
  // single network evaluation plus a legal-masked sample; it is never
  // called more than once per computer turn, because the effect's own
  // dependencies only change again once a ply has actually been applied
  // (which flips `sideToMove` away from the computer).
  //
  // Two correctness hazards this guards against:
  //  - React StrictMode double-invokes effects in dev: the `cancelled` flag
  //    set in the cleanup means a resolved-but-superseded first invocation's
  //    promise callback is a no-op.
  //  - The player can leave mid-thought (confirming `LeaveGameDialog`
  //    unmounts this whole component) or, in principle, the position could
  //    move on before the promise resolves; the same `cancelled` flag (set
  //    on unmount, via the effect's cleanup) means a stale move is never
  //    applied to a session the player is no longer looking at.
  useEffect(() => {
    if (playSession === null || humanSide === null) {
      return;
    }
    const computerSide = otherSide(humanSide);
    if (
      playSession.play.result.kind !== "ongoing" ||
      playSession.play.sideToMove !== computerSide
    ) {
      return;
    }

    let cancelled = false;
    const beforeMove = playSession;
    setPlayAnnouncement("The computer is thinking.");

    chooseEnginePly(beforeMove.play)
      .then(({ from, to }) => {
        if (cancelled) {
          return;
        }
        const { after, announcement } = applyEnginePly(beforeMove, from, to);
        setPlaySession(after);
        setPlayAnnouncement(announcement);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        // `chooseEnginePly` only ever resolves to a legal ply (Step 2/4's
        // invariant) or rejects - it never resolves to an illegal one. A
        // rejection here means the network/WASM runtime itself failed, not
        // an illegal move; surface it rather than leaving the board silently
        // stuck with no feedback and no way forward except leaving.
        console.error("The computer's move failed:", error);
        setPlayAnnouncement(
          "The computer could not make a move. Leave this game and start a new one.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [playSession, humanSide]);

  if (humanSide === null) {
    return (
      <main className="app">
        <PieceSpriteDefs />
        <h1 className="app__title" tabIndex={-1} ref={headingRef}>
          {APP_NAME}
        </h1>
        <button
          type="button"
          className="engine-game__back"
          onClick={handleBackToStart}
        >
          Back to start
        </button>
        <LeaveGameDialog
          open={confirmingLeave}
          onConfirm={onBack}
          onCancel={() => setConfirmingLeave(false)}
        />
        <EngineSideChoice
          onChoose={(side) => {
            setHumanSide(side);
            setPlacement(emptyPlacement(side));
          }}
        />
      </main>
    );
  }

  if (playSession !== null) {
    const computerSide = otherSide(humanSide);
    const computerThinking =
      playSession.play.result.kind === "ongoing" &&
      playSession.play.sideToMove === computerSide;

    // The human's own turn behaves exactly like `HotSeatGame.tsx`'s
    // `handlePlayActivate`: turn a raw grid activation into `activateSquare`
    // and derive the announcement from the before/after transition. Guarded
    // against the computer's own turn as defense in depth - `PlayBoard`'s
    // `disabled` prop below already withholds every activatable square while
    // `computerThinking`, so this is never actually reachable then, but a
    // stray activation must never move the computer's own pieces.
    const handlePlayActivate = (square: Square) => {
      if (computerThinking) {
        return;
      }
      const next = activateSquare(playSession, square);
      setPlaySession(next);
      setPlayAnnouncement(describeActivation(playSession, next, square));
    };

    // "New game" (`GameResult`'s shared action) resets all the way back to
    // the side choice - fresh side choice, fresh placement, fresh random
    // computer army - the same "starts cleanly" guarantee the story asks of
    // leaving and re-entering the mode, applied here too rather than only on
    // a full remount.
    const handleNewGame = () => {
      setHumanSide(null);
      setPlacement(null);
      setSelection(null);
      setPlaySession(null);
      setPlayAnnouncement("");
    };

    const { result } = playSession.play;

    return (
      <main className="app">
        <PieceSpriteDefs />
        <h1 className="app__title" tabIndex={-1} ref={headingRef}>
          {APP_NAME}
        </h1>
        <button
          type="button"
          className="engine-game__back"
          onClick={handleBackToStart}
        >
          Back to start
        </button>
        <LeaveGameDialog
          open={confirmingLeave}
          onConfirm={onBack}
          onCancel={() => setConfirmingLeave(false)}
        />
        {result.kind === "ongoing" ? (
          <>
            <PlayStatus sideToMove={playSession.play.sideToMove} />
            {computerThinking && (
              // Visual only, deliberately no live region of its own - the
              // same sentence is already announced exactly once through the
              // board's own live region above (`setPlayAnnouncement`, in the
              // effect), so a second live region here would double-speak it
              // (the same reasoning `GameResult.tsx`'s visible summary
              // documents for the end-of-game sentence).
              <p className="engine-game__thinking">The computer is thinking…</p>
            )}
            <PlayWarnings
              warnings={computeCountdownWarnings(playSession.play)}
            />
          </>
        ) : (
          <GameResult result={result} onNewGame={handleNewGame} />
        )}
        <PlayBoard
          session={playSession}
          side={humanSide}
          announcement={playAnnouncement}
          onActivate={handlePlayActivate}
          disabled={computerThinking}
        />
        <GameRecord play={playSession.play} />
      </main>
    );
  }

  if (placement === null) {
    // Unreachable in practice: choosing a side always sets `placement` in
    // the very same event as `humanSide`, and React batches both updates
    // into one render. Kept only so TypeScript can narrow `placement` to
    // non-null below, mirroring `HotSeatGame.tsx`'s identical guard for
    // `session.active`.
    return null;
  }

  function handleSelectType(type: PieceTypeId) {
    setSelection((current) =>
      current?.kind === "trayType" && current.type === type
        ? null
        : { kind: "trayType", type },
    );
  }

  function handleSquareClick(square: Square) {
    if (placement === null) {
      return;
    }
    const occupied = pieceAt(placement, square) !== undefined;

    if (occupied) {
      if (selection?.kind === "boardSquare") {
        if (squareKey(selection.square) === squareKey(square)) {
          setSelection(null);
          return;
        }
        setPlacement((current) =>
          current ? swap(current, selection.square, square) : current,
        );
        setSelection(null);
        return;
      }
      setSelection({ kind: "boardSquare", square });
      return;
    }

    if (selection?.kind === "trayType") {
      const type = selection.type;
      setPlacement((current) =>
        current ? place(current, square, type) : current,
      );
      // Keep the type selected for rapid repeat-placement until it runs out.
      setSelection(placement.remaining[type] <= 1 ? null : selection);
      return;
    }

    if (selection?.kind === "boardSquare") {
      setPlacement((current) =>
        current ? move(current, selection.square, square) : current,
      );
      setSelection(null);
    }
  }

  function handleReturnToTray() {
    if (selection?.kind !== "boardSquare") {
      return;
    }
    setPlacement((current) =>
      current ? returnToTray(current, selection.square) : current,
    );
    setSelection(null);
  }

  function handleClearBoard() {
    setPlacement((current) => (current ? clear(current) : current));
    setSelection(null);
  }

  function handleAutoFill() {
    setPlacement((current) => (current ? autoFill(current) : current));
    setSelection(null);
  }

  function handleConfirm() {
    if (placement === null || humanSide === null) {
      return;
    }
    const computerSide = otherSide(humanSide);
    // The computer's army: a valid random arrangement (no two Towers
    // adjacent), generated silently and never shown before play begins - the
    // same `autoFill` the human's own "Auto-fill" button uses, applied to a
    // fresh, empty placement for the computer's side.
    const computerArmy = autoFill(emptyPlacement(computerSide));
    const gameState =
      humanSide === "white"
        ? buildInitialGameState(placement, computerArmy)
        : buildInitialGameState(computerArmy, placement);
    const freshPlaySession = startSession(gameState);
    setPlaySession(freshPlaySession);
    setSelection(null);
    // Mirrors `HotSeatGame.tsx`'s reveal-time check: placement is
    // unrestricted, so a game-ending condition could in theory already hold
    // the instant both armies are on the board, before either side has
    // moved - no activation occurs to drive `describeActivation` then, so
    // announce the result directly here.
    if (freshPlaySession.play.result.kind !== "ongoing") {
      setPlayAnnouncement(describeResult(freshPlaySession.play.result));
    }
  }

  const selectedSquare =
    selection?.kind === "boardSquare" ? selection.square : undefined;
  const selectedTrayType =
    selection?.kind === "trayType" ? selection.type : null;
  const selectedPieceType =
    selection?.kind === "boardSquare"
      ? pieceAt(placement, selection.square)
      : undefined;
  const placementComplete = isComplete(placement);
  const towerRuleOk = towersLegallyPlaced(placement);

  return (
    <main className="app">
      <PieceSpriteDefs />
      <h1 className="app__title" tabIndex={-1} ref={headingRef}>
        {APP_NAME}
      </h1>
      <button
        type="button"
        className="engine-game__back"
        onClick={handleBackToStart}
      >
        Back to start
      </button>
      <LeaveGameDialog
        open={confirmingLeave}
        onConfirm={onBack}
        onCancel={() => setConfirmingLeave(false)}
      />
      <PlacementStatus
        side={humanSide}
        progress={progress(placement)}
        canConfirm={placementComplete && towerRuleOk}
        towerAdjacencyBlocked={placementComplete && !towerRuleOk}
        onAutoFill={handleAutoFill}
        onConfirm={handleConfirm}
      />
      <div className="app__layout">
        <div className="app__board-column">
          <Board
            activeSide={humanSide}
            placement={placement}
            onSquareClick={handleSquareClick}
            selectedSquare={selectedSquare}
          />
          <PlacementControls
            side={humanSide}
            selectedPieceType={selectedPieceType}
            onReturnToTray={handleReturnToTray}
            onCancelSelection={() => setSelection(null)}
            onClearBoard={handleClearBoard}
            canClear={placedCount(placement) > 0}
          />
        </div>
        <Tray
          side={humanSide}
          remaining={placement.remaining}
          selectedType={selectedTrayType}
          onSelect={handleSelectType}
        />
      </div>
    </main>
  );
}

/**
 * Applies the computer's chosen `{ from, to }` ply through the exact same
 * `activateSquare` -> `applyMove` path a human's two clicks (select, then
 * activate the destination) would drive - never a bespoke call into
 * `play.ts`'s `applyMove` - so the computer's move gets the same
 * announcements, record entry, and game-end detection a human's move does.
 * `describeActivation` is derived from the select-then-move transition pair,
 * exactly as `PlaySession`/`playAnnouncement.ts` intend, rather than the
 * intermediate "N moves available" selection sentence a human's first click
 * produces - the player only ever hears the finished move, matching how a
 * human move is announced.
 */
function applyEnginePly(
  before: PlaySession,
  from: Square,
  to: Square,
): { after: PlaySession; announcement: string } {
  const selected = activateSquare(before, from);
  const after = activateSquare(selected, to);
  return { after, announcement: describeActivation(selected, after, to) };
}
