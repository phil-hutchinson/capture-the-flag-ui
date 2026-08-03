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
import { boardSizeDescription, gameName } from "./gameNames.ts";
import { GameChoice } from "./GameChoice.tsx";
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
import { squareKey, type Square } from "../rules/primary/v2/board.ts";
import type { Edition } from "../rules/primary/v2/edition.ts";
import { buildInitialGameState } from "../rules/primary/v2/gameState.ts";
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
  towersLegallyPlaced,
} from "../rules/primary/v2/placement.ts";
import type { PieceTypeId } from "../rules/primary/v2/pieces.ts";
import "../App.css";
import "./HotSeatGame.css";

// The hot-seat game: a Battle/Skirmish choice, then placement (Phase 1), then
// play (Phase 2), moved verbatim out of `App.tsx` (story 00000014, Step 8) so
// it can live in its own component with its own state. `App.tsx` mounts this
// whenever `screen.kind === "play"` and nothing else; every bit of state
// below is local to this component, so mounting always starts a fresh choice
// and unmounting discards whatever game was in progress.
//
// Story 00000023, Step 7: `edition` is `null` until the player chooses Battle
// or Skirmish on `GameChoice` - while it is `null` this component renders
// only that choice screen, before placement even begins. `handleChooseGame`
// sets `edition` and seeds a fresh `session` from it in the same event, so a
// render with `edition` set but `session` still `null` never actually
// happens (the `session === null` guard below exists only so TypeScript can
// narrow it, mirroring the pre-existing `session.active === null` guard's
// same "unreachable in practice" shape). "New game" resets both back to
// `null`, returning to the choice screen rather than silently replaying the
// same game - a fresh game is exactly the moment to reconsider which to
// play. The `lastPlayed` prop remembers which game that was (owner feedback
// at the Step 7 manual gate, 2026-08-01): `GameChoice` pre-selects it, so a
// player who just finished a Battle sees Battle pre-selected again rather
// than being reset to Skirmish every time - Skirmish, per story.md's "the
// recommended game for a new player", stays the default only on the very
// first game of a session, while `lastPlayed` is still `null`. Unlike every
// other piece of state here, that memory is *not* scoped to this component's
// lifetime: `App` holds it (and this component reports each choice through
// `onGameStarted`) so it survives a trip back to the start screen, which is
// the whole session story.md's amended Policy bullet asks for (peer review,
// finding #17).
//
// Step 15: "Back to start" (`onBack`, supplied by `App.tsx`) sits right
// after the title in every one of this component's four states - the
// Battle/Skirmish choice, placement, an ongoing Phase-2 game, and a finished
// one - the same spot `ReviewScreen.tsx`'s own back button occupies.
// `gameInProgress` below is true throughout placement and throughout an
// ongoing game (never during the choice screen, where nothing is yet at
// stake) and false once the game has ended; leaving while it is true first
// opens `LeaveGameDialog` (a confirmation, since the game would be lost),
// while leaving the choice screen or a finished game calls `onBack` straight
// away, exactly like leaving a review. Cancelling the dialog changes nothing
// in `session` / `playSession` / `selection`, so the game (including any
// in-progress selection) is left exactly as it was.
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
   * The game most recently started this app session, or `null` if none has
   * been. `GameChoice` pre-selects it; `null` falls back to Skirmish, the
   * recommended first game. Held by `App` so it survives this component's
   * unmount (peer review, finding #17).
   */
  readonly lastPlayed: Edition | null;
  /**
   * Reports the game the player has just chosen, so it becomes the next
   * choice screen's pre-selection - including after a game is abandoned part
   * way through, since it was still the last one played.
   */
  readonly onGameStarted: (edition: Edition) => void;
  /**
   * Returns to the start screen. Called directly once the game has ended;
   * while the game is in progress (placing or playing), called only after
   * the player confirms in `LeaveGameDialog`, since the game is lost.
   */
  readonly onBack: () => void;
}

