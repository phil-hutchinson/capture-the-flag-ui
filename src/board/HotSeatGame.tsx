import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "../appInfo.ts";
import { PieceSpriteDefs } from "../art/PieceIcon.tsx";
import { Board } from "./Board.tsx";
import { DrawOffer } from "./DrawOffer.tsx";
import {
  readFlipBetweenTurns,
  writeFlipBetweenTurns,
} from "./flipBoardSetting.ts";
import { FlipBoardToggle } from "./FlipBoardToggle.tsx";
import { GameRecord } from "./GameRecord.tsx";
import { GameResult } from "./GameResult.tsx";
import { LeaveGameDialog } from "./LeaveGameDialog.tsx";
import { PlacementControls } from "./PlacementControls.tsx";
import { PlacementStatus } from "./PlacementStatus.tsx";
import {
  activePlacement,
  confirmActive,
  newSession,
  updateActivePlacement,
  type PlacementSession,
} from "./placementSession.ts";
import {
  describeActivation,
  describeDrawAccepted,
  describeDrawDecline,
  describeDrawOffer,
  describeResult,
} from "./playAnnouncement.ts";
import { PlayBoard } from "./PlayBoard.tsx";
import {
  acceptDraw,
  activateSquare,
  declineDraw,
  offerDraw,
  startSession,
  type PlaySession,
} from "./playSession.ts";
import { PlayStatus } from "./PlayStatus.tsx";
import { computeCountdownWarnings } from "./playWarnings.ts";
import { PlayWarnings } from "./PlayWarnings.tsx";
import { Tray } from "./Tray.tsx";
import { squareKey, type Square } from "../rules/primary/v1_1/board.ts";
import { buildInitialGameState } from "../rules/primary/v1_1/gameState.ts";
import {
  autoFill,
  clear,
  isComplete,
  move,
  pieceAt,
  place,
  placedCount,
  progress,
  returnToTray,
  swap,
} from "../rules/primary/v1_1/placement.ts";
import type { PieceTypeId } from "../rules/primary/v1_1/pieces.ts";
import "../App.css";
import "./HotSeatGame.css";

// The hot-seat game: placement (Phase 1) then play (Phase 2), moved verbatim
// out of `App.tsx` (story 00000014, Step 8) so it can live in its own
// component with its own state. `App.tsx` mounts this whenever
// `screen.kind === "play"` and nothing else; every bit of state below is
// local to this component, so mounting always starts a fresh placement and
// unmounting discards whatever game was in progress.
//
// Step 15: "Back to start" (`onBack`, supplied by `App.tsx`) sits right
// after the title in every one of this component's three states -
// placement, an ongoing Phase-2 game, and a finished one - the same spot
// `ReviewScreen.tsx`'s own back button occupies. `gameInProgress` below is
// true throughout placement and throughout an ongoing game and false only
// once the game has ended; leaving while it is true first opens
// `LeaveGameDialog` (a confirmation, since the game would be lost), while
// leaving a finished game calls `onBack` straight away, exactly like leaving
// a review. Cancelling the dialog changes nothing in `session` / `playSession`
// / `selection`, so the game (including any in-progress selection) is left
// exactly as it was.
//
// Step 10 drives the whole app from a two-player `PlacementSession`
// (src/board/placementSession.ts) rather than a single hardcoded active
// side: `session.active` says whose turn it is, and every placement
// operation below is routed through `updateActivePlacement` so it only ever
// touches the active player's own layout. Confirming (`handleConfirm`) is
// the hand-off - it stores the active player's layout and advances
// `session.active` to the other side, whose board starts empty - and also
// resets the local click-selection below, since a selection from one
// player's board should never carry over to the next player's.
//
// Step 9's click grammar for interacting with an in-progress layout, layered
// on top of Step 8's tray-select-then-place loop. There are two mutually
// exclusive selection tracks - selecting one always clears the other:
//
//  - `trayType`: a piece type picked from the tray, ready to place (Step 8,
//    unchanged). Clicking the same type again deselects it.
//  - `boardSquare`: an already-placed piece picked up from the board.
//
// Clicking an *occupied* home square always operates on the board-selection
// track, discarding any pending tray selection:
//  - nothing selected yet -> selects this square (picks the piece up);
//  - this same square is already selected -> deselects it;
//  - a *different* square is already selected -> swaps the two pieces, then
//    clears the selection.
//
// Clicking an *empty* home square:
//  - a tray type is selected -> places it there (Step 8, unchanged);
//  - a placed square is selected -> moves that piece here, then clears the
//    selection;
//  - nothing selected -> no-op.
//
// "Return to tray" and "Clear board" (PlacementControls) are explicit
// buttons rather than reachable through the square-click grammar above:
// once "click an empty square" already means move-here and "click another
// placed piece" already means swap, there is no second click-on-a-square
// gesture left to spend on "put it back in the tray" without overloading
// one of those two meanings.
type Selection =
  | { readonly kind: "trayType"; readonly type: PieceTypeId }
  | { readonly kind: "boardSquare"; readonly square: Square }
  | null;

