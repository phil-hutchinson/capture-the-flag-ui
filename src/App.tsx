import { useState } from "react";
import { APP_NAME } from "./appInfo.ts";
import { PieceSpriteDefs } from "./art/PieceIcon.tsx";
import { Board } from "./board/Board.tsx";
import { Tray } from "./board/Tray.tsx";
import type { Square } from "./rules/primary/v1_1/board.ts";
import {
  emptyPlacement,
  pieceAt,
  place,
  type PlacementState,
} from "./rules/primary/v1_1/placement.ts";
import type { PieceTypeId } from "./rules/primary/v1_1/pieces.ts";
import "./App.css";

// Step 8: a single active player's placement loop only (White), with a
// tray-selection then click-to-place interaction. The two-player hand-off
// and session model (Steps 10-11), and interacting with already-placed
// pieces (Step 9), build on top of this.
const ACTIVE_SIDE = "white";

export function App() {
  const [placement, setPlacement] = useState<PlacementState>(() =>
    emptyPlacement(ACTIVE_SIDE),
  );
  const [selectedType, setSelectedType] = useState<PieceTypeId | null>(null);

  function handleSelectType(type: PieceTypeId) {
    setSelectedType((current) => (current === type ? null : type));
  }

  function handleSquareClick(square: Square) {
    if (selectedType === null) {
      return;
    }
    if (pieceAt(placement, square) !== undefined) {
      // Interacting with an already-placed piece is Step 9's scope.
      return;
    }

    const next = place(placement, square, selectedType);
    setPlacement(next);
    if (next.remaining[selectedType] <= 0) {
      // Nothing left of this type - clear the selection automatically.
      setSelectedType(null);
    }
  }

  return (
    <main className="app">
      <PieceSpriteDefs />
      <h1 className="app__title">{APP_NAME}</h1>
      <div className="app__layout">
        <Board
          activeSide={ACTIVE_SIDE}
          placement={placement}
          onSquareClick={handleSquareClick}
        />
        <Tray
          side={ACTIVE_SIDE}
          remaining={placement.remaining}
          selectedType={selectedType}
          onSelect={handleSelectType}
        />
      </div>
    </main>
  );
}
