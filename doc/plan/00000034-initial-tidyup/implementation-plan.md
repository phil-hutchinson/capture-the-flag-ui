# Implementation Plan — Story 00000034: Initial tidyup before showing the app to people

This plan hides two of the start screen's four choices and the developer
game-record panel, shortens four pieces of copy, flips one default off, and
brings `README.md` in line with what a viewer can now see. **Nothing is
deleted and no behaviour changes** — the hidden features stay in the tree,
fully wired, behind named visibility constants that a later story flips back
to `true` in one file.

Read `story.md` in this folder **in full** before starting any step. Its
**Policy (fixed by the owner)**, **In scope**, **Design decisions &
constraints**, **Out of scope** and **Manual-verification gates** are settled
and are not re-litigated here. This plan resolves story.md's "Open items to
resolve at plan time"; the resolutions are in "Decisions resolved at plan
time" below, and every step is written assuming them.

Every step is written for an implementer who has read `story.md`, this plan,
and their own step, and nothing else.

---

## Grounding facts (read once — applies to every step)

### This is a presentation pass, not a change to the game

No step may change how a game plays, how a record is written or read, or what
any rule does. **`src/rules/`, `src/engine/` and `src/encoding/` are not
touched by any step of this story.** Neither is `src/App.tsx`: the screen
union keeps all five members (`start`, `rules`, `play`, `import`, `review`)
and `onReviewAGame` stays wired to `{ kind: "import" }` at around line 136.
The import and review screens simply become unreachable while the start
screen's button is hidden — that is the intended end state, not an oversight.

No new dependencies, no build-time configuration, no environment variables.
The mechanism is a compile-time constant in source (story.md).

### There is no DOM/component test environment

Vitest runs in the `node` environment only — no jsdom, no component-testing
library (see `CONTRIBUTING.md`; adding one is a separate proposed story under
`doc/plan/proposed-stories/`). Consequences that shape every step:

- **Only plain `.ts` modules can be unit-tested.** Every `.tsx` component in
  this repository is verified by a manual gate.
- That is why Step 1 pulls the start screen's four choices out into a
  React-free data module: the order, the copy and the hide/show filter then
  become assertable, and the `.tsx` layer stays thin rendering.

### Where the relevant code is today

- `src/app/StartScreen.tsx` / `StartScreen.css` — the start screen. A
  `<main className="app">` with an `<h1 className="app__title" tabIndex={-1}>`
  focused on mount, a tagline, and a `.start-screen__choices` flex-wrap row of
  four `<button className="start-screen__choice">` elements, each holding a
  `.start-screen__choice-title` span and a `.start-screen__choice-detail`
  span. In order: **How to play** (title and detail read from
  `HOW_TO_PLAY_BUTTON` in `src/app/rules/rulesCopy.ts`), **Play a game** /
  "Two players, one device", **Play against the computer** / "Choose a side,
  place your army, then play", **Review a game** / "Watch a recorded game".
  The computer button is rendered `aria-disabled={true}` with
  `aria-describedby="start-screen__computer-note"` and a **no-op `onClick`**
  — deliberately **not** the native `disabled` attribute (story 00000002,
  decision 7: a natively disabled button leaves the tab order, so a keyboard
  or screen-reader user would never reach its explanatory note). It carries a
  third span, `.start-screen__choice-note` with
  `id="start-screen__computer-note"`, reading "Not available right now - the
  rules changed and the computer player needs to catch up." **All of that
  markup must survive this story unchanged, in the hidden branch.**
- `src/App.tsx` — the app shell; a `Screen` discriminated union in `useState`,
  no router. Passes `onHowToPlay`, `onPlayAGame` and `onReviewAGame` to
  `StartScreen`. **Not modified by this story.**
- `src/app/rules/rulesCopy.ts` — the "How to play" page's copy as data.
  `RULES_HEADER.lines[1]` is the tagline this story edits.
  `src/app/rules/rulesCopy.test.ts` pins both header lines verbatim in its
  `EXPECTED_HEADER_LINES` constant (around line 18–21).
