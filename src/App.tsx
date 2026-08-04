import { useState } from "react";
import { StartScreen } from "./app/StartScreen.tsx";
import { HotSeatGame } from "./board/HotSeatGame.tsx";
import { ImportScreen } from "./review/ImportScreen.tsx";
import { ReviewScreen } from "./review/ReviewScreen.tsx";
import type { RuleConfiguration } from "./rules/primary/v2/configuration.ts";
import type { ReplayedRecord } from "./rules/primary/v2/replay.ts";

// The app shell (story 00000014, Step 8; a fifth screen added by story
// 00000019, Step 5): which of the app's screens is showing, held as a
// discriminated union in `useState` - no router library, no URL routing
// (both out of scope; see story.md). Each screen is its own component with
// its own state, mounted and unmounted here as `screen` changes: mounting
// `HotSeatGame` starts a fresh game and unmounting it discards whatever was
// in progress, and likewise a fresh import screen begins import cleanly
// every time "Review a game" is chosen. The one thing that outlives those
// unmounts is `lastPlayedConfiguration` below, which is why it is held here.
//
// Every non-`start` screen can lead back to `start`: `ImportScreen` and
// `ReviewScreen`'s own "Back" controls (Step 9) never prompt, since nothing
// is lost by leaving an import or a review, while `HotSeatGame`'s "Back to
// start" (Step 15) first confirms with the player whenever the game is still
// in progress (placing, or playing), since leaving then loses it. Step 9
// also wires `ImportScreen`'s file picker to this state: a successful import
// moves `screen` to `review`, carrying the fully replayed game and the
// `RuleConfiguration` its `Ruleset` tag resolved to (story 00000023's Gate D
// defect fix, widened from a bare `Edition` by story 00000027's Step 3) -
// `ReviewScreen` needs it to render the record's own board, not Battle's by
// default; `ReviewScreen` renders it.
//
// There is no `"engine"` screen (story 00000023, Step 9): "Play against the
// computer" is shown on the start screen but disabled and never activatable,
// since the trained engine has to be respecified for the major-2 rules
// before it can come back (`src/engine/` and `src/encoding/eng-nn-1/` are
// left in the tree, non-functional, for that follow-up). `EngineGame.tsx`
// itself is likewise left in the tree, but nothing here mounts it.
type Screen =
  | { readonly kind: "start" }
  | { readonly kind: "play" }
  | { readonly kind: "import" }
  | {
      readonly kind: "review";
      readonly record: ReplayedRecord;
      readonly configuration: RuleConfiguration;
    };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "start" });
  // The configuration (Battle or Skirmish, plus both diagonal-attack rule
  // choices - story 00000027, Step 8) most recently started this app
  // session, or `null` before the first one. `HotSeatGame` records it the
  // moment a game is chosen and pre-selects it on its own choice screen; it
  // lives here, rather than inside `HotSeatGame`, because that component is
  // unmounted on every return to the start screen, which used to discard the
  // memory the story asks to keep for the whole session (story 00000023's
  // peer review, finding #17). Deliberately not persisted across reloads -
  // "this session" is exactly the scope story.md's amended Policy bullet
  // describes.
  const [lastPlayedConfiguration, setLastPlayedConfiguration] =
    useState<RuleConfiguration | null>(null);

  if (screen.kind === "start") {
    return (
      <StartScreen
        onPlayAGame={() => setScreen({ kind: "play" })}
        onReviewAGame={() => setScreen({ kind: "import" })}
      />
    );
  }

  if (screen.kind === "play") {
    return (
      <HotSeatGame
        lastPlayed={lastPlayedConfiguration}
        onGameStarted={setLastPlayedConfiguration}
        onBack={() => setScreen({ kind: "start" })}
      />
    );
  }

  if (screen.kind === "import") {
    return (
      <ImportScreen
        onBack={() => setScreen({ kind: "start" })}
        onImported={(
          record: ReplayedRecord,
          configuration: RuleConfiguration,
        ) => setScreen({ kind: "review", record, configuration })}
      />
    );
  }

  // screen.kind === "review"
  return (
    <ReviewScreen
      record={screen.record}
      configuration={screen.configuration}
      onBack={() => setScreen({ kind: "start" })}
    />
  );
}
