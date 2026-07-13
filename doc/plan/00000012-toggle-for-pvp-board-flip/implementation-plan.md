# Implementation Plan — Story 00000012: Toggle for the two-player board flip

This plan adds a player-facing toggle, **"Flip board between turns,"** that
turns off the Phase 2 board flip. When off, the Phase 2 board is always drawn
from red's perspective (during play, while a draw offer is answered, and at
game end); when on, today's behavior is unchanged. The setting is on by
default, changeable anytime with immediate effect, and persisted in the
browser's local storage. Phase 1 is untouched.

Read `story.md` in this folder before implementing any step; it fixes the
policy (default on, changeable anytime, persisted, label wording, placement)
and the manual-verification gates (A–D). The plan implements that policy — it
does not re-decide it.

## Orienting facts for every step (cold-reader context)

- **The one seam is `viewSide`** in `src/board/playSession.ts`. It is the only
  function that decides which side's perspective the board is drawn from, and
  its only consumer is `PlayBoard` in `src/board/PlayBoard.tsx` (via
  `src/board/boardView.ts`'s `fullBoardRows` / `visibleColumns`). Do not fork
  the session model, add a second board component, or touch anything under
  `src/rules/` (the versioned rules code). This is a view-only setting: it
  never changes game state, whose turn it is, the draw-offer flow, or the game
  record.
- **Side ↔ color mapping.** The internal turn-order `Side` values are
  `"white"` and `"black"` (never shown to players). `"white"` is **red** (the
  first player, Side A); `"black"` is **blue**. The player-facing mapping lives
  in one place, `sideColorName` in `src/board/sideNames.ts`
  (`white`→`"Red"`, `black`→`"Blue"`). "Red's perspective, always" therefore
  means `viewSide` returns `"white"` whenever flipping is off.
- **Player-facing text conventions.** Use the colors red/blue (via
  `sideColorName`) and the word **"move"**, never "ply," in anything a player
  reads. The toggle's label is exactly **"Flip board between turns"** (fixed by
  the owner).
- **Test environment.** Tests run with `npm test` (vitest, `environment:
  "node"` per `vitest.config.ts`). There is no jsdom / testing-library / DOM
  in tests, and no `.test.tsx` React-component tests exist. So pure logic
  (`viewSide`, the persistence helper) is verified with automated unit tests,
  and the React UI (the toggle switch, its wiring, orientation behavior) is
  verified manually by running `npm run dev`.
- **Standard per-step checks.** Every step must also pass `npm run typecheck`,
  `npm run lint`, and `npm test` before it is committed, in addition to the
  step's own verification below.
- **Component conventions.** Each React component has its own co-located
  `.css` file using the existing BEM-like class naming (e.g.
  `play-status__side`). New components follow the same pattern.

---

### Step 1 — Flip-setting persistence helper

Status: committed

Notes: Implemented as planned at `src/board/flipBoardSetting.ts` /
`src/board/flipBoardSetting.test.ts`, using the suggested local-storage key
`"ctf:flip-board-between-turns"` and default `true`. `readFlipBetweenTurns`
and `writeFlipBetweenTurns` guard access with a `typeof globalThis.localStorage
=== "undefined"` check plus a `try…catch`, per the story's best-effort
requirement. Tests install an in-memory `Storage` stub and a throwing stub as
`globalThis.localStorage` to cover the round trip, the default, and both
failure modes. `npm run typecheck`, `npm run lint`, and `npm test` all pass
(353 tests across 19 files, including the 5 new ones); one `npm test` run hit
a transient "Cannot find module .../vitest/dist/index.js" resolution error in
two unrelated pre-existing suites (`placement.test.ts`, `play.test.ts`) with
no code changes present, and re-running immediately passed cleanly — treated
as environment flakiness, not a regression from this step. No deviations from
the plan.

Add a small, framework-free helper module (suggested path
`src/board/flipBoardSetting.ts`, with `src/board/flipBoardSetting.test.ts`)
that reads and writes the "flip board between turns" boolean to the browser's
local storage under a single namespaced key (suggested
`"ctf:flip-board-between-turns"` — the story leaves the exact key name to plan
time; record whatever is chosen in a Notes line). Expose:

- a read function that returns the stored boolean, or a **default of `true`**
  (flipping on) when nothing is stored or the stored value is not recognizable;
- a write function that persists a boolean.

