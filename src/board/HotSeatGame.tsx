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
import { nonStandardRuleSentences } from "./ruleChoices.ts";
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
import {
  describeTowerLaneRefusal,
  towerLiveRegionMessage,
  type TowerAutoFillExhausted,
  type TowerRefusal,
} from "./towerPlacementMessages.ts";
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
import type { RuleConfiguration } from "../rules/primary/v2/configuration.ts";
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
  squaresClosedToTowers,
  swap,
  towerLaneRefusesPlacement,
  towerPlacementLegality,
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
// Story 00000002, Step 3: `Board`'s activation prop was renamed from
// `onSquareClick` to `onSquareActivate` when the placement board was ported
// onto the shared accessible grid, since activating a square is now also
// Enter/Space, not only a click - the call below is updated mechanically;
// `handleSquareClick` (the click-grammar handler itself, further down) keeps
// its name, since the grammar it implements is unchanged.
//
// Story 00000023, Step 7: `configuration` is `null` until the player chooses
// Battle or Skirmish (and, since story 00000027's Step 8, both diagonal-attack
// rule choices alongside it) on `GameChoice` - while it is `null` this
// component renders only that choice screen, before placement even begins.
// `handleChooseGame` sets `configuration` and seeds a fresh `session` from its
// edition in the same event, so a render with `configuration` set but
// `session` still `null` never actually happens (the `session === null` guard
// below exists only so TypeScript can narrow it, mirroring the pre-existing
// `session.active === null` guard's same "unreachable in practice" shape).
// "New game" resets both back to `null`, returning to the choice screen
// rather than silently replaying the same game - a fresh game is exactly the
// moment to reconsider which to play. The `lastPlayed` prop remembers which
// configuration that was (owner feedback at the Step 7 manual gate,
// 2026-08-01, extended by story 00000027's Step 8 from a bare `Edition` to a
// full `RuleConfiguration`): `GameChoice` pre-selects the game and both flags
// from it, so a player who just finished a Battle on non-standard flags sees
// all three pre-selected again rather than being reset every time -
// Skirmish and the standard flag values, per story.md's "the recommended
// game for a new player", stay the default only on the very first game of a
// session, while `lastPlayed` is still `null`. Unlike every other piece of
// state here, that memory is *not* scoped to this component's lifetime:
// `App` holds it (and this component reports each choice through
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
   * The configuration (game plus both diagonal-attack rule choices, story
   * 00000027) most recently started this app session, or `null` if none has
   * been. `GameChoice` pre-selects the game and both flags from it; `null`
   * falls back to Skirmish and the standard values. Held by `App` so it
   * survives this component's unmount (peer review, finding #17).
   */
  readonly lastPlayed: RuleConfiguration | null;
  /**
   * Reports the configuration the player has just chosen, so it becomes the
   * next choice screen's pre-selection - including after a game is abandoned
   * part way through, since it was still the last one played.
   */
  readonly onGameStarted: (configuration: RuleConfiguration) => void;
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
  // Story 00000023, Step 7: the Battle/Skirmish choice, widened by story
  // 00000027's Step 8 to the full rule configuration (game plus both
  // diagonal-attack flags) - `null` until the player picks one on
  // `GameChoice`, below. `session` stays `null` until then too;
  // `handleChooseGame` sets both together.
  const [configuration, setConfiguration] = useState<RuleConfiguration | null>(
    null,
  );
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
  // Story 00000025, Step 5: the drop-time refusal sentence
  // (`describeTowerLaneRefusal`) for the active player's own most recent
  // refused Tower placement, or `null` if nothing was just refused - `null`
  // by default and reset to `null` the moment the player starts a new
  // selection or completes any placement action, so it is always about the
  // click that was just refused, never a stale one (Decisions item 4: a
  // refusal is transient). Also reset on Confirm/hand-off so it never lingers
  // into the next player's turn.
  //
  // Peer review finding #5: pairs the text with a monotonically increasing
  // `seq`, bumped by `refuseTowerPlacement` below every time a refusal is
  // set - including a repeat refusal of the same square - so
  // `PlacementStatus`'s live region always gets a fresh token to key its
  // message element on, even when the refusal text itself repeats.
  const [towerRefusal, setTowerRefusal] = useState<TowerRefusal | null>(null);
  // Story 00000025, Step 8 (peer review finding #7): the most recent
  // exhausted Auto-fill attempt - no legal arrangement existed for the
  // remaining Towers - or `null` if none is pending. Transient and cleared
  // exactly like `towerRefusal` above (see `clearTowerFeedback`), and paired
  // with its own `seq` for the same reason (peer review finding #5): clicking
  // Auto-fill twice in a row while stuck must announce the message twice.
  const [autoFillExhausted, setAutoFillExhausted] =
    useState<TowerAutoFillExhausted | null>(null);

  // Clears both transient Tower-feedback events at once (a drop-time refusal
  // and an exhausted Auto-fill attempt), so every place that "moves on" from
  // one of them - a new selection, a completed placement action, or
  // confirm/hand-off - never accidentally leaves the other lingering behind
  // to outrank a lower-precedence message it shouldn't (Decisions item 4,
  // extended by Step 8).
  function clearTowerFeedback() {
    setTowerRefusal(null);
    setAutoFillExhausted(null);
  }

  // Sets a fresh drop-time refusal for `square`, always incrementing `seq`
  // (even if the previous refusal named the same square), so the live
  // region always gets a distinguishable message (peer review finding #5).
  // Also clears any pending exhausted-Auto-fill event: a drop-time refusal is
  // a newer, higher-precedence event superseding it.
  function refuseTowerPlacement(square: Square) {
    setAutoFillExhausted(null);
    setTowerRefusal((current) => ({
      text: describeTowerLaneRefusal(square),
      seq: (current?.seq ?? 0) + 1,
    }));
  }

  // Sets a fresh exhausted-Auto-fill event, always incrementing `seq` (peer
  // review finding #5's reasoning applied to this event too). Also clears any
  // pending drop-time refusal, since Auto-fill failing is itself a newer
  // event superseding it.
  function reportAutoFillExhausted() {
    setTowerRefusal(null);
    setAutoFillExhausted((current) => ({ seq: (current?.seq ?? 0) + 1 }));
  }
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
    configuration !== null &&
    (playSession === null || playSession.play.result.kind === "ongoing");

  function handleBackToStart() {
    if (gameInProgress) {
      setConfirmingLeave(true);
      return;
    }
    onBack();
  }

  // Starts a fresh two-player session for the chosen configuration
  // (`GameChoice` pre-selects the last-played game and both flags, or the
  // recommended first game on the standard values) and announces the choice
  // - the selected game, its board size, and (story 00000027, Step 8) any
  // non-standard rule the player picked - to the placement screen's live
  // region. The choice is reported to `App` here, as the game starts rather
  // than as it ends, so a game abandoned part way through still counts as the
  // one played most recently.
  function handleChooseGame(chosenConfiguration: RuleConfiguration) {
    onGameStarted(chosenConfiguration);
    setConfiguration(chosenConfiguration);
    setSession(newSession(chosenConfiguration.edition));
    const ruleSentences = nonStandardRuleSentences(chosenConfiguration);
    const ruleAnnouncement =
      ruleSentences.length > 0 ? ` ${ruleSentences.join(" ")}` : "";
    setGameAnnouncement(
      `You chose ${gameName(chosenConfiguration.edition)}. Placing on ${boardSizeDescription(chosenConfiguration.edition)}.${ruleAnnouncement}`,
    );
  }

  if (configuration === null) {
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
    // moment to reconsider which to play. `configuration` and `session` both
    // go back to `null` (which is what routes back to the choice screen
    // above), and `playSession`/the placement selection/both announcements
    // are cleared alongside them. The choice screen this returns to
    // pre-selects the game and both rule choices just played instead of
    // always resetting to the defaults (owner feedback at the Step 7 manual
    // gate, 2026-08-01, extended to the flags by story 00000027's Step 8) -
    // `lastPlayed` was recorded by `handleChooseGame` when this game began,
    // so nothing needs remembering here.
    const handleNewGame = () => {
      setConfiguration(null);
      setSession(null);
      setPlaySession(null);
      setSelection(null);
      setPlayAnnouncement("");
      setGameAnnouncement("");
      clearTowerFeedback();
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
    // the very same event as `configuration`, and React batches both updates
    // into one render, so the branch above always handles the "no
    // configuration chosen yet" case first. Kept only so TypeScript can
    // narrow `session` to `PlacementSession` below, mirroring
    // `EngineGame.tsx`'s identical guard for its own nullable `placement`.
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
    clearTowerFeedback();
    setSelection((current) =>
      current?.kind === "trayType" && current.type === type
        ? null
        : { kind: "trayType", type },
    );
  }

  // Story 00000025, Step 5: every path that could land a Tower on a closed
  // square is checked with `towerLaneRefusesPlacement` *before* calling
  // `place`/`move`/`swap` - those keep rejecting only structural-invariant
  // violations (see placement.ts's header), so the UI must never ask them to
  // perform something already known to be refused. A refusal leaves `session`
  // and `selection` untouched (the player can immediately try another
  // square) and only sets `towerRefusal`; every other branch below clears it,
  // since reaching a *different* action - a new selection or a completed
  // placement - means whatever was just refused is no longer the topic.
  function handleSquareClick(square: Square) {
    const occupied = pieceAt(placement, square) !== undefined;

    if (occupied) {
      if (selection?.kind === "boardSquare") {
        if (squareKey(selection.square) === squareKey(square)) {
          setSelection(null);
          clearTowerFeedback();
          return;
        }
        // A swap can send a Tower either way: the piece on `selection.square`
        // ends up on `square`, and the piece on `square` ends up on
        // `selection.square` - both directions must be checked (Step 5's
        // "swapping a Tower with a piece on a closed square").
        const movingIntoClicked = pieceAt(placement, selection.square);
        const movingIntoSelected = pieceAt(placement, square);
        if (
          movingIntoClicked === "tower" &&
          towerLaneRefusesPlacement(placement, square, "tower")
        ) {
          refuseTowerPlacement(square);
          return;
        }
        if (
          movingIntoSelected === "tower" &&
          towerLaneRefusesPlacement(placement, selection.square, "tower")
        ) {
          refuseTowerPlacement(selection.square);
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
        clearTowerFeedback();
        return;
      }
      setSelection({ kind: "boardSquare", square });
      clearTowerFeedback();
      return;
    }

    if (selection?.kind === "trayType") {
      const type = selection.type;
      if (towerLaneRefusesPlacement(placement, square, type)) {
        refuseTowerPlacement(square);
        return;
      }
      setSession((current) =>
        current
          ? updateActivePlacement(current, (state) =>
              place(state, square, type),
            )
          : current,
      );
      // Keep the type selected for rapid repeat-placement until it runs out.
      setSelection(placement.remaining[type] <= 1 ? null : selection);
      clearTowerFeedback();
      return;
    }

    if (selection?.kind === "boardSquare") {
      const movingType = pieceAt(placement, selection.square);
      if (
        movingType &&
        towerLaneRefusesPlacement(placement, square, movingType)
      ) {
        refuseTowerPlacement(square);
        return;
      }
      setSession((current) =>
        current
          ? updateActivePlacement(current, (state) =>
              move(state, selection.square, square),
            )
          : current,
      );
      setSelection(null);
      clearTowerFeedback();
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
    clearTowerFeedback();
  }

  function handleClearBoard() {
    setSession((current) =>
      current
        ? updateActivePlacement(current, (state) => clear(state))
        : current,
    );
    setSelection(null);
    clearTowerFeedback();
  }

  // Story 00000025, Step 8 (peer review finding #7): `autoFill` is computed
  // directly against `placement` (the active player's own state, already read
  // above) rather than inside `setSession`'s functional updater, so this
  // handler can inspect the result and decide what to do with it - a `setState`
  // updater is expected to be pure and side-effect-free, and reporting an
  // exhausted attempt is a side effect. On `{ ok: false }`, the board is left
  // exactly as it was (`autoFill` itself never touches `state` in that case)
  // and the exhausted-attempt message is reported instead.
  function handleAutoFill() {
    const result = autoFill(placement);
    if (!result.ok) {
      reportAutoFillExhausted();
      return;
    }
    setSession((current) =>
      current
        ? updateActivePlacement(current, (state) =>
            // `result.state` was computed above from `placement`, a snapshot
            // of `session`'s active side at render time - matching every
            // sibling handler's pattern of recomputing from the `state` React
            // hands this updater, only apply it when `current` is still that
            // same `session` (so `state` is exactly what `result` was built
            // from); otherwise `session` moved on since the click was
            // handled, and the stale auto-fill result must be discarded
            // rather than clobbering whatever `state` now is.
            current === session ? result.state : state,
          )
        : current,
    );
    setSelection(null);
    clearTowerFeedback();
  }

  function handleConfirm() {
    // `session`/`configuration` are narrowed non-null by the guards above for
    // the rest of this component's render, but TypeScript does not carry that
    // narrowing across this nested function's own boundary (the same reason
    // `EngineGame.tsx`'s `handleConfirm` re-checks `placement`/`humanSide`) -
    // unreachable in practice, since both are only ever `null` before a game
    // is chosen, at which point this handler is not yet wired to anything.
    if (session === null || configuration === null) {
      return;
    }
    const next = confirmActive(session);
    setSession(next);
    if (next.active === null) {
      // Both players have now confirmed: build the versioned initial
      // game-state artifact (story 00000001), under the configuration the
      // player chose on `GameChoice` (story 00000023, Step 7; widened from a
      // standard-only configuration to the player's own flag choices by
      // story 00000027's Step 8) - so play, rendering, and the record all use
      // the game and rules just chosen, and start Phase 2 immediately - per
      // the owner's decision, there is no separate "reveal" gate.
      const gameState = buildInitialGameState(
        next.white,
        next.black,
        configuration,
      );
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
    // Tower feedback is per active player and must never linger into the next
    // player's turn (Decisions item 4, extended by Step 8) - cleared here
    // whether this Confirm handed off to the other player or ended placement
    // outright.
    clearTowerFeedback();
  }

  const selectedSquare =
    selection?.kind === "boardSquare" ? selection.square : undefined;
  const selectedTrayType =
    selection?.kind === "trayType" ? selection.type : null;
  const selectedPieceType =
    selection?.kind === "boardSquare"
      ? pieceAt(placement, selection.square)
      : undefined;
  // Story 00000016, Step 6: Confirm requires both a complete army and the
  // Tower-placement rules (rules §3) being satisfied - since story 00000025's
  // Step 4, `towerPlacementLegality` covers both the spacing rule and (on a
  // `spacing_and_lanes` edition) the lane rule, as a confirm-time backstop
  // for the latter. The two are tracked separately so the status bar can
  // tell "not finished yet" apart from "finished, but a Tower rule is
  // broken" and show the latter's explanation only when it applies.
  const placementComplete = isComplete(placement);
  const legality = towerPlacementLegality(placement);
  const towerRuleOk = legality.legal;
  // Story 00000025, Step 5: a Tower is "in hand" exactly when the current
  // selection is a Tower - either picked from the tray or picked up from the
  // board (Decisions item 3). `closedSquares` is the active player's own
  // closed-to-Towers set while that holds, and `[]` otherwise - which drives
  // both the board's quiet marking and the live-region hint below, and is
  // always `[]` on Battle regardless of what is in hand
  // (`squaresClosedToTowers` is empty there by geometry).
  const towerInHand =
    selectedTrayType === "tower" || selectedPieceType === "tower";
  const closedSquares = towerInHand ? squaresClosedToTowers(placement) : [];
  // The one live-region message `PlacementStatus` shows right now (Decisions
  // item 4's precedence, extended by Step 8: refusal, then an exhausted
  // Auto-fill attempt, then the hint, then the confirm-time block, then
  // nothing). The confirm-time block is only ever considered once the army is
  // complete, matching this rule's pre-Step-5 behavior.
  const towerMessage = towerLiveRegionMessage({
    refusal: towerRefusal,
    autoFillExhausted,
    closedSquares,
    legality: placementComplete ? legality : { legal: true },
  });

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
        towerMessage={towerMessage}
        onAutoFill={handleAutoFill}
        onConfirm={handleConfirm}
      />
      <div className="app__layout">
        <div className="app__board-column">
          <Board
            activeSide={activeSide}
            placement={placement}
            layout={placement.boardLayout}
            onSquareActivate={handleSquareClick}
            selectedSquare={selectedSquare}
            closedToTowerSquares={closedSquares}
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
