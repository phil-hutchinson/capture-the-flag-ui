import { useState } from "react";
import { StartScreen } from "./app/StartScreen.tsx";
import { EngineGame } from "./board/EngineGame.tsx";
import { HotSeatGame } from "./board/HotSeatGame.tsx";
import { ImportScreen } from "./review/ImportScreen.tsx";
import { ReviewScreen } from "./review/ReviewScreen.tsx";
import type { ReplayedRecord } from "./rules/primary/v1/replay.ts";

// The app shell (story 00000014, Step 8; a fifth screen added by story
// 00000019, Step 5): which of the app's screens is showing, held as a
// discriminated union in `useState` - no router library, no URL routing
// (both out of scope; see story.md). Each screen is its own component with
// its own state, mounted and unmounted here as `screen` changes: mounting
// `HotSeatGame` or `EngineGame` starts a fresh game and unmounting it
// discards whatever was in progress, and likewise a fresh import screen
// begins import cleanly every time "Review a game" is chosen.
//
// Every non-`start` screen can lead back to `start`: `ImportScreen` and
// `ReviewScreen`'s own "Back" controls (Step 9) never prompt, since nothing
// is lost by leaving an import or a review, while `HotSeatGame`'s and
// `EngineGame`'s "Back to start" (Step 15; Step 5 for `EngineGame`) first
// confirm with the player whenever the game is still in progress (placing,
// or playing), since leaving then loses it. Step 9 also wires
// `ImportScreen`'s file picker to this state: a successful import moves
// `screen` to `review`, carrying the fully replayed game; `ReviewScreen`
// renders it.
type Screen =
  | { readonly kind: "start" }
  | { readonly kind: "play" }
  | { readonly kind: "engine" }
  | { readonly kind: "import" }
  | { readonly kind: "review"; readonly record: ReplayedRecord };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "start" });

  if (screen.kind === "start") {
    return (
      <StartScreen
        onPlayAGame={() => setScreen({ kind: "play" })}
        onReviewAGame={() => setScreen({ kind: "import" })}
        onPlayAgainstComputer={() => setScreen({ kind: "engine" })}
      />
    );
  }

  if (screen.kind === "play") {
    return <HotSeatGame onBack={() => setScreen({ kind: "start" })} />;
  }

  if (screen.kind === "engine") {
    return <EngineGame onBack={() => setScreen({ kind: "start" })} />;
  }

  if (screen.kind === "import") {
    return (
      <ImportScreen
        onBack={() => setScreen({ kind: "start" })}
        onImported={(record: ReplayedRecord) =>
          setScreen({ kind: "review", record })
        }
      />
    );
  }

  // screen.kind === "review"
  return (
    <ReviewScreen
      record={screen.record}
      onBack={() => setScreen({ kind: "start" })}
    />
  );
}
