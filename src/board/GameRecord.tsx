// Phase 2 evolving game-record artifact (story 00000004, Step 10 — Gate E).
//
// Mirrors the developer-facing <details> dump pattern established by story
// 00000001: a developer-facing affordance, not a player-facing one, shown as a
// collapsed <details> disclosure (and, gated to dev builds, a console.log)
// rather than anything more elaborate. Where that pattern dumped the one-shot
// initial game state, this surfaces the *evolving* Phase-2 `PlayState` — the same
// `Ruleset` tag and position block, plus the move sequence in the record
// format's extended notation (`S[x]-D[x]`, notation.ts — story 00000023's
// Step 8a) — re-rendered on every move via `play.ts`'s `renderGameRecord`
// (Step 3). This is the foundation recorded-game replay will build on; it
// does not implement replay itself.
//
// Story 00000030's Step 10: the hint line names the game (Battle/Skirmish/
// Clash) right beside the `Ruleset` tag it already prints, via
// `gameNames.ts`'s `gameNameForConfiguration` - the same naming
// `ReviewScreen.tsx`'s "This is a Clash game..." line uses.
//
// Story 00000034 hid the <details> disclosure itself behind
// `featureVisibility.ts`'s `SHOW_DEVELOPER_GAME_RECORD` (off because the
// panel is not meant for a first-time viewer); the dev-build console logging
// below is deliberately left running either way, so the `useMemo`/`useEffect`
// pair still executes before the early return that skips the disclosure. A
// known trade-off of this: `renderGameRecord(play)` now runs on every ply in
// production builds too, with its output going unread there. This is
// accepted rather than fixed, because moving the render into the
// `import.meta.env.DEV` branch would be conditional logic beyond visibility
// and would make re-enabling the panel more than a one-line change.

import { useEffect, useMemo } from "react";
import { renderGameRecord, type PlayState } from "../rules/primary/v2/play.ts";
import { SHOW_DEVELOPER_GAME_RECORD } from "../featureVisibility.ts";
import { gameNameForConfiguration } from "./gameNames.ts";
import { nonStandardRuleSentences } from "./ruleChoices.ts";
import "./GameRecord.css";

export interface GameRecordProps {
  /** The in-progress Phase-2 play state to render. */
  readonly play: PlayState;
}

export function GameRecord({ play }: GameRecordProps) {
  const record = useMemo(() => renderGameRecord(play), [play]);

  useEffect(() => {
    // Developer inspection path. The <details> dump below is hidden by
    // `SHOW_DEVELOPER_GAME_RECORD` (story 00000034), but this dev-only log is
    // deliberately kept regardless.
    // Gated to dev builds so the artifact isn't logged in a shipped app.
    if (import.meta.env.DEV) {
      console.log("Game record:", record);
    }
  }, [record]);

  if (!SHOW_DEVELOPER_GAME_RECORD) {
    return null;
  }

  // Empty on the standard configuration, so this line is byte-identical to
  // before story 00000027 for any game played on the standard values
  // (`ruleChoices.ts`'s `nonStandardRuleSentences`, Step 9).
  const rulesSummary = nonStandardRuleSentences(play.configuration);
  // Story 00000030's Step 10: the game name beside the tag that names it, per
  // peer review #9 of story 00000027 ("the tag and its plain-language meaning
  // belong together"). A live `PlayState` is always built from one of
  // `games.ts`'s catalogued games (`GameChoice.tsx`'s only way to start a
  // game), so `gameNameForConfiguration` can never actually return `null`
  // here - the fallback exists only to keep this a plain `string` for the
  // type checker, matching `HotSeatGame.tsx`'s "You chose ..." announcement.
  const gameName = gameNameForConfiguration(play.configuration) ?? "the game";

  return (
    <details className="game-record">
      <summary>Developer: inspect game record</summary>
      <p className="game-record__hint">
        Ruleset <code>{play.ruleset}</code> ({gameName}).
        {rulesSummary.length > 0 && ` ${rulesSummary.join(" ")}`} Updated after
        every move; also logged to the browser console.
      </p>
      <pre className="game-record__text">{record}</pre>
    </details>
  );
}
