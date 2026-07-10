import { APP_NAME } from "./appInfo.ts";
import { PieceSpriteDefs } from "./art/PieceIcon.tsx";
import { Board } from "./board/Board.tsx";
import "./App.css";

// Step 7: board geometry & terrain only, from White's perspective. The tray,
// placement interactions, and the two-player hand-off (Steps 8-10) build on
// top of this shell.
const ACTIVE_SIDE = "white";

export function App() {
  return (
    <main className="app">
      <PieceSpriteDefs />
      <h1 className="app__title">{APP_NAME}</h1>
      <Board activeSide={ACTIVE_SIDE} />
    </main>
  );
}