- `src/board/GameChoice.tsx` — the new-game screen. `GAME_DETAIL` (a
  `Readonly<Record<GameId, string>>` around line 102) holds the three game
  descriptions; the button at the foot renders `Play {gameName(choice)}` with
  `className="game-choice__start"` (around line 305). `gameName` is also used
  by the game buttons above, so its import stays.
- `src/board/ruleChoices.ts` — `RULE_CHOICE_COPY`. The
  `DIAGONAL_ATTACKABLE` / `all` description (around line 110) is the only
  place in `src/` containing the word "strike"; the only other occurrence in
  the repository is a **comment** in `src/board/ruleChoices.test.ts` around
  line 250 and one sentence in `README.md` (line 39). No test asserts the
  description string verbatim.
- `src/board/flipBoardSetting.ts` — `STORAGE_KEY`
  (`"ctf:flip-board-between-turns"`), a module-private
  `DEFAULT_FLIP_BETWEEN_TURNS` (currently `true`), `readFlipBetweenTurns()`
  and `writeFlipBetweenTurns()`. `flipBoardSetting.test.ts` has five tests,
  three of which assert the default is `true`.
- `src/board/GameRecord.tsx` / `GameRecord.css` — the collapsed
  `<details className="game-record">` "Developer: inspect game record"
  disclosure, plus a `useMemo` over `renderGameRecord` and a `useEffect` that
  `console.log`s the record **only** under `import.meta.env.DEV`. It is
  rendered from **two** places: `src/board/HotSeatGame.tsx` (around line 639)
  and `src/board/EngineGame.tsx` (around line 567 — currently unreachable,
  since `App.tsx` has no engine screen).
- `src/appInfo.ts` — the precedent for a tiny top-level, React-free constants
  module (`APP_NAME`, `TAGLINE`).
- `README.md` — player-facing, plain register, no jargon. Its intro paragraph,
  its "What you can do" bullets and its Status blockquote all describe things
  this story hides.

### The check every step runs

From the repository root:

```
npm run typecheck && npm run lint && npm test && npm run format:check && npm run build
```

All five must be clean before a step is considered done. A cheap self-check at
the end of every step: `git diff --stat` — if a file outside the step's stated
footprint appears (especially anything under `src/rules/`, `src/engine/` or
`src/encoding/`), something has gone wrong.

Steps with a **manual** verification additionally need `npm run dev` (the app
serves on `http://localhost:5173`). **This container has no file watching —
Vite never picks up a change on its own, so the dev server must be stopped and
restarted before observing anything.**

---

## Decisions resolved at plan time

These resolve story.md's "Open items to resolve at plan time", plus the two
implementation choices the story leaves open inside its Design decisions. Every
step assumes them.

### Decision 1 — The visibility constants live in `src/featureVisibility.ts`

One new module, `src/featureVisibility.ts`, at the top of `src/` beside
`appInfo.ts` — **not** inside `src/app/` or `src/board/`, because it is read
from both (`src/app/startScreenChoices.ts` and `src/board/GameRecord.tsx`), and
because a top-level file name is what makes it discoverable to someone who
wasn't here when the features were hidden (story.md: "discoverable from the
file names alone"). `appInfo.ts` is the existing precedent for a tiny
top-level, React-free constants module.

It exports exactly three constants, one per hidden thing, named for what they
hide:

- `SHOW_PLAY_AGAINST_THE_COMPUTER`
- `SHOW_REVIEW_A_GAME`
- `SHOW_DEVELOPER_GAME_RECORD`

All three are `false` in the committed state. Each carries a **one-line
comment** saying why it is off and what flipping it to `true` restores
(story.md's requirement), and the module header says that this file is the
only place any of these three features is gated, that flipping one constant to
`true` is the entire change needed to bring a feature back, and that nothing
here may grow logic — it is constants only.

Two shape rules the implementer must follow:

- **Annotate each constant as `boolean`**, not left to infer the literal type
  `false`. An inferred `false` makes every consuming expression statically
  dead, which invites both a TypeScript narrowing surprise and a lint
  complaint, and would make flipping the constant a type change rather than a
  value change.
- **No test may assert the current value of any of these three constants.** A
  test pinning `SHOW_REVIEW_A_GAME === false` would mean that re-enabling the
  feature also breaks the suite — the opposite of "a single obvious change in
  a single obvious place". Everything else about the hiding _is_ tested (see
  Decision 2).

