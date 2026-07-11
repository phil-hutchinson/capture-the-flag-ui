import { useState } from "react";
import { APP_NAME } from "./appInfo.ts";
import { PieceSpriteDefs } from "./art/PieceIcon.tsx";
import { Board } from "./board/Board.tsx";
import { PlacementControls } from "./board/PlacementControls.tsx";
import { PlacementStatus } from "./board/PlacementStatus.tsx";
import {
  activePlacement,
  confirmActive,
  newSession,
  updateActivePlacement,
  type PlacementSession,
} from "./board/placementSession.ts";
import { SessionComplete } from "./board/SessionComplete.tsx";
import { Tray } from "./board/Tray.tsx";
import { squareKey, type Square } from "./rules/primary/v1_1/board.ts";
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
} from "./rules/primary/v1_1/placement.ts";
import type { PieceTypeId } from "./rules/primary/v1_1/pieces.ts";
import "./App.css";

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

export function App() {
  const [session, setSession] = useState<PlacementSession>(() => newSession());
  const [selection, setSelection] = useState<Selection>(null);

  if (session.active === null) {
    // Both players have confirmed: this is the story's terminal, neutral
    // "both armies ready" end state (Step 11 — Gate E). It never renders a
    // `Board` or either player's `PlacementState`, so it reveals neither
    // layout; SessionComplete separately surfaces the inspectable, versioned
    // initial game-state artifact (Step 5) built from both final placements.
    return (
      <main className="app">
        <PieceSpriteDefs />
        <h1 className="app__title">{APP_NAME}</h1>
        <SessionComplete white={session.white} black={session.black} />
      </main>
    );
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
    setSession((current) => confirmActive(current));
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
      <h1 className="app__title">{APP_NAME}</h1>
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