export interface HotSeatGameProps {
  /**
   * Returns to the start screen. Called directly once the game has ended;
   * while the game is in progress (placing or playing), called only after
   * the player confirms in `LeaveGameDialog`, since the game is lost.
   */
  readonly onBack: () => void;
}

export function HotSeatGame({ onBack }: HotSeatGameProps) {
  const [session, setSession] = useState<PlacementSession>(() => newSession());
  const [selection, setSelection] = useState<Selection>(null);
  // Step 15: whether "Back to start" needs to ask for confirmation first.
  // Never touches `session` / `playSession` / `selection` - cancelling
  // simply closes the dialog again, leaving the game exactly as it was.
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // Story 00000004, Step 7: once both players confirm, the app auto-advances
  // straight into Phase 2 - there is no intermediate "reveal armies" step.
  // `playSession` is `null` throughout placement and is set exactly once, by
  // `handleConfirm` below, the moment the second player confirms.
  const [playSession, setPlaySession] = useState<PlaySession | null>(null);
  // Story 00000004, Step 9 (Gate D): text pushed into the board's polite live
  // region. Derived from the session immediately before and after each
  // activation via `describeActivation`, so a screen reader hears the piece
  // just selected (and how many moves it has), the move just made and where
  // it went, and whose turn it now is - the turn hand-off is announced here
  // rather than by `PlayStatus` (a plain visual indicator) so it is never
  // announced twice from two different live regions.
  const [playAnnouncement, setPlayAnnouncement] = useState("");
  // Story 00000012, Step 4: the "Flip board between turns" setting. It is a
  // device setting, not part of any game, so it is initialized once from
  // local storage (lazy initializer, defaulting to on when nothing is
  // stored) and every change is written straight back through
  // `writeFlipBetweenTurns` - independent of `handleNewGame` below, which
  // never touches it.
  const [flipBetweenTurns, setFlipBetweenTurns] = useState(() =>
    readFlipBetweenTurns(),
  );
  const handleFlipBetweenTurnsChange = (next: boolean) => {
    setFlipBetweenTurns(next);
    writeFlipBetweenTurns(next);
  };

  // Story 00000014, Step 8: focus moves to this screen's own heading once,
  // on mount - i.e. the moment the player chooses "Play a game" from the
  // start screen - so a keyboard or screen-reader user is not left stranded
  // on `<body>`. The empty dependency array means this never re-fires as the
  // game progresses from placement into play; that transition is not a
  // screen change, and Phase 2 already announces its own hand-offs through
  // the board's live region.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Story 00000014, Step 15: true throughout placement (`playSession` is
  // `null`) and throughout an ongoing Phase-2 game, false only once the game
  // has ended - i.e. exactly the condition under which leaving would lose
  // something.
  const gameInProgress =
    playSession === null || playSession.play.result.kind === "ongoing";

  function handleBackToStart() {
    if (gameInProgress) {
      setConfirmingLeave(true);
      return;
    }
    onBack();
  }

  if (playSession !== null) {
    // Phase 2: both armies are placed and fully visible on one board,
    // oriented to whichever side is to move next (Step 4's `fullBoardRows`,
    // re-evaluated on every render as `playSession.play.sideToMove`
    // changes). All interaction - selecting a piece, moving it, and the turn
    // hand-off - flows through `activateSquare` (Step 6); this component
    // only turns a grid activation into that one call (plus deriving the
    // live-region announcement for it).
    const handlePlayActivate = (square: Square) => {
      const next = activateSquare(playSession, square);
      setPlaySession(next);
      setPlayAnnouncement(describeActivation(playSession, next, square));
    };

    // Story 00000006, Step 10: "New game" is a full reset - a fresh, empty
    // Phase-1 placement session for both players. Nothing from the finished
    // game carries over: `playSession` goes back to `null` (which is what
    // routes back to the placement branch below), and the placement
    // selection/announcement state are cleared alongside it.
    const handleNewGame = () => {
      setSession(newSession());
      setPlaySession(null);
      setSelection(null);
      setPlayAnnouncement("");
    };

    // Story 00000006, Step 13: the draw-offer flow (rules.md §6.6). Each
    // handler delegates the state transition to `playSession.ts` and pushes
    // the matching sentence (`playAnnouncement.ts`) into the same live
    // region the ply narrative already uses, so nothing is announced twice
    // from two different regions.
    const handleOfferDraw = () => {
      const offeringSide = playSession.play.sideToMove;
      setPlaySession(offerDraw(playSession));
      setPlayAnnouncement(describeDrawOffer(offeringSide));
    };

    const handleAcceptDraw = () => {
      const next = acceptDraw(playSession);
      setPlaySession(next);
      setPlayAnnouncement(describeDrawAccepted(next.play.result));
    };

    const handleDeclineDraw = () => {
      const { drawOffer } = playSession;
      if (drawOffer === null) {
        return;
      }
      setPlaySession(declineDraw(playSession));
      setPlayAnnouncement(describeDrawDecline(drawOffer));
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
          className="hot-seat-game__back"
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
            <PlayStatus
              sideToMove={playSession.play.sideToMove}
              drawOfferPending={playSession.drawOffer !== null}
            />
            <PlayWarnings
              warnings={computeCountdownWarnings(playSession.play)}
            />
            <DrawOffer
              drawOffer={playSession.drawOffer}
              onOffer={handleOfferDraw}
              onAccept={handleAcceptDraw}
              onDecline={handleDeclineDraw}
            />
          </>
        ) : (
          <GameResult result={result} onNewGame={handleNewGame} />
        )}
        <FlipBoardToggle
          flipBetweenTurns={flipBetweenTurns}
          onChange={handleFlipBetweenTurnsChange}
        />
        <PlayBoard
          session={playSession}
          flipBetweenTurns={flipBetweenTurns}
          announcement={playAnnouncement}
          onActivate={handlePlayActivate}
        />
        <GameRecord play={playSession.play} />
      </main>
    );
  }

  if (session.active === null) {
    // Unreachable in practice: `handleConfirm` always starts `playSession`
    // in the very same event as advancing `session.active` to `null`, and
    // React batches both updates into one render, so the branch above always
    // handles that case first. Kept only so TypeScript can narrow
    // `session.active` to `Side` below.
    return null;
  }

  const activeSide = session.active;
  const placement = activePlacement(session);

  function handleSelectType(type: PieceTypeId) {
    setSelection((current) =>
      current?.kind === "trayType" && current.type === type
        ? null
        : { kind: "trayType", type },
    );
  }

  function handleSquareClick(square: Square) {
    const occupied = pieceAt(placement, square) !== undefined;

    if (occupied) {
      if (selection?.kind === "boardSquare") {
        if (squareKey(selection.square) === squareKey(square)) {
          setSelection(null);
          return;
        }
        setSession((current) =>
          updateActivePlacement(current, (state) =>
            swap(state, selection.square, square),
          ),
        );
        setSelection(null);
        return;
      }
      setSelection({ kind: "boardSquare", square });
      return;
    }

    if (selection?.kind === "trayType") {
      const type = selection.type;
      setSession((current) =>
        updateActivePlacement(current, (state) => place(state, square, type)),
      );
      // Keep the type selected for rapid repeat-placement until it runs out.
      setSelection(placement.remaining[type] <= 1 ? null : selection);
      return;
    }

    if (selection?.kind === "boardSquare") {
      setSession((current) =>
        updateActivePlacement(current, (state) =>
          move(state, selection.square, square),
        ),
      );
      setSelection(null);
    }
  }

  function handleReturnToTray() {
    if (selection?.kind !== "boardSquare") {
      return;
    }
    setSession((current) =>
      updateActivePlacement(current, (state) =>
        returnToTray(state, selection.square),
      ),
    );
    setSelection(null);
  }

  function handleClearBoard() {
    setSession((current) =>
      updateActivePlacement(current, (state) => clear(state)),
    );
    setSelection(null);
  }

  function handleAutoFill() {
    setSession((current) =>
      updateActivePlacement(current, (state) => autoFill(state)),
    );
    setSelection(null);
  }

  function handleConfirm() {
    const next = confirmActive(session);
    setSession(next);
    if (next.active === null) {
      // Both players have now confirmed: build the versioned initial
      // game-state artifact (story 00000001) and start Phase 2 immediately -
      // per the owner's decision, there is no separate "reveal" gate.
      const gameState = buildInitialGameState(next.white, next.black);
      const freshPlaySession = startSession(gameState);
      setPlaySession(freshPlaySession);
      // Story 00000006, Step 9: placement is unrestricted, so the
      // Unbreachable Flag condition (§6.2) can already hold at the reveal,
      // before either player has made a single move - no activation occurs
      // to drive `describeActivation`, so announce the result directly here.
      if (freshPlaySession.play.result.kind !== "ongoing") {
        setPlayAnnouncement(describeResult(freshPlaySession.play.result));
      }
    }
    setSelection(null);
  }

  const selectedSquare =
    selection?.kind === "boardSquare" ? selection.square : undefined;
  const selectedTrayType =
    selection?.kind === "trayType" ? selection.type : null;
  const selectedPieceType =
    selection?.kind === "boardSquare"
      ? pieceAt(placement, selection.square)
      : undefined;

  return (
    <main className="app">
      <PieceSpriteDefs />
      <h1 className="app__title" tabIndex={-1} ref={headingRef}>
        {APP_NAME}
      </h1>
      <button
        type="button"
        className="hot-seat-game__back"
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
        side={activeSide}
        progress={progress(placement)}
        canConfirm={isComplete(placement)}
        onAutoFill={handleAutoFill}
        onConfirm={handleConfirm}
      />
      <div className="app__layout">
        <div className="app__board-column">
          <Board
            activeSide={activeSide}
            placement={placement}
            onSquareClick={handleSquareClick}
            selectedSquare={selectedSquare}
          />
          <PlacementControls
            side={activeSide}
            selectedPieceType={selectedPieceType}
            onReturnToTray={handleReturnToTray}
            onCancelSelection={() => setSelection(null)}
            onClearBoard={handleClearBoard}
            canClear={placedCount(placement) > 0}
          />
        </div>
        <Tray
          side={activeSide}
          remaining={placement.remaining}
          selectedType={selectedTrayType}
          onSelect={handleSelectType}
        />
      </div>
    </main>
  );
}