The board-flip default (story.md item 5) gets **no constant**: it is a changed
default for a setting the player still controls, not a hidden feature. Do not
add a fourth constant for it.

### Decision 2 — The start screen hides at the list, not at the button

`StartScreen.tsx` renders a **filtered list of choice descriptors**, not four
hand-written blocks with two of them wrapped in conditions. story.md offers
both; the list wins because of the repository's test environment: a React-free
descriptor module is the only part of this change that can be unit-tested at
all, and it lets the committed state assert the things that actually matter —
that all four choices are still present in their original order, that the two
survivors are never hidden, and that the filter is order-preserving, which is
half of Gate F checked automatically on every run.

- **`src/app/startScreenChoices.ts`** (new, plain TypeScript, no React, no
  CSS, no handlers) declares a choice descriptor type and the catalog of all
  four choices in their current order: `howToPlay`, `playAGame`,
  `playAgainstTheComputer`, `reviewAGame`. Each descriptor carries a stable
  id, its title, its detail line, an optional **unavailability note** (only
  `playAgainstTheComputer` has one), and a `visible` boolean — literal `true`
  for the two survivors, and the matching constant from `featureVisibility.ts`
  for the two hidden ones. `howToPlay`'s title and detail are read from
  `HOW_TO_PLAY_BUTTON` (`src/app/rules/rulesCopy.ts`), exactly as
  `StartScreen.tsx` reads them today — not re-typed as literals. The module
  also exports a pure, order-preserving filter that takes a catalog and
  returns its visible entries.
- **`StartScreen.tsx`** maps over the filtered catalog and renders one button
  per descriptor, choosing between two markup shapes: the ordinary button, and
  — for a descriptor that carries an unavailability note — today's
  `aria-disabled` + `aria-describedby` + no-op-`onClick` button with its third
  note span. The id/handler mapping covers **all four** ids regardless of
  visibility, so `onReviewAGame` stays a used, required prop and re-enabling
  needs no edit here.

### Decision 3 — The developer panel is hidden inside `GameRecord.tsx`

The constant is consulted **in `GameRecord.tsx` itself**, which returns `null`
in place of its `<details>` block, rather than at the two call sites that
render `<GameRecord …>`. Reasons:

- story.md keeps the dev-build `console.log` explicitly: "not part of what
  this story hides". Not mounting the component at all would silently stop
  that logging. Gating inside the component — after its hooks, which keep
  running exactly as they do today — preserves it.
- `GameRecord` is rendered from two places (`HotSeatGame.tsx` and
  `EngineGame.tsx`). One gate inside the component covers both, so hiding
  cannot drift between them, and neither caller is touched.

`GameRecord.css`, the `<details>` markup, the hint line and
`renderGameRecord` all stay exactly as they are. React's rules of hooks mean
`useMemo`/`useEffect` must still be called before the early return.

### Decision 4 — How much of README moves

story.md's open item is settled as follows, and Step 7 carries the full list:

- The **intro paragraph** stops saying the start screen lets you "review a
  recorded one" and drops the "Playing against the computer is temporarily
  unavailable…" sentence. It describes the two choices a reader will actually
  see.
- The **"Review a recorded game"** and **"Play against the computer"** bullets
  come out of "What you can do" — that section describes what a reader can do
  in the app, and neither is reachable. This is a documentation copy edit, not
  a feature deletion; the Policy's no-removal rule governs code, and the
  features themselves stay in the tree.
- The **Status blockquote** keeps one short, plain sentence covering what is
  not available yet (saving a game, the computer player, reviewing records) —
  the README already carries exactly this kind of note, and story.md's
  constraint is only that the hiding is not narrated **more** than that.
- Two factual corrections elsewhere in the same bullets: "strike" → "attack"
  (line 39), and the flip-default sentence inverted — the board now stays on
  red's side unless the player turns flipping on.
- The "The rules" section's clause about earlier recordings no longer being
  reviewable here is a judgement call at the step: trim it if it dangles once
  reviewing is unmentioned, otherwise leave it. Nothing in the README may
  point at a button that is not on screen.

### Decision 5 — Copy edits are made in place; the flip default keeps its key

