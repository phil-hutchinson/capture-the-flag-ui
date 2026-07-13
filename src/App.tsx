import { useState } from "react";
import { StartScreen } from "./app/StartScreen.tsx";
import { HotSeatGame } from "./board/HotSeatGame.tsx";
import { ImportScreen } from "./review/ImportScreen.tsx";
import { ReviewScreen } from "./review/ReviewScreen.tsx";
import type { ReplayedRecord } from "./rules/primary/v1_1/replay.ts";

// The app shell (story 00000014, Step 8): which of the app's four screens is
// showing, held as a discriminated union in `useState` - no router library,
// no URL routing (both out of scope; see story.md). Each screen is its own
// component with its own state, mounted and unmounted here as `screen`
// changes: mounting `HotSeatGame` starts a fresh game and unmounting it
// discards whatever was in progress, and likewise a fresh import screen
// begins import cleanly every time "Review a game" is chosen.
//
// `import` and `review` are reached only from `start` (via `HotSeatGame`
// once Step 15 adds "back to start", the other three screens can also lead
// back to `start`). Step 9 wires `ImportScreen`'s file picker to this state:
// a successful import moves `screen` to `review`, carrying the fully
// replayed game; `ReviewScreen` (also added in Step 9, a first cut showing
// only the opening position) renders it.
type Screen =
  | { readonly kind: "start" }
  | { readonly kind: "play" }
  | { readonly kind: "import" }
  | { readonly kind: "review"; readonly record: ReplayedRecord };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "start" });

  if (screen.kind === "start") {
    return (
      <StartScreen
        onPlayAGame={() => setScreen({ kind: "play" })}
        onReviewAGame={() => setScreen({ kind: "import" })}
      />
    );
  }

  if (screen.kind === "play") {
    return <HotSeatGame />;
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
