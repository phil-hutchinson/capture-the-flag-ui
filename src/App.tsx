import { useState } from "react";
import { APP_NAME } from "./appInfo.ts";
import { PieceSpriteDefs } from "./art/PieceIcon.tsx";
import { Board } from "./board/Board.tsx";
import { PlacementControls } from "./board/PlacementControls.tsx";
import { Tray } from "./board/Tray.tsx";
import { squareKey, type Square } from "./rules/primary/v1_1/board.ts";
import {
  clear,
  emptyPlacement,
  move,
  pieceAt,
  place,
  placedCount,
  returnToTray,
  swap,
  type PlacementState,
} from "./rules/primary/v1_1/placement.ts";
import type { PieceTypeId } from "./rules/primary/v1_1/pieces.ts";
import "./App.css";

// Step 8/9: a single active player's placement loop only (White). The
// two-player hand-off and session model (Steps 10-11) build on top of this.
const ACTIVE_SIDE = "white";

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
  const [placement, setPlacement] = useState<PlacementState>(() =>
    emptyPlacement(ACTIVE_SIDE),
  );
  const [selection, setSelection] = useState<Selection>(null);

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
        setPlacement((current) => swap(current, selection.square, square));
        setSelection(null);
        return;
      }
      setSelection({ kind: "boardSquare", square });
      return;
    }

    if (selection?.kind === "trayType") {
      const next = place(placement, square, selection.type);
      setPlacement(next);
      setSelection(next.remaining[selection.type] <= 0 ? null : selection);
      return;
    }

    if (selection?.kind === "boardSquare") {
      setPlacement((current) => move(current, selection.square, square));
      setSelection(null);
    }
  }

  function handleReturnToTray() {
    if (selection?.kind !== "boardSquare") {
      return;
    }
    setPlacement((current) => returnToTray(current, selection.square));
    setSelection(null);
  }

  function handleClearBoard() {
    setPlacement((current) => clear(current));
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
      <div className="app__layout">
        <div className="app__board-column">
          <Board
            activeSide={ACTIVE_SIDE}
            placement={placement}
            onSquareClick={handleSquareClick}
            selectedSquare={selectedSquare}
          />
          <PlacementControls
            side={ACTIVE_SIDE}
            selectedPieceType={selectedPieceType}
            onReturnToTray={handleReturnToTray}
            onCancelSelection={() => setSelection(null)}
            onClearBoard={handleClearBoard}
            canClear={placedCount(placement) > 0}
          />
        </div>
        <Tray
          side={ACTIVE_SIDE}
          remaining={placement.remaining}
          selectedType={selectedTrayType}
          onSelect={handleSelectType}
        />
      </div>
    </main>
  );
}