Per story.md's Policy, shortened copy is **edited in place** — no flag, no
preserved alternative, no commented-out old wording. The old text is in git
history.

`DEFAULT_FLIP_BETWEEN_TURNS` changes value only. **`STORAGE_KEY` must not be
renamed** — a device with a stored `true` keeps flipping, which is correct
(a stored preference outranks a default) and is exactly why Gate D is checked
in a private window.

---

## Step 1 — Visibility constants and the start screen's choices as data

Status: committed

Notes: Created `src/featureVisibility.ts` (three `boolean`-annotated
constants, all `false`) and `src/app/startScreenChoices.ts` (the
`StartScreenChoice` descriptor type, the four-entry `START_SCREEN_CHOICES`
catalog with `howToPlay`'s copy read from `HOW_TO_PLAY_BUTTON`, and the pure
`visibleStartScreenChoices` filter), plus
`src/app/startScreenChoices.test.ts`. No existing file was modified. All
five repository checks (typecheck, lint, test, format:check, build) pass;
`format:check`'s lone remaining warning is a pre-existing issue in
`story.md`, untouched by this step. No deviations from the plan.

Create two new plain-TypeScript modules (no React, no JSX, no CSS) and one
test file. **Nothing renders differently after this step** — no existing file
is modified, and nothing imports either new module yet.

1. **`src/featureVisibility.ts`** — the three constants of Decision 1
   (`SHOW_PLAY_AGAINST_THE_COMPUTER`, `SHOW_REVIEW_A_GAME`,
   `SHOW_DEVELOPER_GAME_RECORD`), all `false`, each annotated `boolean` and
   each carrying a one-line comment saying why it is off and what flipping it
   to `true` restores. The module header explains that this is the one place
   these features are gated (story 00000034), that flipping one constant is
   the whole change, and that the code behind each is untouched and still
   wired.
2. **`src/app/startScreenChoices.ts`** — the descriptor type, the catalog of
   all four choices in their current order, and the pure order-preserving
   visibility filter, as Decision 2 describes. Copy the four titles, the four
   detail lines and the computer note **verbatim** from
   `src/app/StartScreen.tsx` as it stands (the Grounding facts above list
   them); take `howToPlay`'s title and detail from `HOW_TO_PLAY_BUTTON` rather
   than re-typing them. Keep the descriptor shape minimal — no callbacks, no
   class names, no React types; the renderer supplies those in Step 2.

Depends on: nothing.

Verification (**automated**): add `src/app/startScreenChoices.test.ts`
asserting all of the following, then run the five repository checks.

- The catalog has exactly **four** entries and their ids are, in order:
  `howToPlay`, `playAGame`, `playAgainstTheComputer`, `reviewAGame`.
- Each entry's title and detail are exactly today's strings (the four pairs
  listed in Grounding facts), and `howToPlay`'s two come from
  `HOW_TO_PLAY_BUTTON` — assert against that imported constant, not a
  duplicated literal.
- Exactly one entry carries an unavailability note, it is
  `playAgainstTheComputer`, and its text is today's note verbatim.
- `howToPlay` and `playAGame` are visible (they are unconditionally so, and
  this assertion stays true forever).
- The filter drops entries whose `visible` is `false` and **preserves the
  order** of the rest — exercised on synthetic catalogs built inside the test
  (all four visible → all four in order; the two hidden ones marked invisible
  → exactly `howToPlay` then `playAGame`), never by reading the real
  constants.
- **No assertion anywhere on the current value of a `featureVisibility.ts`
  constant** (Decision 1) — flipping one must never break the suite.

---

## Step 2 — The start screen shows two choices

Status: pending

Rewrite `src/app/StartScreen.tsx`'s choice row to map over Step 1's filtered
catalog instead of four hand-written buttons, so that "Play against the
computer" and "Review a game" disappear from view while their markup, their
copy and their wiring stay in the tree. `src/app/StartScreen.css` is not
modified.

What must be preserved exactly:

- The `<main className="app">` shell, the `<h1 className="app__title"
tabIndex={-1}>` with its mount-focus effect, the tagline paragraph, and the
  `.start-screen__choices` wrapper.
- Per choice: a `<button type="button" className="start-screen__choice">`
  holding a `.start-screen__choice-title` span and a
  `.start-screen__choice-detail` span.