Persistence is **best-effort**: both functions must be wrapped so that if local
storage is unavailable or throws (e.g. blocked by the browser, or the global is
absent), the read returns the default and the write is a silent no-op — no
error surfaces to the app. Access local storage through `globalThis.localStorage`
guarded by a `typeof`/`try…catch` check so the module is safe to import in the
node test environment where the global is absent.

Depends on: nothing (leaf module).

Verification (automated): In `flipBoardSetting.test.ts`, install a small
in-memory stub as `globalThis.localStorage` and confirm a round trip — writing
`false` then reading returns `false`; writing `true` then reading returns
`true`. With no value stored, reading returns `true` (the default). Then
confirm best-effort behavior two ways: with `globalThis.localStorage` removed
(undefined), reading returns `true` and writing does not throw; and with a stub
whose methods throw, reading still returns `true` and writing does not throw.
Run `npm test` and confirm these pass alongside the existing suite.

---

### Step 2 — `viewSide` honors a "flip between turns" flag

Status: committed

Notes: Implemented as planned. `viewSide(session, flipBetweenTurns = true)`
in `src/board/playSession.ts` now short-circuits to `"white"` whenever
`flipBetweenTurns` is `false` (checked before the draw-offer branch, so it
overrides the responder exception), and its doc comment documents both
branches. `PlayBoard` in `src/board/PlayBoard.tsx` gained a required
`flipBetweenTurns: boolean` prop, documented, and passes it straight into
`viewSide(session, flipBetweenTurns)`; its module/function doc comments were
updated to mention the flag. `src/App.tsx`'s sole `PlayBoard` call site
passes a temporary literal `flipBetweenTurns={true}` with a `TODO(story
00000012, Step 3)` comment, to be replaced by real state in Step 3. Added two
new cases to the existing `describe("viewSide …")` block in
`src/board/playSession.test.ts`: flipping off returns `"white"` regardless of
which side is to move, and stays on `"white"` while a draw offer is pending
regardless of who offered; the existing flipping-on cases were left
unchanged since they already cover today's default behavior. `npm run
typecheck`, `npm run lint`, and `npm test` all pass (355 tests across 19
files, including the 2 new cases). No deviations from the plan.

Extend `viewSide` in `src/board/playSession.ts` to take a second parameter — a
boolean for whether the between-turns flip is enabled — defaulting to `true`
so existing call sites and the current behavior are unchanged. Behavior:

- When the flag is **`true`** (flipping on): unchanged from today — return
  `play.sideToMove` normally, and `otherSide(session.drawOffer)` (the
  responder) while a draw offer is pending. This preserves stories 00000005
  and 00000006 exactly.
- When the flag is **`false`** (flipping off): always return `"white"` (red),
  regardless of `sideToMove` and regardless of any pending draw offer. This is
  the "red's perspective, always" rule and it must also override the
  draw-offer responder exception.

Update the module's doc comment on `viewSide` to state the new flag and the
flipping-off rule. Then thread the flag to the single consumer: add a required
boolean prop (suggested name `flipBetweenTurns`) to `PlayBoard` in
`src/board/PlayBoard.tsx` and pass it into the `viewSide(session, …)` call;
update `PlayBoard`'s prop interface and its doc comment accordingly. (App.tsx
will supply this prop in Step 3; until then `PlayBoard`'s only other caller is
this step's own change — the app still compiles because App is updated in the
same repository, but note that App is not yet passing the prop, so **do not
leave App uncompilable**: give the `PlayBoard` prop a temporary literal `true`
at its call site in `App.tsx` in this step, to be replaced by real state in
Step 3.)

Update the existing `viewSide` unit tests in
`src/board/playSession.test.ts` (the `describe("viewSide …")` block near line
736): they exercise flipping-on behavior, which is now the default, so they
remain valid as-is. Add new cases for flipping **off**: with the flag `false`,
`viewSide` returns `"white"` for a white-to-move session, for a black-to-move
session, and while a draw offer is pending regardless of which side offered.

Depends on: nothing in this plan (Step 1 is independent). Placed before Step 3
because the toggle wiring needs this flag-aware seam to exist.

Verification (automated): Run `npm test` and confirm the updated and new
`viewSide` cases pass — flipping on reproduces today's perspective sequence
(including the draw-offer responder exception), and flipping off returns
`"white"` in every case including a pending offer. Also run `npm run typecheck`
to confirm `PlayBoard`'s new required prop is satisfied at its call site.

---

### Step 3 — Accessible toggle switch, wired into the Phase 2 UI

Status: committed

Notes: Implemented as planned. Added `src/board/FlipBoardToggle.tsx` /
`src/board/FlipBoardToggle.css`: a controlled component (`flipBetweenTurns`,
`onChange`) built on a native `<input type="checkbox">` wrapped in a
`<label>` with fixed visible text "Flip board between turns" (chosen form,
per the plan's request to record it: a real `<input type="checkbox">`
restyled with `appearance: none` plus a `::before` knob as a track/switch,
rather than a hidden-checkbox-behind-custom-markup pattern, so the one
focusable element keeps its native accessible name/checked-state semantics
for free). Non-color state is carried by two extra signals, both
`aria-hidden` (the native checked state already announces itself to
assistive tech, so a second announcement would double it): the knob's slide
position and an explicit "On"/"Off" text label beside the switch, both
driven by CSS `:checked`. Focus is shown via `:focus-visible` with
`var(--focus-ring)`, matching the accessible grid's existing focus-ring
convention. In `src/App.tsx`, added `flipBetweenTurns` React state
(`useState(true)`, in-memory only per this step), rendered `FlipBoardToggle`
in the Phase 2 branch right after the `result.kind === "ongoing" ? … : …`
conditional (so it shows during ongoing play, a pending draw offer, and
game end, but never in Phase 1), and replaced the Step 2 temporary literal
`flipBetweenTurns={true}` on `PlayBoard` with the real state, wiring
`onChange={setFlipBetweenTurns}` into the toggle. `npm run typecheck`,
`npm run lint`, `npm test` (355 tests across 19 files, unchanged from Step
2 since this step added no new automated tests — the plan's verification
for this step is manual only), and `npm run build` all pass; `npm run
format:check` passes for the two new files (ran `prettier --write` once to
match the repo's formatting) with three pre-existing unrelated warnings
left untouched (`src/board/playSession.ts` and two `doc/plan/00000006-*`
files, none touched by this step). No deviations from the plan. Manual
verification (Gates A, B, D, and the Phase-1-absence/status-text check) is
the owner's to perform per the step's own verification section below — not
attempted here.

Owner-requested adjustment after manual verification: the owner ran manual
verification and confirmed Gates A, B, and D all passed, then requested two
presentation changes before commit, applied in this same step. (1) DOM/
reading order: the checkbox now comes first, the label text after -
"[ ] Flip board between turns" - and the separate "On"/"Off" text affordance
was removed entirely; the checkbox's own checked/unchecked appearance (the
track/knob switch) is the sole non-color state signal now. (2) Association
robustness: switched from an implicit wrapping `<label>` to an explicit
`htmlFor`/`id` association (`useId()`-generated id) between the `<input>`
and its `<label>`, confirming the accessible name conveyed to assistive
technology stays exactly "Flip board between turns." Both changes are
confined to `FlipBoardToggle.tsx`/`FlipBoardToggle.css`; `App.tsx`'s wiring
from the original implementation is unchanged. Re-ran `npm run typecheck`,
`npm run lint`, `npm test` (still 355 passing), `npm run build`, and
`npx prettier --check` on the two touched files - all pass.

Add the visible, working toggle and connect it end to end (using a
non-persisted, default-on in-memory state for now; persistence is Step 4).

1. **Toggle component.** Create a new component (suggested
   `src/board/FlipBoardToggle.tsx` with `src/board/FlipBoardToggle.css`),
   controlled via props: current on/off value and an `onChange` callback. Its
   visible label is exactly **"Flip board between turns."** Build it on a
   native `<input type="checkbox">` associated with its label so it is
   keyboard-operable and its label and checked state are conveyed to assistive
   technology for free (the story leaves "switch vs. labeled checkbox" to plan
   time; a native checkbox, optionally styled as a switch, satisfies the
   accessibility requirement most simply — record the chosen form in a Notes
   line). Its on/off state must be **perceivable without relying on color
   alone** — e.g. a moving knob position and/or an on/off text affordance, not
   just a color change. Follow the existing per-component `.css` + BEM-like
   class conventions.

2. **App state.** In `src/App.tsx`, add React state for the flip setting,
   initialized to `true` (default on) for this step. Render `FlipBoardToggle`
   in the **Phase 2 branch only** (the `playSession !== null` branch), placed
   so it is visible throughout Phase 2 — during ongoing play, while a draw
   offer is pending, and in the end-of-game presentation. Concretely, render it
   outside the `result.kind === "ongoing" ? … : …` conditional (which swaps
   `PlayStatus`/`DrawOffer` for `GameResult`) so it shows in every Phase 2
   state. It must **not** be rendered in the Phase 1 placement branch.

3. **Wire the flag.** Pass the state value into `PlayBoard`'s
   `flipBetweenTurns` prop (replacing the temporary literal from Step 2), and
   pass a change handler that updates the state into the toggle. Changing the
   toggle re-renders `PlayBoard`, which re-derives `viewSide` — so the board
   redraws in the new orientation immediately, with no change to game state.

Confirm that orientation-dependent presentation stays correct in both modes
(story in-scope item 4): `PlayStatus` names `sideToMove` (not the viewing
side) and square labels/announcements use absolute coordinates, so the toggle
must not alter any status text, screen-reader announcement, or square
announcement — only which way the board is drawn.

Depends on: Step 1 is **not** required here (persistence comes in Step 4);
Step 2 (the `viewSide` flag and `PlayBoard` prop). Comes before Step 4 so the
visible behavior can be verified before durability is layered on.

Verification (manual): Run `npm run dev` and open the app; play through to
Phase 2. Then confirm, in one session:

- **Gate A (toggle off, mid-game):** From a Phase 2 game in progress on blue's
  turn (board drawn from blue's perspective), switch the toggle off — the board
  immediately redraws from red's perspective, and subsequent hand-offs no
  longer flip it. Both sides can select, move, and attack normally in the fixed
  orientation. Switching the toggle back on restores the flip and returns to the
  orientation the current player would have had.
- **Gate B (draw offers, both modes):** With flipping off, have red offer a
  draw — the board stays on red's perspective while blue answers; declining and
  accepting both behave as today (only the orientation differs). Switch the
  toggle back on and confirm the responder-perspective flip returns while an
  offer is pending.
- **Gate D (accessibility):** The switch can be found and operated by keyboard
  alone (Tab to it, Space/Enter toggles it); a screen reader announces its
  label ("Flip board between turns") and current on/off state when focused and
  when toggled; its state is visually clear without relying on color alone.
- Confirm the toggle is **not** shown during Phase 1 placement, and that status
  text ("Red to move" / draw-offer prompt) and square announcements read
  correctly whichever way the board is drawn.

(State is not yet persisted in this step; a page reload resetting the toggle to
on is expected here and is fixed in Step 4.)

---

### Step 4 — Persist the setting across reloads and games

Status: pending

Wire the Step 1 persistence helper into `src/App.tsx` so the flip setting
survives reloads and carries across games. Initialize the flip state from the
helper's read function (lazy `useState` initializer) instead of the literal
`true` from Step 3, and have the change handler write the new value through the
helper's write function in addition to updating React state. Because the setting
is a device setting, not part of any game, the "New game" reset
(`handleNewGame`) must **not** clear or change it. Persistence remains
best-effort (Step 1): if local storage is unavailable the app still works with
the default and shows no error.

Depends on: Step 1 (the helper) and Step 3 (the App state and toggle wiring it
plugs into).

Verification (manual): Run `npm run dev` and confirm **Gate C**: on a first
visit (clear the key from local storage, e.g. via the browser dev tools, to
simulate) the switch is **on** by default; turn it off, reload the page, and
confirm it is still off; start a new game and confirm it is still off; turn it
back on, reload, and confirm it is still on. Also confirm the app loads and
plays normally with local storage disabled/blocked (the default applies and no
error appears).

---

### Step 5 — README accuracy check

Status: pending

Review `README.md` against this story's changes and update it if warranted, or
confirm no update is needed. The README's "What you can do" section describes
player-visible capabilities; a device-level view toggle for Phase 2 board
orientation may merit a brief mention there, in player language (colors, the
word "move"). Prefer running the `/update-readme` command, which reviews the
current branch diff and updates `README.md` if warranted.

Depends on: Steps 1–4 (the feature is complete and its player-visible behavior
is settled).

Verification (manual): Confirm `README.md` either accurately reflects the new
toggle in player-facing language or is confirmed to need no change; run
`npm run format:check` (or `npm run format`) so any Markdown edit stays
consistent with the repo's formatting.