export function HotSeatGame({
  lastPlayed,
  onGameStarted,
  onBack,
}: HotSeatGameProps) {
  // Story 00000023, Step 7: the Battle/Skirmish choice - `null` until the
  // player picks one on `GameChoice`, below. `session` stays `null` until
  // then too; `handleChooseGame` sets both together.
  const [edition, setEdition] = useState<Edition | null>(null);
  const [session, setSession] = useState<PlacementSession | null>(null);
  // Text pushed into the placement screen's own polite live region the
  // moment a game is chosen (`handleChooseGame`, below) - names the game and
  // its board size to assistive tech, mirroring `playAnnouncement`'s "always
  // mounted, sometimes empty" live-region pattern (`PlacementStatus`'s tower
  // warning) applied to a brand-new region that mounts, for the first time,
  // already carrying this text - the same "pre-filled on first mount" shape
  // `handleConfirm`'s immediate-ending announcement below already uses for
  // the Phase-2 live region.
  const [gameAnnouncement, setGameAnnouncement] = useState("");
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

  // Story 00000014, Step 15 (extended by Step 7 of story 00000023): true once
  // a game has been chosen and throughout placement (`playSession` is
  // `null`) and throughout an ongoing Phase-2 game, false while the
  // Battle/Skirmish choice is still showing (nothing is yet at stake) and
  // once the game has ended - i.e. exactly the condition under which leaving
  // would lose something.
  const gameInProgress =
    edition !== null &&
    (playSession === null || playSession.play.result.kind === "ongoing");

  function handleBackToStart() {
    if (gameInProgress) {
      setConfirmingLeave(true);
      return;
    }
    onBack();
  }

  // Starts a fresh two-player session for the chosen game (`GameChoice`
  // pre-selects the last-played game, or Skirmish on the first game of a
  // session) and announces the choice - the selected game and its board
  // size - to the placement screen's live region. The choice is reported to
  // `App` here, as the game starts rather than as it ends, so a game
  // abandoned part way through still counts as the one played most recently.
  function handleChooseGame(chosenEdition: Edition) {
    onGameStarted(chosenEdition);
    setEdition(chosenEdition);
    setSession(newSession(chosenEdition));
    setGameAnnouncement(
      `You chose ${gameName(chosenEdition)}. Placing on ${boardSizeDescription(chosenEdition)}.`,
    );
  }

  if (edition === null) {
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
        <GameChoice onChoose={handleChooseGame} lastPlayed={lastPlayed} />
      </main>
    );
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

    // Story 00000006, Step 10: "New game" is a full reset - back to the
    // Battle/Skirmish choice (story 00000023, Step 7), rather than silently
    // replaying the game just finished, since a fresh game is exactly the
    // moment to reconsider which to play. `edition` and `session` both go
    // back to `null` (which is what routes back to the choice screen above),
    // and `playSession`/the placement selection/both announcements are
    // cleared alongside them. The choice screen this returns to pre-selects
    // the game just played instead of always resetting to Skirmish (owner
    // feedback at the Step 7 manual gate, 2026-08-01) - `lastPlayed` was
    // recorded by `handleChooseGame` when this game began, so nothing needs
    // remembering here.
    const handleNewGame = () => {
      setEdition(null);
      setSession(null);
      setPlaySession(null);
      setSelection(null);
      setPlayAnnouncement("");
      setGameAnnouncement("");
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

  if (session === null) {
    // Unreachable in practice: `handleChooseGame` always sets `session` in
    // the very same event as `edition`, and React batches both updates into
    // one render, so the branch above always handles the "no edition chosen
    // yet" case first. Kept only so TypeScript can narrow `session` to
    // `PlacementSession` below, mirroring `EngineGame.tsx`'s identical guard
    // for its own nullable `placement`.
    return null;
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
          current
            ? updateActivePlacement(current, (state) =>
                swap(state, selection.square, square),
              )
            : current,
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
        current
          ? updateActivePlacement(current, (state) =>
              place(state, square, type),
            )
          : current,
      );
      // Keep the type selected for rapid repeat-placement until it runs out.
      setSelection(placement.remaining[type] <= 1 ? null : selection);
      return;
    }

    if (selection?.kind === "boardSquare") {
      setSession((current) =>
        current
          ? updateActivePlacement(current, (state) =>
              move(state, selection.square, square),
            )
          : current,
      );
      setSelection(null);
    }
  }

  function handleReturnToTray() {
    if (selection?.kind !== "boardSquare") {
      return;
    }
    setSession((current) =>
      current
        ? updateActivePlacement(current, (state) =>
            returnToTray(state, selection.square),
          )
        : current,
    );
    setSelection(null);
  }

  function handleClearBoard() {
    setSession((current) =>
      current
        ? updateActivePlacement(current, (state) => clear(state))
        : current,
    );
    setSelection(null);
  }

  function handleAutoFill() {
    setSession((current) =>
      current
        ? updateActivePlacement(current, (state) => autoFill(state))
        : current,
    );
    setSelection(null);
  }

  function handleConfirm() {
    // `session`/`edition` are narrowed non-null by the guards above for the
    // rest of this component's render, but TypeScript does not carry that
    // narrowing across this nested function's own boundary (the same reason
    // `EngineGame.tsx`'s `handleConfirm` re-checks `placement`/`humanSide`) -
    // unreachable in practice, since both are only ever `null` before a game
    // is chosen, at which point this handler is not yet wired to anything.
    if (session === null || edition === null) {
      return;
    }
    const next = confirmActive(session);
    setSession(next);
    if (next.active === null) {
      // Both players have now confirmed: build the versioned initial
      // game-state artifact (story 00000001), tagged with the chosen edition
      // (story 00000023, Step 7) so play, rendering, and the record all use
      // the game just chosen, and start Phase 2 immediately - per the
      // owner's decision, there is no separate "reveal" gate.
      const gameState = buildInitialGameState(next.white, next.black, edition);
      const freshPlaySession = startSession(gameState);
      setPlaySession(freshPlaySession);
      // Story 00000006, Step 9: placement is unrestricted, so a game-ending
      // condition (e.g. the side to move having no legal move) can in theory
      // already hold at the reveal, before either player has made a single
      // move - no activation occurs to drive `describeActivation`, so
      // announce the result directly here.
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
  // Story 00000016, Step 6: Confirm requires both a complete (25-piece) army
  // and the Tower-adjacency rule (rules §3) being satisfied. The two are
  // tracked separately so the status bar can tell "not finished yet" apart
  // from "finished, but two Towers are touching" and show the latter's
  // explanation only when it applies.
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
      {/* Announces the chosen game and its board size (story 00000023, Step
          7) - visually hidden, `role="status"`/`aria-live="polite"` like
          `AccessibleGrid`'s own live region, so a screen-reader user hears
          which game and board they just chose even though this text is
          otherwise redundant with `GameChoice`'s visible confirmation. */}
      <p
        className="hot-seat-game__game-announcement"
        role="status"
        aria-live="polite"
      >
        {gameAnnouncement}
      </p>
      <PlacementStatus
        side={activeSide}
        progress={progress(placement)}
        canConfirm={placementComplete && towerRuleOk}
        towerAdjacencyBlocked={placementComplete && !towerRuleOk}
        onAutoFill={handleAutoFill}
        onConfirm={handleConfirm}
      />
      <div className="app__layout">
        <div className="app__board-column">
          <Board
            activeSide={activeSide}
            placement={placement}
            layout={placement.boardLayout}
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
          army={placement.army}
          remaining={placement.remaining}
          selectedType={selectedTrayType}
          onSelect={handleSelectType}
        />
      </div>
    </main>
  );
}