- For the descriptor carrying an unavailability note (the computer choice):
  `aria-disabled={true}`, `aria-describedby="start-screen__computer-note"`, a
  **no-op `onClick`** and the third span
  `<span id="start-screen__computer-note" className="start-screen__choice-note">`.
  This is story 00000002's decision 7 and must come back intact when the
  constant is flipped — do **not** substitute the native `disabled` attribute
  and do not drop the note.
- `StartScreenProps` keeps all three callbacks, including `onReviewAGame`, and
  the id→handler mapping covers all four ids, so nothing here needs editing to
  re-enable a choice and no prop becomes unused.
- `src/App.tsx` is **not** touched.

Update the module's header comment to describe the new structure: the choices
come from `startScreenChoices.ts`, two are hidden by `featureVisibility.ts`
(story 00000034), the import/review screens stay wired and merely unreachable,
and the `aria-disabled` treatment is preserved for when the computer choice
returns.

Depends on: Step 1 (the descriptor catalog and the filter).

Verification (**manual — story.md Gate A**): run the five repository checks,
then stop and restart `npm run dev` (this container has no file watching) and
open `http://localhost:5173`.

- The start screen offers **exactly two** choices, "How to play" then "Play a
  game", in that order.
- Both work: "How to play" opens the rules page and its "Back to start"
  returns; "Play a game" reaches the new-game screen and its "Back to start"
  returns.
- Nothing on the page hints at a missing option — no leftover note text, no
  empty button, no stray gap where a choice used to be.
- Tabbing from the top moves through **exactly those two buttons** and nothing
  else in the choices row; the focus ring behaves as before.
- If the row now looks sparse, note it at the gate — story.md puts a visual
  redesign out of scope and makes any fix a separate story.

---

## Step 3 — The copy edits

Status: pending

Make story.md's four copy edits, in place (Decision 5). No feature is hidden
in this step and no visibility constant is involved. No copy other than the
edits below may change (story.md's Out of scope: game screens, placement,
result, warnings and the six "How to play" sections are untouched).

1. **`src/app/rules/rulesCopy.ts`** — `RULES_HEADER.lines[1]` becomes
   `Place your pieces in phase one — battle your opponent in phase two`
   (em dash, **no trailing period**). Update
   `src/app/rules/rulesCopy.test.ts`'s `EXPECTED_HEADER_LINES` (around line
   18–21) to the same string, character for character — that test exists
   precisely to catch an unintended edit, so it moves with the intended one.
2. **`src/board/GameChoice.tsx`** — `GAME_DETAIL`'s three descriptions become,
   verbatim from story.md's table:
   - `skirmish`: `Play on an 8x8 board with a 16-piece army.`
   - `clash`: `Play on a 10x10 board with a 20-piece army. Irregular lakes.`
   - `battle`: `Play on a 12x12 board with a 25-piece army.`

   Rewrite `GAME_DETAIL`'s doc comment: it currently explains Skirmish's
   tower/lane clause (story 00000025) and Clash's fuller lake explanation
   (story 00000030), both of which this story knowingly drops. The new comment
   should record that story 00000034 shortened these for a first-time viewer,
   and that the tower/lane rule is now explained only where it is enforced, at
   placement time (`towerPlacementMessages.ts`).

3. **`src/board/GameChoice.tsx`** — the `.game-choice__start` button at the
   foot reads **`Play`**, not `Play {gameName(choice)}`. Keep the `gameName`
   import: the game buttons above still use it. Update the component's header
   comment where it describes a "Play &lt;Game&gt;" button.
