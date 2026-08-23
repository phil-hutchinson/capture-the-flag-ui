import { useEffect, useState } from "react";
import { StartScreen } from "./app/StartScreen.tsx";
import { RulesScreen } from "./app/rules/RulesScreen.tsx";
import { HotSeatGame } from "./board/HotSeatGame.tsx";
import type { GameSelection } from "./games/gameCatalog.ts";
import { ImportScreen } from "./review/ImportScreen.tsx";
import { ReviewScreen } from "./review/ReviewScreen.tsx";
import type { BoardLayout } from "./rules/primary/v2/boardLayout.ts";
import type { RuleConfiguration } from "./rules/primary/v2/configuration.ts";
import type { ReplayedRecord } from "./rules/primary/v2/replay.ts";

// The app shell (story 00000014, Step 8; a fifth screen added by story
// 00000019, Step 5; a sixth, `"rules"`, added by story 00000032, Step 4):
// which of the app's screens is showing, held as a discriminated union in
// `useState` - no router library, no URL routing (both out of scope; see
// story.md). Each screen is its own component with its own state, mounted
// and unmounted here as `screen` changes: mounting `HotSeatGame` starts a
// fresh game and unmounting it discards whatever was in progress, and
// likewise a fresh import screen begins import cleanly every time "Review a
// game" is chosen. The one thing that outlives those unmounts is
// `lastPlayedSelection` below, which is why it is held here.
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
// `RulesScreen` (story 00000032) is the "How to play" primer: reached only
// from the start screen's own "How to play" button, and its "Back to start"
// controls never prompt either, exactly like import/review, since nothing is
// lost by leaving a page of rules. It is not reachable from anywhere a game
// is in progress or being reviewed.
//
// There is no `"engine"` screen (story 00000023, Step 9): "Play against the
// computer" is shown on the start screen but disabled and never activatable,
// since the trained engine has to be respecified for the major-2 rules
// before it can come back (`src/engine/` and `src/encoding/eng-nn-1/` are
// left in the tree, non-functional, for that follow-up). `EngineGame.tsx`
// itself is likewise left in the tree, but nothing here mounts it.
//
// The app-wide keyboard-modality effect below (story 00000002, Step 9 Gate A
// polish, second pass) is the single place that tracks whether the player is
// currently navigating by keyboard, for `App.css`'s `.app__title` focus-ring
// rule to key off; see that effect's own comment for why it lives here rather
// than per-screen.
type Screen =
  | { readonly kind: "start" }
  | { readonly kind: "play" }
  | { readonly kind: "import" }
  | { readonly kind: "rules" }
  | {
      readonly kind: "review";
      readonly record: ReplayedRecord;
      readonly configuration: RuleConfiguration;
      readonly unrecognizedRuleTokens: readonly string[];
      /**
       * The board the record must actually be rendered on (story 00000030's
       * Step 8) - `readRecord.ts`'s `boardLayout` field, not necessarily
       * `configuration.boardLayout` (the two differ only for a record naming
       * a `BOARD_LAYOUT` value this app has no geometry for).
       */
      readonly boardLayout: BoardLayout;
    };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "start" });
  // The app-level game selection (an `AppGameId` - Skirmish, Clash, Battle,
  // or, since story 00000036's Step 14, Demotion - plus both diagonal-attack
  // rule choices; story 00000036's implementation plan, Step 12) most
  // recently started this app session, or `null` before the first one.
  // `HotSeatGame` records it the moment a game is chosen and pre-selects it
  // on its own choice screen; it lives here, rather than inside
  // `HotSeatGame`, because that component is unmounted on every return to
  // the start screen, which used to discard the memory the story asks to
  // keep for the whole session (story 00000023's peer review, finding #17).
  // Deliberately not persisted across reloads - "this session" is exactly
  // the scope story.md's amended Policy bullet describes. Was a bare
  // `RuleConfiguration` (and named `lastPlayedConfiguration`) before Step 12
  // widened it to a `GameSelection` and renamed it to match, so it can name
  // a game independent of which ruleset major it belongs to.
  const [lastPlayedSelection, setLastPlayedSelection] =
    useState<GameSelection | null>(null);

  // Track keyboard-vs-pointer modality on `<html>` (story 00000002, Step 9
  // Gate A polish, second pass). The placement heading (`.app__title`) is
  // focused *programmatically* on mount and on every hand-off, before the
  // player has necessarily touched the keyboard at all; with no prior input
  // for the browser to judge from, `:focus-visible` alone resolves in favour
  // of showing a ring, so a mouse-only player would see one on page load
  // exactly where the browser's own default ring used to appear (the thing
  // the first Gate A polish pass was trying to remove). Setting an explicit
  // `data-input-modality="keyboard"` attribute the first time the player
  // presses Tab or an arrow key - and clearing it again on the next
  // `pointerdown`, so switching back to the mouse stops the ring - lets
  // `App.css` gate the heading's `:focus-visible` ring on genuine prior
  // keyboard use rather than the browser's own guess. This runs once for the
  // whole app, in the shell that never unmounts, rather than being
  // duplicated per screen.
  useEffect(() => {
    const isNavigationKey = (key: string): boolean =>
      key === "Tab" ||
      key === "ArrowUp" ||
      key === "ArrowDown" ||
      key === "ArrowLeft" ||
      key === "ArrowRight";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isNavigationKey(event.key)) {
        document.documentElement.setAttribute(
          "data-input-modality",
          "keyboard",
        );
      }
    };

    const handlePointerDown = () => {
      document.documentElement.removeAttribute("data-input-modality");
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  if (screen.kind === "start") {
    return (
      <StartScreen
        onHowToPlay={() => setScreen({ kind: "rules" })}
        onPlayAGame={() => setScreen({ kind: "play" })}
        onReviewAGame={() => setScreen({ kind: "import" })}
      />
    );
  }

  if (screen.kind === "rules") {
    return <RulesScreen onBack={() => setScreen({ kind: "start" })} />;
  }

  if (screen.kind === "play") {
    return (
      <HotSeatGame
        lastPlayed={lastPlayedSelection}
        onGameStarted={setLastPlayedSelection}
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
          unrecognizedRuleTokens: readonly string[],
          boardLayout: BoardLayout,
        ) =>
          setScreen({
            kind: "review",
            record,
            configuration,
            unrecognizedRuleTokens,
            boardLayout,
          })
        }
      />
    );
  }

  // screen.kind === "review"
  return (
    <ReviewScreen
      record={screen.record}
      configuration={screen.configuration}
      unrecognizedRuleTokens={screen.unrecognizedRuleTokens}
      boardLayout={screen.boardLayout}
      onBack={() => setScreen({ kind: "start" })}
    />
  );
}