4. **`src/board/ruleChoices.ts`** — in the `DIAGONAL_ATTACKABLE` / `all`
   description, `A piece can strike any enemy…` becomes
   `A piece can attack any enemy…`; the rest of the sentence is unchanged.
   `src/board/ruleChoices.test.ts` has a **comment** around line 250 quoting
   "A piece can always strike…" as an example; correct that quotation (the
   sentence it means actually reads "A piece can always attack an eligible
   enemy diagonally") so no stale "strike" is left in the source. No test
   asserts the description text, so no assertion needs changing — confirm that
   with a repository-wide search for "strike" before finishing.

`README.md`'s own "strike" sentence is handled in Step 7, with the rest of the
README work.

Depends on: nothing in this story (independent of Steps 1 and 2); placed here
so the visible-copy gates can be run in one pass after the start screen
settles.

Verification (**manual — story.md Gates B and C**): run the five repository
checks (the updated `rulesCopy.test.ts` is part of `npm test`), then stop and
restart `npm run dev` and open `http://localhost:5173`.

- **Gate C — How to play.** The header's second line reads
  "Place your pieces in phase one — battle your opponent in phase two", with a
  dash and no trailing period, and the first line is unchanged. The six
  sections and the ten figures below are unchanged.
- **Gate B — New-game screen.** Selecting Skirmish, then Clash, then Battle
  shows the three new descriptions **exactly** as written above and nothing
  more. The button at the foot reads plain **"Play"**, and it starts the game
  currently selected — check this **after switching the selection at least
  once** (e.g. select Battle, press Play, confirm the board that appears is
  Battle's). Choosing "Any piece, flag/towers included" for the diagonal-attack
  setting shows a description that says "attack", not "strike".

---

## Step 4 — The board no longer flips between turns by default

Status: pending

In `src/board/flipBoardSetting.ts`, change `DEFAULT_FLIP_BETWEEN_TURNS` to
`false` and update its comment to say what the default now is and why (most
people looking at this app drive both sides themselves, and a board that spins
between turns is disorienting then — story.md item 5).

Hard constraints:

- **Do not rename `STORAGE_KEY`** (`"ctf:flip-board-between-turns"`). A device
  with a stored value keeps its stored preference; that is deliberate
  (story.md) and is why the manual check in Step 5 uses a private window.
- Do not change `readFlipBetweenTurns` / `writeFlipBetweenTurns` behaviour,
  the toggle component (`FlipBoardToggle.tsx`), or anything in
  `playSession.ts`. Only the starting value changes.
- No visibility constant is involved (Decision 1).

Depends on: nothing.

Verification (**automated**): update `src/board/flipBoardSetting.test.ts` and
run the five repository checks. The three tests that currently assert the
default is `true` — nothing stored, `localStorage` undefined, `localStorage`
throwing — must assert **`false`**, with their titles updated to match. Add or
rename a test making the "a stored preference outranks the new default"
property explicit: writing `true`, then reading, returns `true`. Keep the
existing round-trip tests for both values.

---

## Step 5 — Hide the developer game-record panel

Status: pending

In `src/board/GameRecord.tsx`, gate the rendered
`<details className="game-record">` block on `SHOW_DEVELOPER_GAME_RECORD` from
`src/featureVisibility.ts`: when it is `false`, the component renders nothing.

Constraints (Decision 3):

- The `useMemo` over `renderGameRecord` and the `useEffect` that `console.log`s
  under `import.meta.env.DEV` must still run — hooks first, then the early
  return. story.md keeps the dev-build logging deliberately.
- `GameRecord.css`, the `<details>` markup, the summary text, the hint line and
  the `<pre>` all stay exactly as they are, so flipping the constant restores
  the panel unchanged.
- **Do not modify `HotSeatGame.tsx` or `EngineGame.tsx`.** Both keep rendering
  `<GameRecord …>`; the gate lives in one place and covers both.
- Update the module header comment to record that story 00000034 hid the
  disclosure behind `featureVisibility.ts`'s constant while leaving the dev
  console logging in place.

Depends on: Step 1 (the constant) and Step 4 (so one manual pass can check both
halves of Gate D).

Verification (**manual — story.md Gate D**): run the five repository checks,
then stop and restart `npm run dev` and open `http://localhost:5173` **in a
private window** (so no `ctf:flip-board-between-turns` value is stored;
alternatively clear that key first).

- Start a Skirmish game, place both armies and reach phase 2. The
  "Flip board between turns" checkbox is **unchecked**, and the board stays on
  red's side across a hand-off.
- Tick it: the board flips between turns exactly as it always did.
- The choice still persists: with it ticked, reload the page (this returns to
  the start screen and discards the game, which is expected), start a new game
  and reach phase 2 — the checkbox is still ticked.
- **No "Developer: inspect game record" disclosure appears anywhere on the
  game screen** — neither during play nor after a result.
- The dev-build console logging still works: with the browser console open,
  each move logs "Game record: …". (This is the constraint that the logging
  was not hidden with the panel.)

---

## Step 6 — Full play-through and reversibility check

Status: pending

**This step implements nothing and commits no source change.** It exists
because story.md's Gates E and F can only be run once every part of the hiding
is in place, and because Gate F's work — flipping each visibility constant to
`true`, checking the feature comes back intact, then reverting — is
deliberately temporary and must not reach the committed state.

The person at the gate edits `src/featureVisibility.ts` only, one constant at
a time, restarting the dev server after each edit (no file watching in this
container), and reverts the file at the end (`git checkout
src/featureVisibility.ts` is the safest revert).

Depends on: Steps 2, 3, 4 and 5 (all the hiding and all the copy edits must be
in place).

Verification (**manual — story.md Gates E and F**):

**Gate E — nothing broke.** With the committed state (all three constants
`false`): play a full Skirmish game from placement to a real result (flag
capture, no-legal-move, or an agreed draw), then set up a Clash game and a
Battle game and play a few moves in each. Placement, hand-off, attacks,
warnings, the result screen and "New game" all behave as before.

**Gate F — reversibility.** One constant at a time, flip to `true`, restart
the dev server, check, then flip back:

- `SHOW_REVIEW_A_GAME` — "Review a game" reappears on the start screen, in its
  original position (fourth, after "Play against the computer" when that one
  is also on) with its original title and detail, reaches the import screen,
  and a record file from the companion project still imports and replays. If
  no record file is to hand, note that in the step's Notes and check at least
  that the import screen loads and reports a rejected file as it did before.
- `SHOW_PLAY_AGAINST_THE_COMPUTER` — the choice reappears in its original
  third position, dimmed, reachable by Tab, **not** activatable, with its
  explanatory note read out by its `aria-describedby` association.
- `SHOW_DEVELOPER_GAME_RECORD` — the "Developer: inspect game record"
  disclosure returns at the foot of the game screen and still shows the
  evolving record.

Then revert all three, restart the dev server, confirm the start screen is
back to two choices and the game screen has no developer panel, and confirm
`git status` shows no modified source file (only this plan's Status/Notes
edits). Re-run the five repository checks.

---

## Step 7 — README

Status: pending

Bring `README.md` in line with what a viewer can now see. Run the
`/update-readme` command first (it reviews the branch diff and proposes the
update), then check its result against the specific edits below, which are
this story's requirements (Decision 4) — the README must not describe buttons
that are not on screen, and must not narrate the hiding as a temporary state
any more than it already does.

- **Intro paragraph** (around lines 15–19): the start screen offers reading
  the quick guide and playing a game; drop "review a recorded one" and drop
  the "Playing against the computer is temporarily unavailable…" sentence.
- **"What you can do"**: remove the "Review a recorded game" bullet and the
  "Play against the computer" bullet.
- **"Move, attack, and capture on the battlefield" bullet**: "A piece can also
  **strike** an enemy standing diagonally next to it" → "**attack**" (story.md
  item 4); and invert the flip sentence — the board now stays on red's side by
  default, and the "Flip board between turns" switch turns flipping on, which
  is what two players passing one device want.
- **Status blockquote**: keep one short plain sentence for what is not
  available yet — saving a game you played here, playing against the computer,
  and reviewing recorded games — without a bullet or a paragraph for each.
- **"The rules" section**: its clause about earlier recordings no longer being
  reviewable here may now dangle; trim or reword it if so, otherwise leave it.
- Keep the existing plain, player-facing register throughout. No jargon, no
  "ply", no mention of visibility constants or of the code (that belongs in
  `CONTRIBUTING.md` and in the source comments).

Depends on: Steps 2–6 (the README describes the finished state).

Verification (**manual**): run `npm run format:check` (Prettier formats
Markdown too) and read `README.md` top to bottom beside the running app,
confirming that every capability it describes is reachable from the start
screen, that no sentence points at a hidden button, that the diagonal-attack
sentence says "attack", and that the flip description matches what a fresh
browser actually does. Then run the five repository checks one last time.
