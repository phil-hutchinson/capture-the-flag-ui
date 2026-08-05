# Implementation Plan — Story 00000002: Accessible placement board

This plan makes the Phase 1 placement experience fully keyboard-operable and
screen-reader-perceivable, **by porting the placement board onto the accessible
grid Phase 2 already uses** — not by designing a new keyboard model. It also
clears the three accessibility findings story 00000023 deferred here, and adopts
`eslint-plugin-jsx-a11y` so this class of defect is caught in lint from now on.

Read `story.md` in this folder in full before starting any step. Its
**In scope / Out of scope**, **Design decisions & constraints** and
**Verification** sections are settled by the owner and are not re-litigated
here. This plan resolves the story's **"Open items to resolve at plan time"** —
the resolutions are in "Decisions resolved at plan time" below, and every step
is written assuming them.

---

## Grounding facts (read once — applies to every step)

### What this story does and does not touch

- **Presentation and interaction only.** No change to the ruleset, to
  `src/rules/**`, to the game engine, or to the placement operations
  (`place` / `move` / `swap` / `returnToTray` / `clear` / `autoFill` in
  `src/rules/primary/v2/placement.ts`). If a step seems to need a rule-layer
  change, stop and escalate.
- **No ruleset version change.** Recorded games are unaffected.
- **`src/board/EngineGame.tsx` is parked.** It renders its own copy of the
  placement screen (same `Board` / `Tray` / `PlacementControls` /
  `PlacementStatus` components), but `App.tsx` does not route to it and the
  start-screen button that would reach it is disabled. It must keep compiling
  and passing `npm run typecheck` / `npm run lint`, and may be updated
  **mechanically** to match any prop change, but it is **not** verified by this
  story's gates and must not grow new behaviour here.
- **`src/engine/**` and `src/encoding/**` must not be edited.**

### Two editions, never one board

Every board figure is per-edition; nothing may assume Battle's dimensions.
Both are reachable from the hot-seat game's first screen (`GameChoice`).

| Game     | Layout         | Board | Home rows/side | Buffer row | Visible placement view | Army |
| -------- | -------------- | ----- | -------------- | ---------- | ---------------------- | ---- |
| Battle   | `standard_144` | 12x12 | 4              | yes        | 6 rows x 12 columns    | 25   |
| Skirmish | `standard_64`  | 8x8   | 3              | no         | 4 rows x 8 columns     | 16   |

Skirmish (`2-1:SKIRMISH`) additionally closes some home squares to Towers
(story 00000025); Battle closes none. `squaresClosedToTowers(placement)` is the
single source of that set and is already empty on Battle by geometry.

### Where the relevant code is today

- **`src/board/grid/AccessibleGrid.tsx`** — the reusable WAI-ARIA grid
  composite widget (story 00000004, Step 5), whose header comment names this
  story as its intended second consumer. Contract: props are `label`
  (the grid's `aria-label`), `rows` (a **rectangular** 2-D array of
  `GridCellDescriptor` = `{ content?, label, focusable, actionable }` in screen
  order), `onActivate({ row, column })` (fired for `actionable` cells on click
  and on Enter/Space), `announcement?` (text pushed into a polite live region
  that is a sibling of the `role="grid"` element), and `className` (applied to
  the grid element). It provides `role="grid"`/`row"`/`gridcell`, roving
  `tabindex`, arrow-key navigation that **skips non-focusable cells and clamps
  at edges** (no wraparound), Enter/Space activation, and the live region. It
  accepts **no `style` prop** — a consumer needing inline CSS custom properties
  must put them on a wrapper element (see `FullBoard.tsx`'s
  `.full-board__stage`). Its initial roving-tabindex target is
  `firstFocusablePosition` — the first focusable cell in row-major
  (top-to-bottom, left-to-right) order — which Step 2 makes overridable.
- **`src/board/grid/gridNavigation.ts`** — the pure navigation math behind it
  (`nextFocusPosition`, `firstFocusablePosition`), unit-tested in
  `gridNavigation.test.ts`.
- **`src/board/FullBoard.tsx`** — the reference consumer to imitate. Study how
  it maps domain rows/columns onto the grid's index space, its private
  `squareLabel` helper ("square name, plus what occupies it"), how it marks
  every cell `focusable: true` while driving `actionable` from a caller-supplied
  set, and how it forwards `announcement`.
- **`src/board/Board.tsx`** — the Phase 1 placement board this story ports. It
  renders a **partial, non-uniform view**: `visibleRows(activeSide, layout)`
  (from `boardView.ts`) returns the near lake row, then the buffer row when the
  layout has one, then the side's home rows; `visibleColumns(activeSide, layout)`
  returns the columns in screen order. Squares are plain `<div>`s with `onClick`
  wired **only** for `band === "home"`; the buffer and lake-row bands are greyed
  and made unclickable by `pointer-events: none` in `Board.css`. `Board` renders
  cells directly into one CSS grid (no row wrappers) sized by inline
  `--columns`/`--rows` custom properties.
- **`src/board/HotSeatGame.tsx`** — owns the whole hot-seat flow and all of the
  placement click grammar in `handleSquareClick`, plus `handleSelectType`,
  `handleReturnToTray`, `handleClearBoard`, `handleAutoFill`, `handleConfirm`.
  Its `Selection` type is `{ kind: "trayType" } | { kind: "boardSquare" } | null`.
  It also holds the Tower feedback state (`towerRefusal`, `autoFillExhausted`)
  and resolves it through `towerLiveRegionMessage`.
- **`src/board/Tray.tsx`** — native `<button>`s, one per roster piece type, with
  `aria-pressed`, an `aria-hidden` icon, the display name, and the remaining
  count; natively `disabled` when the count reaches zero.
- **`src/board/PlacementControls.tsx`** — "Return to tray" / "Cancel" (rendered
  only while a placed piece is selected) and an always-rendered "Clear board"
  (natively `disabled` when nothing is placed). Its visible copy currently says
  "click".
- **`src/board/PlacementStatus.tsx`** — whose turn, "N / M placed", "Auto-fill"
  (natively `disabled` once complete), "Confirm" (natively `disabled` until
  legal), and an **always-mounted** `role="status" aria-live="polite"` region
  carrying the Tower messages.
- **`src/board/towerPlacementMessages.ts`** — the pure, unit-tested Tower
  wording plus `towerLiveRegionMessage`'s precedence. The model to imitate for
  new player-facing wording.
- **`src/board/playAnnouncement.ts`** — the pure, unit-tested Phase 2
  live-region wording. The model for this story's placement wording module.
- **`src/board/sideNames.ts`** — `sideColorName(side)` → "Red"/"Blue". The one
  canonical mapping; never show "white"/"black" to a player.
- **`src/app/StartScreen.tsx`** — the start screen, with the natively `disabled`
  "Play against the computer" button and its `aria-describedby` note.

### Conventions this repository enforces

- Player-facing text uses the sides' **colors** (via `sideColorName`) and the
  word **"move"**, never "ply". Square names come from `squareKey` ("D2").
  Piece names come from `PIECE_CATALOG[...].displayName`.
- Every module carries a header comment explaining what it is and why; **update
  the header comment of every file a step touches, in that same step**, naming
  this story and the step. This is checked at peer review.
- Colocated tests (`foo.test.ts` next to `foo.ts`), Vitest, `node` environment.

### Verification environment

- Commands: `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run format:check`, `npm run build`, `npm run dev`. Baseline before this
  story: **712 tests in 31 files, all passing.**
- **There is no jsdom and no component-testing library, and introducing one is
  explicitly out of scope** (owner decision). ARIA roles, roving tabindex,
  keyboard interaction and live-region content therefore **cannot** be asserted
  automatically. Any **pure** logic this story adds is unit-tested;
  `eslint-plugin-jsx-a11y` guards the static markup; everything else is verified
  by hand at the gates. The deferred automated-coverage story is
  `doc/plan/proposed-stories/automated-accessibility-and-dom-testing.md`.
- **Manual pauses are deliberately concentrated (owner decision, 2026-08-05).**
  Only Steps 3 and 5 — the two risky structural changes, where breakage should
  surface immediately — carry their own manual check. Steps 6, 7 and 8 verify
  automatically, and everything they change is checked at **Gate A (Step 9)** or
  **Gate B (Step 10)**, whose checklists name those items explicitly. When
  implementing 6–8, do not treat the automated run as proof the feature works:
  it proves only that nothing broke, and the gate is where it is really judged.
- **This container has no file watching: Vite HMR never auto-refreshes.**
  Every manual verification below must start by **stopping and restarting**
  `npm run dev`, then hard-reloading the browser.
- Screen-reader checks are against **Windows Narrator**, matching story
  00000004's Gate D. A screen reader must be in **focus mode** for arrow keys to
  reach a `role="grid"` composite widget (Narrator: Caps Lock + Space leaves
  scan mode). That is expected ARIA-grid behaviour, not an app defect.

---

## Decisions resolved at plan time

These settle the story's three open items plus the questions the port raises.
They are binding; a step that wants to depart from one must record the deviation
in its `Notes:` and say why.

### 1. The partial view is one rectangle; every visible cell is focusable, only home cells are actionable

`visibleRows(side, layout)` x `visibleColumns(side, layout)` is **already
rectangular** (6x12 on Battle, 4x8 on Skirmish), so it maps onto the grid's
row/column index space directly, in screen order, with no padding and no holes.
The non-interactive bands stay **inside** the grid as
`focusable: true, actionable: false` cells.

Why not "outside the grid entirely": the story's in-scope item 2 requires each
square to announce its contents including **"a lake"**, and no home square is
ever a lake — the lake row shown above the home band is the _only_ place a lake
appears in the Phase 1 view. Dropping those rows from the grid would make that
requirement unsatisfiable and would remove the non-visual equivalent of the
greyed "the lakes are there" reminder that sighted players get.

Why `focusable: true` rather than `focusable: false`: a non-focusable cell is
invisible to keyboard navigation (`nextFocusPosition` skips it), so a player
navigating by keyboard would never learn the lakes exist. Focusable-but-not-
actionable gives them exactly the reminder the grey band gives a sighted player,
while Enter/Space on such a cell does nothing (the grid's own activation gate).
Mouse behaviour is unchanged: `AccessibleGrid` wires no `onClick` at all on a
non-actionable cell, which is what `pointer-events: none` achieves today.

**Consequence, fixed rather than accepted (owner decision, 2026-08-05):** the
bands sit at the _top_ of the view (`visibleRows` puts the lake row at index 0),
and `AccessibleGrid` picks its initial roving-tabindex target with
`firstFocusablePosition`, which scans row-major — so without a fix the first Tab
into the board would land on the top-left **lake** cell, one row (Skirmish) or
two rows (Battle) above the home band, on every board. Step 2 adds an optional,
default-preserving `initialFocus` to the shared grid and Step 3 has placement
pass **the first home-band square** (the top-left square of the home band in
screen order), so the first Tab lands where a player can actually act.

### 2. The key grammar is "the same click, from the keyboard" — no new gestures

`Enter`/`Space` on a focused home square must do **exactly** what one mouse
click on that square does today: it dispatches into the existing
`handleSquareClick` grammar in `HotSeatGame.tsx` (place / pick up / deselect /
move / swap), unchanged. This is the same select-then-activate convention Phase
2 uses. Everything else already has a keyboard route and keeps it:

| Action                     | Keyboard route                                      |
| -------------------------- | --------------------------------------------------- |
| Select / deselect a type   | Tab to the tray, Enter/Space on its `<button>`      |
| Place, pick up, move, swap | Tab to the board, arrows, Enter/Space on the square |
| Deselect a placed piece    | Enter/Space on the same square again, or "Cancel"   |
| Return to tray             | Tab to "Return to tray" (`PlacementControls`)       |
| Clear board                | Tab to "Clear board" (`PlacementControls`)          |
| Auto-fill                  | Tab to "Auto-fill" (`PlacementStatus`)              |
| Confirm / hand off         | Tab to "Confirm" (`PlacementStatus`)                |

**No `Escape` handling is added.** `AccessibleGrid` owns the board's key
handling and Phase 2 depends on it; adding a key would be a _behavioural_ change
to the shared component, which decision 5 forbids. "Cancel" and re-activating
the selected square already cover it.

### 3. "Closed to Towers" goes in **both** the square's accessible name and the existing hint

While a Tower is in hand — the only time `HotSeatGame` passes a non-empty
`closedToTowerSquares` — a closed square's accessible name gains a trailing
", closed to Towers", **and** `PlacementStatus`'s existing "Towers can't go on
… " hint stays exactly as it is. The hint gives the up-front overview (all
closed squares at once, before navigating); the name gives the point-of-decision
fact at the square itself, where a player who arrows onto it needs it. Neither
duplicates the other in time: the hint is announced once when the Tower is
picked up, the suffix only when that square is focused. Battle is unaffected
(the set is always empty there).

### 4. Two live regions, two jobs — nothing is announced twice

- The **board grid's** live region (`AccessibleGrid`'s `announcement`, driven by
  `Board`'s new pass-through prop) narrates **placement actions**: what was
  selected/placed/picked up/moved/swapped/returned/cleared/auto-filled, the
  running progress, and the turn hand-off.
- **`PlacementStatus`'s** existing region keeps **all Tower-rule messages**
  (drop-time refusal, exhausted Auto-fill, closed-squares hint, confirm-time
  block) with its existing `towerLiveRegionMessage` precedence, untouched.
- On an action that is **refused** by the Tower lane rule, the board
  announcement is **left unchanged** (so it re-announces nothing) and the
  refusal is spoken only by the status region. Exactly one region speaks per
  event.

### 5. The shared grid may take additive, default-preserving changes only

`src/board/grid/AccessibleGrid.tsx` and `src/board/grid/gridNavigation.ts` are
shared with Phase 2 (`FullBoard` / `PlayBoard` / the review screen), which is out
of scope here. They may be changed **only** where the change is (a) additive —
a new optional prop or a new exported helper — and (b) default-preserving, so
every existing caller that does not opt in behaves **exactly** as it does today
and every existing test in `gridNavigation.test.ts` passes **unchanged**. Step 2
is the one such change this story makes (`initialFocus`). Any change that would
alter behaviour for an existing caller — a new key binding, different navigation
or focus rules, a changed default — is **not** permitted: stop and escalate.

### 6. What "no leak in the neutral end state" means for today's app

Story 00000001's separate end-of-placement screen no longer exists: the second
Confirm goes straight into Phase 2, where both armies are visible by rule. The
concrete, still-live requirement is therefore about the **hand-off**: when Red
confirms, Blue must not be able to hear anything about Red's layout. `Board`
already renders only `activePlacement(session)`, so labels are safe; the risk is
the **live region**, which must be **replaced** with the hand-off sentence at
every Confirm rather than left holding Red's last action.

### 7. `aria-disabled` + no-op replaces the native `disabled` attribute — on this story's surface only

A natively `disabled` button is removed from the tab order entirely, so a
keyboard or screen-reader user never reaches it, never hears why it is
unavailable, and is dropped onto `<body>` if the control disables itself as a
result of being activated. This story replaces it with `aria-disabled="true"`
plus a no-op activation (keeping the identical visual treatment) in exactly
three places, and **nowhere else** (owner decision, 2026-08-05):

- the **tray** (Step 6) — the story requires every piece type to announce its
  name and remaining count, which a used-up, unreachable entry cannot do;
- the **self-disabling placement controls** (Step 7) — "Return to tray",
  "Cancel", "Clear board", "Auto-fill";
- the **start screen's "Play against the computer"** (Step 8) — story
  00000023's deferred finding #13.

**Phase 2 and the review screens are deliberately left alone**, along with
"Confirm" (see Step 7 for why that one stays natively disabled). A later
reviewer should read that as scope, not oversight: those surfaces are not this
story's, and story 00000004 already gated Phase 2's accessibility.

---

## Step 1 — Pure wording module for placement accessibility text

Status: committed

Notes: Added `src/board/placementAnnouncement.ts` and its colocated
`placementAnnouncement.test.ts` (27 tests), providing `placementSquareLabel`
(an object-parameter function, given the many booleans a home/buffer/lake-row
square's label depends on), `trayEntryLabel`, and one function per placement
event (`describeTraySelected`/`describeTrayDeselected`/`describePiecePlaced`/
`describePiecePickedUp`/`describePieceMoved`/`describePiecesSwapped`/
`describeReturnedToTray`/`describeBoardCleared`/`describeAutoFillCompleted`/
`describeHandOff`/`describePlacementComplete`). Every piece/side-naming event
sentence includes the active side's color via `sideColorName` even though
placement only ever shows one side's own pieces, for consistency with how
`playAnnouncement.ts`/`FullBoard.tsx` always name a piece's color and so the
sentence still makes sense to a listener who tabbed straight to the board
without hearing the turn heading first — not explicitly required by the plan's
wording rules but consistent with its "sideColorName for sides" convention;
recorded here since it is a design choice beyond the plan's literal text, not
a deviation from anything the plan mandated. `describeReturnedToTray` names the
square the piece is returned _from_ (not specified by the plan's event list,
but needed for the sentence to be meaningful, mirroring `describePiecePlaced`
naming the destination). `npm run typecheck`, `npm run lint`, `npm test`
(739 tests = 712 baseline + 27 new, all passing), and `npm run format:check`
all clean.

Add a new pure module `src/board/placementAnnouncement.ts` (no React import,
no DOM) plus a colocated `placementAnnouncement.test.ts`, following
`playAnnouncement.ts` and `towerPlacementMessages.ts` as models. It is the
single home for every string this story adds, so all of it is unit-testable in
the `node` Vitest environment. Nothing consumes it yet.

It must provide:

1. **A square's accessible name**, from the information `Board` has for a cell:
   the square, its `RowBand` (`"home"` / `"buffer"` / `"lake-row"` from
   `boardView.ts`), whether it is a lake, the piece type placed on it (if any)
   and the active side (for the color name), whether it is the currently
   selected square, and whether it is currently closed to Towers. Shape it on
   `FullBoard.tsx`'s `squareLabel`: the square name first, then what occupies
   it, then any state suffixes. It must distinguish, at minimum: an empty home
   square; an occupied home square (color + piece display name); the selected
   square; a closed-to-Towers square (decision 3); a lake; and a square in the
   buffer or lake band, which must read as **not part of the active player's
   placement area** (the non-visual equivalent of the grey band).
2. **A tray entry's accessible name**, from the piece type and its remaining
   count, distinguishing "some left" from "none left" — the count must be
   unambiguous when read aloud (not a bare number), and correct for a count of
   one.
3. **A sentence per placement event**, for the live region: a tray type selected
   and deselected; a piece placed; a placed piece picked up; a piece moved; two
   pieces swapped; a piece returned to the tray; the board cleared; auto-fill
   completed; and Confirm handing off to the other player. Every sentence that
   follows a change in how many pieces are placed must carry the progress in
   words ("N of M placed"), since `PlacementStatus`'s visible "N / M placed" is
   not a live region. The hand-off sentence must name the **incoming** player by
   color and state their progress (which is always zero at that moment). Add one
   further sentence for the moment both armies are placed and Phase 2 begins,
   naming the side to move.

Wording rules: `sideColorName` for sides, `squareKey` for square names,
`PIECE_CATALOG[...].displayName` for pieces, "move" never "ply", no
"edition"/"flag"/"band"/"gridcell" jargon, and nothing that assumes a board
size or a roster.

Why it comes here: every later step consumes these strings, and this is the only
part of the story that can be verified without a person at the keyboard, so it
is worth isolating and testing first.

How to verify: **automated** — a new `src/board/placementAnnouncement.test.ts`
covering, at minimum: an empty home square, an occupied home square for **each**
side's color, the selected-square variant, a closed-to-Towers square, a lake
square, a non-lake square in the lake band, a buffer-band square (Battle only),
a tray entry with several left / exactly one left / none left, and every event
sentence including both the singular and plural progress readings and both
sides' colors as the incoming player. Then `npm test` (expect 712 + the new
tests, all passing), `npm run typecheck`, `npm run lint`, `npm run format:check`.

---

## Step 2 — Let a grid consumer choose where keyboard focus starts

Status: committed

Notes: Added a pure exported helper `resolveInitialFocus` to `gridNavigation.ts`
(`{ preferred?, rowCount, columnCount, isFocusable }` → `GridPosition | undefined`)
that returns `preferred` when it is in bounds and focusable, otherwise falls
back to `firstFocusablePosition`'s row-major scan — the same result as today
when `preferred` is omitted entirely. `AccessibleGrid.tsx` gained an optional
`initialFocus?: GridPosition` prop, consumed only inside the `useState` lazy
initializer for `focused` (via `resolveInitialFocus`); the later effect that
re-validates `focused` when the descriptors change shape still calls
`firstFocusablePosition` directly and unchanged, so `initialFocus` seeds only
the first render and never drags focus back afterward, and mounting still
never steals real DOM focus (that effect is untouched). Updated both files'
header comments to name this story/step. Extended `gridNavigation.test.ts`
with 5 new tests for `resolveInitialFocus` covering: a supplied focusable
position is chosen; an out-of-bounds supplied position falls back; a
non-focusable supplied position falls back; no supplied position falls back;
and the fallback is `undefined` when nothing is focusable. Every pre-existing
test in that file is unmodified (verified via `git diff`, which shows only
additions). No deviations from the plan. `npm run typecheck`, `npm run lint`,
`npm test` (744 tests = 739 baseline + 5 new, all passing), `npm run
format:check`, and `npm run build` are all clean.

Add an optional `initialFocus` prop to `src/board/grid/AccessibleGrid.tsx`: the
`GridPosition` the grid should use as its **initial** roving-tabindex target
instead of `firstFocusablePosition`'s row-major scan. This is the one change
decision 5 permits to the shared grid, and it exists because placement's view
puts the non-interactive lake/buffer bands at the top (decision 1).

Requirements:

- **Default-preserving.** With `initialFocus` omitted — which is every existing
  caller, including Phase 2's `FullBoard`/`PlayBoard` and the review screen —
  the grid must behave byte-for-byte as it does today: initial target from
  `firstFocusablePosition`, same fallback when the focused cell stops being
  focusable, same everything else. Phase 2 must not be touched at all.
- **Ignored when unusable.** A supplied position that is out of bounds or not
  focusable must fall back to today's `firstFocusablePosition` result rather
  than leaving the grid with an invalid or unreachable target.
- **Initial only.** It seeds the roving target on first render; it must not
  drag focus back on later renders, and it must not steal DOM focus on mount
  (the grid's existing "only move real focus when focus is already inside this
  grid" rule stands).
- Put the decision itself in `gridNavigation.ts` as a **pure exported helper**
  ("given an optional preferred position, the grid's dimensions and the
  focusable predicate, which position should the grid start on?"), so it is
  unit-testable in the `node` environment — the same split story 00000004 used
  for `nextFocusPosition`/`firstFocusablePosition`. `firstFocusablePosition`
  itself keeps its current exported behaviour and its existing tests unchanged.

Why it comes here: Step 3 passes `initialFocus` from the placement board, so the
prop must exist first; and separating this scaffolding from that behaviour keeps
it independently and _automatically_ verifiable.

How to verify: **automated** — extend `src/board/grid/gridNavigation.test.ts`
for the new helper: a supplied focusable position is chosen; an out-of-bounds
position falls back to the row-major first focusable; a non-focusable supplied
position falls back the same way; no supplied position falls back the same way;
and the fallback is `undefined` when nothing is focusable. **Every pre-existing
test in that file must still pass unmodified** — that is the evidence Phase 2 is
untouched. Then `npm test`, `npm run typecheck`, `npm run lint`,
`npm run format:check`, `npm run build`.

---

## Step 3 — Render the placement board through the accessible grid

Status: committed

Notes: Rewrote `Board.tsx` to build a rectangular `GridCellDescriptor[][]`
from `visibleRows`/`visibleColumns` and render it through `AccessibleGrid`,
following `FullBoard.tsx`'s pattern exactly: every visible cell is
`focusable: true`; `actionable` is `band === "home" && onSquareActivate !==
undefined`; each cell's `content` is the existing `BoardSquareCell` markup
(now taking `band`/`lake` directly instead of re-deriving them from
`square`/`layout`, since click handling moved off it entirely); each cell's
`label` comes from Step 1's `placementSquareLabel`; the grid's own
`aria-label` is `` `${sideColorName(activeSide)}'s placement board` ``
(Decision 1's "name whose board it is"). `initialFocus` is `{ row:
rows.findIndex(({ band }) => band === "home"), column: 0 }`, computed from
the same `visibleRows` array on every render (never a hardcoded index), with
`undefined` as a defensive fallback if no row is ever home-banded (never hit
in practice, matching `AccessibleGrid`'s own no-preference default). The
grid's `onActivate` maps `{row, column}` back to a domain `Square` through
the same `rows`/`columns` arrays. Renamed `onSquareClick` to
`onSquareActivate` (doc comment updated) and updated both call sites
(`HotSeatGame.tsx`, `EngineGame.tsx`) mechanically - `handleSquareClick`
itself keeps its name, since the click-grammar it implements is unchanged.
Added the optional `announcement` prop, forwarded straight to
`AccessibleGrid`; no caller sets it yet (Step 5). CSS: added a
`.board-stage` wrapper (mirroring `FullBoard.css`'s `.full-board__stage`,
`display: inline-block`) carrying the inline `--columns`/`--rows` custom
properties that used to live directly on `.board`, since `AccessibleGrid`
takes a `className` but no `style`; `.board` (passed as the grid's
`className`) keeps its existing `grid-template-*` rules unchanged, now fed
by inheritance. `pointer-events: none` stays on `.board-square--buffer`/
`--lake-row` (comment updated to explain it now only reaches the cell's
inner content, not `AccessibleGrid`'s own `role="gridcell"` wrapper, which
already gets no click handler for a non-actionable cell). No changes were
needed to `AccessibleGrid.css`'s focus ring (its overlay `::after` approach,
already built for exactly this "consumer content has its own background"
case, draws above the grey bands, the selected ink ring, and the
closed-to-Towers hatch without modification). Updated the header comments of
all four touched files (`Board.tsx`, `Board.css`, `HotSeatGame.tsx`,
`EngineGame.tsx`) naming this story and step; `EngineGame.tsx`'s note also
records that it is parked and only mechanically updated. No deviations from
the plan. `npm run typecheck`, `npm run lint`, `npm test` (744 tests, same
count as the Step 2 baseline - this step adds no new pure logic to test),
`npm run format:check`, and `npm run build` are all clean. Manual
verification (mouse behaviour, Tab landing on the first home square, arrow-key
clamping/skip-to-buffer-and-lake, Enter/Space activation, Phase 2 unaffected)
is the orchestrator's to run per this step's own gate, per the standing
instruction that manual checks are arranged by the orchestrator, not this
agent.

Rewrite `src/board/Board.tsx` so it renders through
`src/board/grid/AccessibleGrid.tsx` instead of its own bare `<div>` grid,
exactly as `FullBoard.tsx` does for Phase 2, applying **decision 1**:

- Build a rectangular `GridCellDescriptor[][]` from
  `visibleRows(activeSide, layout)` x `visibleColumns(activeSide, layout)`, in
  screen order — the outer array is rows top-to-bottom.
- `content` stays the existing `BoardSquareCell` render (band class, lake icon,
  piece icon, selected highlight, closed-to-Towers hatch), so the board looks
  the same as it does today.
- `label` comes from Step 1's square-name builder, given the cell's band, lake
  state, placed piece type, selected state, and whether the square is in the
  `closedToTowerSquares` prop.
- `focusable: true` for **every** cell; `actionable` **only** for
  `band === "home"` cells — and only when the activation callback is supplied,
  matching today's behaviour.
- Pass Step 2's `initialFocus` as the **first home-band cell** in screen order
  (the top-left square of the home band), computed from the same
  `visibleRows`/`visibleColumns` arrays — never a hardcoded index, since the
  home band starts at a different row on Battle (index 2) and Skirmish
  (index 1).
- The grid's `label` (its `aria-label`) must name whose board it is, using
  `sideColorName(activeSide)` — this is a hot-seat board that changes hands.
- Map the grid's `{ row, column }` position back to the domain `Square` through
  the same `visibleRows`/`visibleColumns` arrays used to build the descriptors
  (`FullBoard` shows the pattern), and invoke the caller's callback.

Also in this step:

- **Rename the activation prop** from `onSquareClick` to `onSquareActivate` (or
  similarly input-neutral), and update its doc comment: it is no longer a click.
  Update both call sites — `HotSeatGame.tsx` and `EngineGame.tsx` — mechanically.
- **Add an optional `announcement` prop** to `Board`, forwarded straight to
  `AccessibleGrid`. No caller sets it until Step 5.
- **CSS:** `AccessibleGrid` takes a `className` but **no `style`**, so the
  inline `--columns`/`--rows` custom properties must move to a wrapper element
  around the grid (mirroring `FullBoard.css`'s `.full-board__stage`), from which
  they inherit down. Pass the existing `board` class as the grid's `className`
  so `.board`'s `grid-template-*` rules keep applying. `AccessibleGrid` inserts
  `role="row"` wrappers that are `display: contents`, so cells remain direct
  grid items. Keep the greyed band treatment; the `pointer-events: none` rule
  may stay (it now only affects the cell's inner content, and non-actionable
  cells get no click handler anyway) but must not prevent the grid cell itself
  from taking focus or from showing `AccessibleGrid.css`'s focus ring. Check the
  amber focus ring is clearly visible over the grey bands, over the dark-ink
  selected highlight, and over the closed-to-Towers hatch.

Why it comes here: it is the foundation of the whole story — nothing about
keyboard operation or per-square announcements is possible until the board is a
grid. It needs Step 1's labels and Step 2's `initialFocus`, and nothing else.

How to verify: **manual** (kept as its own check because this is a structural
rewrite of the board's rendering, where breakage should surface immediately;
it is a focused check, not the full Gate A). Stop and restart `npm run dev`,
hard-reload, and for **both** Skirmish and Battle:

- With the mouse, the board looks and behaves exactly as before: same size and
  layout, greyed buffer/lake bands, click a tray type then an empty home square
  to place, click a placed piece to select it, click another to swap.
- `Tab` reaches the board as a single stop and the focus ring appears on the
  **first home square**, not on the lake row (Step 2's `initialFocus`).
- Arrow keys move a clearly visible focus ring one cell at a time in screen
  space; the ring clamps at all four edges with no wraparound; `Tab` moves focus
  out of the board again (never trapped).
- Arrowing up from the top home row reaches the buffer row (Battle) and the lake
  row (both), and `Enter`/`Space` there does nothing.
- `Enter`/`Space` on a home square does exactly what a click there does
  (place / pick up / move / swap), including with a tray type selected.
- Phase 2 is unaffected: play a couple of moves and confirm the board still
  behaves as before (its first Tab still lands on the top-left cell).
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run format:check` and
  `npm run build` all clean (`EngineGame.tsx` still compiles).

---

## Step 4 — Adopt `eslint-plugin-jsx-a11y`

Status: committed

Notes: Added `eslint-plugin-jsx-a11y@6.10.2` as a devDependency (`npm install`
updated `package.json`/`package-lock.json` as expected) and wired its
`flatConfigs.recommended` into `eslint.config.js` in a new block scoped to
`files: ["**/*.tsx"]` (kept separate from the `**/*.{ts,tsx}` block's
`extends`, so `.ts` files never get JSX-only rules - confirmed with
`npx eslint --print-config` on both a `.tsx` and a `.ts` file: 34 `jsx-a11y/*`
rules on the former, 0 on the latter). `npm run lint` then reported exactly
two violations, both in `src/board/grid/AccessibleGrid.tsx` and both expected
consequences of its correct WAI-ARIA composite-widget pattern (roving
tabindex: the `role="grid"` container owns key handling, individual
`role="gridcell"` children own `onClick`, and no DOM focus lives on the
container itself):

- `jsx-a11y/click-events-have-key-events` on the cell's `onClick` - this is
  the violation the plan explicitly anticipated and pre-authorized a
  suppression for.
- `jsx-a11y/interactive-supports-focus` on the `role="grid"` container's
  `onKeyDown` (it flags the container as an "interactive role" needing its
  own `tabIndex`, which does not apply here - the ARIA authoring practices
  are explicit that a roving-tabindex composite widget's _container_ is
  never itself a tab stop). The plan's text names only the "click events"
  family by name but frames the underlying justification (decision 5: no
  behavioural change to a component Phase 2 depends on) in a way that covers
  this second rule equally - restructuring to give the container its own
  `tabIndex` would add a spurious extra tab stop, a real behavioural change.
  Treated it as "anything else the plugin flags" per the dispatch
  instructions: genuinely in this story's surface (the file Step 2/3 already
  touch), not a Phase-2-only concern, so fixed it the same way as the
  pre-authorized case - flagging it here as a deviation from the plan's
  literal text (which named one violation, not two) for the owner's
  awareness, rather than leaving `npm run lint` failing or restructuring the
  shared grid. Both got a narrowly scoped `eslint-disable-next-line` (one
  rule, one line, in `AccessibleGrid.tsx`'s markup) with an explanatory
  comment; no rule was disabled globally or downgraded to a warning. Also
  extended `AccessibleGrid.tsx`'s header comment to name both suppressions.
  No other file needed a change - `Board.tsx`'s old `<div onClick>` markup
  was already gone as of Step 3, exactly as the plan predicted. `npm run
typecheck`, `npm run lint`, `npm test` (744 tests, unchanged from Step 3's
  baseline - this step adds no logic), `npm run format:check`, and `npm run
build` are all clean.

Add `eslint-plugin-jsx-a11y` as a devDependency and wire its flat-config
recommended ruleset into `eslint.config.js` for `**/*.tsx`, alongside the
existing extends (keeping `eslint-config-prettier` last, as it is today). Then
make `npm run lint` clean again:

- Fix every violation it reports **for real** where the markup is genuinely
  wrong.
- One violation is expected and must **not** be "fixed" by restructuring:
  `AccessibleGrid.tsx` puts its keyboard handler on the `role="grid"` container
  (as the WAI-ARIA grid pattern requires) while `onClick` sits on each
  `role="gridcell"` child, which trips the "click events must have key events"
  family of rules. Suppress it with a **narrowly scoped, commented**
  `eslint-disable-next-line` naming the rule and explaining the pattern — moving
  that handler would be a behavioural change to a component Phase 2 depends on
  (decision 5).
- Do not add rules beyond the plugin's recommended set in this story, and do not
  downgrade rules to warnings to get a clean run; a rule that cannot be honoured
  gets a commented, per-line suppression instead.

Why it comes here: after Step 3, so the placement board's old
`<div onClick>` markup is already gone and the plugin does not have to be
suppressed for code this story is about to delete anyway; before Steps 5–8, so
it guards every markup change they make.

How to verify: **automated** — `npm run lint` is clean. Confirm the plugin is
actually in force rather than silently inert, by running
`npx eslint --print-config src/board/Board.tsx` and checking that
`jsx-a11y/*` rules appear as errors (or by temporarily introducing a known
violation, seeing it fail, and reverting it — note in `Notes:` which you did).
Then `npm run typecheck`, `npm test`, `npm run format:check`, `npm run build`.

---

## Step 5 — Announce placement actions, progress, and the hand-off

Status: committed

Notes: Added a `boardAnnouncement` state string in `HotSeatGame.tsx`, wired
into `Board`'s `announcement` prop, and set it from `placementAnnouncement.ts`
sentences in `handleSelectType` (selected/deselected), every branch of
`handleSquareClick` (deselected, swapped, picked up, placed, moved),
`handleReturnToTray`, `handleClearBoard`, `handleAutoFill` (success only), and
`handleConfirm`'s mid-game hand-off (`describeHandOff`, replacing the previous
text per decision 6). Every branch that calls `refuseTowerPlacement` or
`reportAutoFillExhausted` returns before touching `boardAnnouncement`, leaving
it unchanged so only `PlacementStatus`'s region speaks for a refusal (decision
4). On the second Confirm, pushed `describePlacementComplete` (or, when the
game is already decided at the reveal, kept the existing `describeResult`
branch's priority unweakened) into the existing Phase-2 `playAnnouncement`
state - the one deliberate Phase-2 touch, exactly as scoped. Reset
`boardAnnouncement` to `""` in `handleNewGame`. Several handlers
(`handleSquareClick`'s swap/place/move branches, `handleReturnToTray`,
`handleClearBoard`) were refactored from "compute inside the `setSession`
functional updater" to "compute the next `PlacementState` once, up front, then
both build the announcement from it and hand it to `setSession`" - needed
because the announcement (e.g. "12 of 25 placed") requires the resulting
state's `progress` synchronously, which the fire-and-forget updater form
doesn't expose; behaviourally identical, since the updater's own `state`
parameter was always this same render's `placement` in this synchronous,
non-concurrent-mode codebase (`handleAutoFill` already used this precomputed
pattern for the same reason, per its own comment).

Deviations from the plan's literal text, both flagged for the owner:

1. **Added `describePieceDeselected`** to `placementAnnouncement.ts` (with
   tests), for `handleSquareClick`'s "click the same selected board square
   again" branch. Step 1's event list paired select/deselect only for a tray
   type, not for a picked-up board piece, but Step 5's plan explicitly lists
   "deselected" as one of `handleSquareClick`'s required branches - so the
   sentence didn't yet exist and was added per this task's own instruction
   ("if a sentence you need genuinely does not exist there, add it to that
   module with tests"). Its wording is identical in shape to the pre-existing
   `describeTrayDeselected` ("{Color} {Piece} deselected.") - kept as a
   separate function anyway so each call site names the event it actually
   means, rather than reusing a function documented for a different one.
2. **`PlacementControls`'s "Cancel" button remains unannounced.** It calls an
   inline `() => setSelection(null)` in `HotSeatGame.tsx`, performing exactly
   the same state change as re-activating the selected board square (which
   now announces "deselected"). The plan's Step 5 handler list names
   `handleSelectType`, every `handleSquareClick` branch,
   `handleReturnToTray`, `handleClearBoard`, `handleAutoFill`, and
   `handleConfirm` - not this inline callback - so it was left as-is rather
   than wired up, per "implement exactly what's written." Flagging this as a
   possible inconsistency for Gate B (Step 10): a player who cancels via the
   square gets an announcement, a player who cancels via the "Cancel" button
   does not, even though the two are the same action.

Also fixed story 00000023 peer-review finding #3: `gameAnnouncementRegion` (a
new local JSX constant, computed once per render from the `gameAnnouncement`
state) now renders identically - same element, same position relative to
`LeaveGameDialog` - in all three of the component's return branches (game
choice, placement, and, for symmetry, Phase 2), replacing the inline `<p>`
that previously existed only in the placement branch. React now keeps one
persistent DOM node for this live region across every branch change, so it is
already registered with assistive technology before `handleChooseGame` ever
gives it text.

`EngineGame.tsx` was not touched (it gets Step 1's square labels for free
through `Board`/`AccessibleGrid`, unrelated to this step); it still compiles
and typechecks.

`npm run typecheck`, `npm run lint`, `npm test` (745 tests = 744 baseline + 1
new `describePieceDeselected` test), `npm run format:check`, and `npm run
build` are all clean. The manual gate (Narrator, Skirmish then Battle,
covering the checklist above) is the orchestrator's to run.

Drive the board's live region from `HotSeatGame.tsx`, using Step 1's sentences
and **decision 4**'s division of labour:

- Add a board-announcement state string and pass it into `Board`'s
  `announcement` prop (added in Step 3).
- Set it in every placement handler: `handleSelectType` (selected / deselected),
  each branch of `handleSquareClick` (placed, picked up, deselected, moved,
  swapped), `handleReturnToTray`, `handleClearBoard`, `handleAutoFill` (on
  success only), and `handleConfirm`.
- **Refusals:** in every branch that calls `refuseTowerPlacement`, leave the
  board announcement **unchanged** — the status region already speaks. Likewise
  for an exhausted Auto-fill (`reportAutoFillExhausted`).
- **Hand-off (decision 6):** `handleConfirm` must **replace** the board
  announcement with the hand-off sentence naming the incoming player and their
  (zero) progress, so nothing about the outgoing player's layout is left in the
  region for the next player to hear.
- **Into Phase 2:** when the second Confirm ends placement, push the
  "both armies are placed, {Color} to move" sentence into the existing Phase-2
  `playAnnouncement` state — **unless** the game is already decided at the
  reveal, in which case the existing `describeResult` sentence keeps priority
  (that branch exists today and must not be weakened). This is the only Phase-2
  touch this story makes.
- Reset the board announcement to empty in `handleNewGame`, alongside the other
  cleared state.

Also fix **story 00000023 peer-review finding #3** (re-locate it; it was at
`HotSeatGame.tsx#L771-L783` on 2026-08-05): the game-choice announcement
paragraph (`role="status" aria-live="polite"`, class
`hot-seat-game__game-announcement`) exists **only** in the placement branch,
which mounts for the first time in the same update that sets its text — a
screen reader may announce nothing at all. Make the region exist in the
accessibility tree **before** its text arrives: render the same element, at the
same position in the returned tree, in the game-choice branch (and, for
symmetry, the Phase-2 branch) so React keeps one DOM node across the branch
change, following `PlacementStatus`'s established "always mounted, sometimes
empty" pattern.

Do not change `EngineGame.tsx` beyond keeping it compiling; it gets the new
square labels for free and is not otherwise wired here.

Why it comes here: it needs Step 1's sentences and Step 3's `announcement`
pass-through, and Steps 6–8 assume the region exists and has an owner.

How to verify: **manual** (kept as its own check: live-region wiring that
announces nothing, or announces twice, is invisible in every automated signal
this repository has, and finding #3 is exactly that failure mode). With Narrator
running, restart `npm run dev`, hard-reload, and on **Skirmish** (whose Tower
rule exercises the refusal path) and then **Battle**:

- Choosing a game is announced (finding #3) — this is the check that used to
  fail silently.
- Selecting a tray type, placing, picking up, moving, swapping, returning to
  tray, clearing, and auto-filling are each announced **once**, with the running
  "N of M placed" where the count changed.
- Refusing a Tower on a closed square announces the refusal **once**, from the
  status region only — the action narration does not also speak.
- Confirming announces the hand-off naming the incoming player, and says nothing
  about the outgoing player's pieces; the second Confirm announces that both
  armies are placed and whose move it is.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run format:check`,
  `npm run build` all clean.

---

## Step 6 — Make the tray perceivable and fully reachable

Status: committed

Notes: In `src/board/Tray.tsx`, gave each entry's `<button>` an explicit
`aria-label={trayEntryLabel(entry.id, count)}` (Step 1's wording), replaced
`disabled={isEmpty}` with `aria-disabled={isEmpty}`, and changed `onClick` to
an inline no-op guard (`if (isEmpty) return;` before calling `onSelect`) so
activating a used-up entry changes nothing — mirroring the existing
`aria-disabled` + no-op precedent already in the codebase at
`src/review/ReviewControls.tsx`/`ReviewControls.css`, which this step's
module comment now also cross-references implicitly by following the same
shape. `aria-pressed` and the `aria-hidden` icon (via `PieceIcon`) were left
untouched. In `Tray.css`, added `.tray__item[aria-disabled="true"]` alongside
the existing `.tray__item:disabled` selector (kept for defensiveness/possible
future native use, per the plan's "alongside" wording), both applying the
same dimmed/`cursor: default` treatment, so the visual result is identical to
before. Updated both files' header comments to name this story/step and to
record decision 7's scope (tray + self-disabling placement controls + start
screen; Phase 2 and review screens deliberately excluded), so a later
reviewer reads the remaining native `disabled` usages elsewhere as scope, not
oversight. No other file required changes: `Tray`'s prop signature is
unchanged, so `EngineGame.tsx` (parked) still compiles without modification.
No deviations from the plan. `npm run typecheck`, `npm run lint`
(`jsx-a11y` active, clean), `npm test` (745 tests, same count as the Step 5
baseline — this step adds no new pure logic, `trayEntryLabel` was already
tested in Step 1), `npm run format:check`, and `npm run build` are all
clean. Per this step's own verification note, the runtime behaviour (every
roster type reachable including a used-up one, correct announcements, a
used-up type genuinely inert) is for the owner to judge at Gate A (Step 9)
and Gate B (Step 10); not exercised manually here.

In `src/board/Tray.tsx`:

- Give each entry's `<button>` an explicit accessible name from Step 1's tray
  wording, so it reads as a piece type **and** a remaining count rather than a
  name followed by a bare number. The icon stays `aria-hidden` (it already is,
  via `PieceIcon`), and `aria-pressed` continues to carry the selected state.
- **Replace the native `disabled` attribute on an out-of-pieces entry with
  `aria-disabled="true"` plus a no-op activation** (decision 7), keeping the
  identical visual treatment — add an `[aria-disabled="true"]` selector
  alongside `Tray.css`'s existing `.tray__item:disabled` rule. Rationale: the
  story requires the tray to announce **each** piece type and its remaining
  count, and a natively `disabled` button is removed from the tab order
  entirely, so a keyboard or screen-reader user never reaches a type they have
  used up and is never told so. Activating it must change nothing.
- Note in the module header that this treatment is deliberate and scoped to this
  story's surface (decision 7) — Phase 2 and the review screens keep native
  `disabled`, which is scope, not oversight.

Why it comes here: it needs Step 1's wording and Step 4's lint guard, and it is
independent of the board work in Steps 3 and 5.

How to verify: **automated** — `npm run typecheck`, `npm run lint` (jsx-a11y is
now active and flags `aria-disabled` misuse), `npm test` (Step 1's tray-wording
tests cover the strings themselves), `npm run format:check`, `npm run build`,
all clean. This proves nothing broke, **not** that the tray reads correctly: the
runtime behaviour — every roster type reachable, each announcing its name, count
and selected state, a used-up type reachable and inert — is verified by the
owner at **Gate A (Step 9)** and **Gate B (Step 10)**, whose checklists name it.

---

## Step 7 — Focus is never dropped

Status: committed

Notes: `PlacementControls.tsx` now keeps "Return to tray", "Cancel" and
"Clear board" mounted at all times: all three moved out of the conditional
selection block into an always-rendered `.placement-controls__actions` row,
each with `aria-disabled` plus a no-op `onClick` guard when there is nothing
to act on (`hasSelection` for the first two, `canClear` for the third) -
following `Tray.tsx`'s established pattern exactly. Only the descriptive text
above the buttons still switches between the "piece selected" and "nothing
selected" wording, reworded to be input-neutral ("choose an empty square…",
"Select a placed piece to move it…", replacing every "click"). Added
`.placement-controls__actions` to `PlacementControls.css` and an
`[aria-disabled="true"]` selector alongside the existing `:disabled` one;
removed the now-inapplicable `.placement-controls__clear { align-self:
flex-start }` rule since that button moved out of the column-flex
`.placement-controls` into the new row wrapper. `PlacementStatus.tsx`'s
"Auto-fill" got the identical `aria-disabled` + no-op treatment (guard:
`progress.placed >= progress.total`), with the matching `[aria-disabled="true"]`
selector added to `PlacementStatus.css`; "Confirm" was left natively
`disabled`, exactly as the plan requires. `HotSeatGame.tsx` gained a second
focus-management effect, `useEffect(() => { if (configuration !== null)
headingRef.current?.focus(); }, [configuration])`, placed right after the
existing empty-dependency-array "focus on mount" effect - it fires only on
the `null` -> non-`null` transition (i.e. exactly when `handleChooseGame`
runs), fixing story 00000023's finding #10, and does not re-fire on
unrelated renders (selection changes, placement actions) since `configuration`
is untouched by those. `handleConfirm` now also calls
`headingRef.current?.focus()` unconditionally at its end (after the existing
`clearTowerFeedback()` call), covering both branches the plan's Gate A
checklist names: a mid-game hand-off (focus lands on the heading, now the
"new" active player's landing point) and the final hand-off into Phase 2
(the same heading persists into that branch too, so this is "somewhere in
Phase 2, not `<body>`" without needing a second, Phase-2-specific target).
This relies on the heading `<h1>` sitting at the same position in every one
of this component's four render branches, so React keeps one DOM node
mounted for the component's whole lifetime - already true before this step
(the original mount-only effect depended on it) and unchanged here. Updated
the header comments of all four touched files
(`PlacementControls.tsx`/`.css`, `PlacementStatus.tsx`/`.css`,
`HotSeatGame.tsx`) naming this story and step.

No deviations from the plan's literal text. `EngineGame.tsx` needed no
changes - `PlacementControls`'s and `PlacementStatus`'s prop signatures are
unchanged, so it still compiles as-is (confirmed by `npm run typecheck` and
`npm run build`, both clean).

`npm run typecheck`, `npm run lint`, `npm test` (745 tests, unchanged from
the Step 6 baseline - this step adds no new pure logic to test),
`npm run format:check` (one file needed a `prettier --write` pass after the
edit, then clean), and `npm run build` are all clean. Per this step's own
verification note, the runtime behaviour (focus never lands on `<body>`
after any of the six actions, the reworded copy reads naturally) is the
owner's to judge at **Gate A (Step 9)**, whose checklist names it; not
exercised manually here.

Placement has several controls that **remove or disable themselves as a direct
result of being activated**, which drops a keyboard user onto `<body>`. Fix each
so focus always lands somewhere sensible, and never on `<body>`:

- **`PlacementControls.tsx`** — "Return to tray" and "Cancel" are rendered only
  while a placed piece is selected, and both clear that selection, unmounting
  the focused button. Keep the panel's buttons **mounted at all times** with
  `aria-disabled="true"` and a no-op activation when there is no selection
  (decision 7), so focus survives the action; the panel's descriptive text still
  switches between the "something selected" and "nothing selected" wording. Add
  an `[aria-disabled="true"]` selector alongside `PlacementControls.css`'s
  `:disabled` rule.
- **"Clear board"** (`PlacementControls.tsx`) becomes disabled the moment it
  succeeds (nothing left to clear). Same treatment: `aria-disabled` + no-op
  instead of the native attribute.
- **"Auto-fill"** (`PlacementStatus.tsx`) becomes disabled the moment it
  succeeds (army complete). Same treatment, with an `[aria-disabled="true"]`
  selector alongside `PlacementStatus.css`'s `:disabled` rule.
- **"Confirm"** (`PlacementStatus.tsx`) hands off, after which it is disabled
  again for the incoming player. This one **stays natively `disabled`** — a
  keyboard user must not be able to activate an illegal confirm, and unlike the
  controls above it is a hand-off, i.e. a screen change in all but name. Instead
  move focus **deliberately** on hand-off to the placement screen's heading
  (`HotSeatGame`'s existing `tabIndex={-1}` `.app__title` with `headingRef`),
  which is also the right landing place for the new player.
- **Story 00000023 peer-review finding #10** (re-locate it; the heading-focus
  effect was at `HotSeatGame.tsx#L303-L306` on 2026-08-05): choosing a game
  unmounts `GameChoice` — including the focused "Play {Game}" button — without
  moving focus, dropping the player on `<body>` at the start of placement. The
  existing heading-focus `useEffect` has an empty dependency array and fires
  only on mount, on the game-choice screen. Move focus to the placement heading
  when the game is chosen, reusing the same `tabIndex={-1}` heading pattern.
  Take care not to make the effect re-fire on unrelated renders (which would
  steal focus mid-placement).

Also sweep the placement copy for **input-neutral wording**: `PlacementControls`
currently instructs the player to "click" ("Click a placed piece to move
it…", "{Piece} selected - click an empty square to move it there, or click
another placed piece to swap them."). Reword so it describes the choice, not the
input device, keeping the same plain-language voice and the word "move".

Why it comes here: it needs Steps 3, 5 and 6 in place (the board is now a
focusable widget, and decision 7's `aria-disabled` technique is already
established in the tray), and Gate A cannot pass without it.

How to verify: **automated** — `npm run typecheck`, `npm run lint`, `npm test`,
`npm run format:check`, `npm run build`, all clean. As with Step 6 this proves
only that nothing broke: focus behaviour cannot be asserted without a DOM test
environment, so where focus actually lands after each of these six actions is
verified by the owner at **Gate A (Step 9)**, whose checklist names each one.

---

## Step 8 — "Play against the computer" stays reachable on the start screen

Status: committed

Notes: In `src/app/StartScreen.tsx`, replaced the native `disabled` attribute
on "Play against the computer" with `aria-disabled={true}` plus a no-op
`onClick`, following the identical pattern established in Step 6 (`Tray.tsx`)
and Step 7 (`PlacementControls.tsx`): the button, its `aria-describedby`
pointer to `start-screen__computer-note`, and the note itself are unchanged,
so the note stays associated with (and now reachable alongside) the button.
`App.tsx` was not touched - it already had no `onClick` wired to this button
and still routes nowhere from it. In `StartScreen.css`, added a
`.start-screen__choice[aria-disabled="true"]` selector alongside the existing
`:disabled` rule so the dimmed visual treatment is byte-for-byte unchanged.
Updated both files' header comments to name this story and step, and to
cross-reference decision 7's full scope (tray, self-disabling placement
controls, start screen) as `Tray.tsx`'s header already does, so a later
reader sees this as one deliberate, bounded pattern rather than three
unrelated changes. No deviations from the plan. `npm run typecheck`,
`npm run lint` (jsx-a11y clean), `npm test` (745 tests, unchanged from the
Step 7 baseline - this step adds no new pure logic), `npm run format:check`,
and `npm run build` are all clean. Per this step's own verification note, the
runtime behaviour (Tab reaches the button, Narrator announces it as
unavailable together with its note, activation does nothing) is the owner's
to judge at Gate A (Step 9) and Gate B (Step 10); not exercised manually
here.

Fix **story 00000023 peer-review finding #13** (re-locate it; it was at
`src/app/StartScreen.tsx#L55-L74` on 2026-08-05). The button uses the native
`disabled` attribute, which removes it from the tab order entirely, so a
keyboard or screen-reader user never reaches it **or** its `aria-describedby`
explanatory note — the story 00000023 intent ("shown but disabled, with a short
note saying so") is currently delivered only to sighted mouse users.

Replace the native attribute with `aria-disabled="true"` and a no-op activation
(decision 7), keeping the exact same visual treatment (add an
`[aria-disabled="true"]` selector alongside `StartScreen.css`'s
`.start-screen__choice:disabled` rule) and keeping the `aria-describedby` note.
`App.tsx` still routes nowhere from it, and activating it must do nothing at all.

Why it comes here: it is independent of the placement work and is the last of
the three findings deferred from story 00000023; doing it after Steps 6–7 means
decision 7's pattern is already established and consistent across this story's
surface.

How to verify: **automated** — `npm run typecheck`, `npm run lint`, `npm test`,
`npm run format:check`, `npm run build`, all clean. The observable behaviour —
Tab reaches the button, the screen reader announces it as unavailable together
with its note, and activating it does nothing — is verified by the owner at
**Gate A (Step 9)** and **Gate B (Step 10)**, whose checklists name it.

---

## Step 9 — Gate A: keyboard-only placement, both editions

Status: committed

Notes: The owner ran Gate A (both editions, per the checklist below) and it
passed, with one piece of polish required: the "Capture the Flag" heading
(`.app__title`, `tabIndex={-1}`, focused programmatically on mount and on
hand-off by `StartScreen.tsx`/`HotSeatGame.tsx`/`EngineGame.tsx`/
`ReviewScreen.tsx`) showed the browser's default blue focus ring even when
that programmatic focus followed a mouse click, which looked wrong for
pointer-driven play. Fixed in `src/App.css` (the sole stylesheet for
`.app__title`, imported by every screen that renders the heading, so this
covers all four screens without touching their `.tsx` files): suppressed the
UA default outline on plain `:focus` and added a `:focus-visible` outline
(`3px solid var(--focus-ring, #ffb703)`, `outline-offset: 2px`), matching
`AccessibleGrid.css`'s existing `:focus`/`:focus-visible` split and its
`--focus-ring` custom property (`src/index.css`) rather than inventing a new
ring color. `:focus-visible` tracks the browser's last-input-modality
judgement, so the same programmatic `.focus()` call still shows the ring when
it follows a keyboard action (e.g. Tab-and-Enter through "Play a game", or
Confirm activated via Enter/Space) but shows nothing when it follows a mouse
click - exactly the owner's requirement. No change to `tabIndex={-1}` or any
`focus()` call; only the ring's visibility changed. Added a header comment to
`App.css` (it had none before) naming this story and step. No other file
needed a change - `AccessibleGrid.css`'s own ring, the board's, and every
button's default focus treatment were unaffected and out of scope for this
finding. `npm run typecheck`, `npm run lint`, `npm test` (745 tests,
unchanged - no logic added), `npm run format:check`, and `npm run build` are
all clean; the dev server was not started for this fix per instruction, the
owner will re-check visually.

**Second Gate A polish pass.** The first pass above was insufficient: the
owner reported the browser's blue ring was gone but replaced by our own amber
one on every page load, when they expected to see no ring at all until using
the keyboard. Root cause: the heading is focused _programmatically on mount_,
before the player has given the browser any input to judge modality from -
with nothing to go on, browsers resolve `:focus-visible` in favour of
showing a ring, so gating on `:focus-visible` alone (the first pass's
approach) could not distinguish "focused via a mouse click that triggered a
hand-off" from "focused via mount with no prior input at all"; both look
identical to the browser's own heuristic. `:focus-visible` alone cannot
express "no ring until the player has actually used the keyboard."

Fixed by tracking input modality explicitly rather than relying on the
browser's guess. Added a `useEffect` in `App.tsx` (the app shell, which never
unmounts, so this runs once for the whole app rather than being duplicated
per screen) that sets `data-input-modality="keyboard"` on
`document.documentElement` the first time the player presses `Tab` or an
arrow key, and removes it again on the next `pointerdown` - so a player who
switches back to the mouse stops seeing rings. Listeners are added and
removed in the effect's cleanup. `App.css`'s `.app__title:focus-visible` rule
was rescoped to `:root[data-input-modality="keyboard"]
.app__title:focus-visible`, so the ring now draws only once both the browser
_and_ our own explicit flag agree keyboard use has occurred - satisfying "no
focus indicator until the player has used the keyboard" exactly, including
on the very first page load and every subsequent programmatic focus that
follows a mouse action. `tabIndex={-1}` and every `focus()` call are
unchanged (Step 7's mechanism is untouched); only the heading's ring
visibility changed again. The blast radius is deliberately kept to the
programmatically-focused heading only: no other focus-ring rule in the
codebase (buttons, `AccessibleGrid.css`'s board ring) was touched, so a
keyboard user still sees focus immediately on every genuinely interactive
control the moment they start keyboarding. Updated the header comments of
both `App.tsx` and `App.css` to name this second pass. No other files
touched. `npm run typecheck`, `npm run lint`, `npm test` (745 tests,
unchanged), `npm run format:check`, and `npm run build` are all clean; the
dev server was not started per instruction, the owner will re-check visually.

This is a **hard stop for owner confirmation**, plus whatever polish is needed
to pass it (focus styling, tab order, activation gaps). It also carries the
folded-in checks for Steps 6, 7 and 8, which verified automatically. No new
feature work: if the gate exposes something that needs a genuinely new decision,
stop and escalate rather than expanding scope.

How to verify: **manual — Gate A.** Stop and restart `npm run dev`, hard-reload,
and run the following **twice: once as Battle, once as Skirmish**, with the
mouse unplugged or untouched throughout:

- **Start screen (Step 8):** `Tab` reaches "Play against the computer";
  `Enter`/`Space` on it does nothing and does not navigate; it looks exactly as
  it did before. `Tab` reaches "Play a game" and starts a hot-seat game.
- Choose the game on the choice screen by keyboard.
- **Board entry (Steps 2–3):** the first `Tab` into the board lands on a **home**
  square, not on the lake or buffer band.
- Complete a **full placement for both players** using only the keyboard:
  select a type from the tray, place it, place several more, pick up a placed
  piece and move it to an empty square, swap two placed pieces, return a piece
  to the tray, clear the board, auto-fill, and confirm the hand-off — then do
  the same for the second player and land in Phase 2.
- **Tray (Step 6):** every roster piece type is reachable by `Tab`, **including
  a type with none left**, and activating a used-up type changes nothing.
- **Focus is never lost (Step 7):** after each of the following, focus is still
  on a visible, sensible control — check by pressing `Tab` once and seeing focus
  continue from where you were, or by reading `document.activeElement` in the
  browser console, which must **never** be `<body>`: choosing a game (focus
  should be inside the placement screen, on its heading); "Return to tray";
  "Cancel"; "Clear board" as the last placed piece goes back; "Auto-fill" as the
  army completes; "Confirm" for the first player (focus lands on the heading for
  the second player) and for the second player (focus lands somewhere in Phase
  2, not on `<body>`).
- **Copy (Step 7):** the reworded control copy reads naturally and never says
  "click" or "ply".
- On Skirmish, attempt to place a Tower on a closed square by keyboard and
  confirm the refusal does not break the flow (the board stays as it was and you
  can immediately try another square).
- Throughout: **focus is always visible** (the amber ring on the board, the
  browser's own ring on buttons) and **never trapped** (Tab always leaves the
  board and cycles the page).
- Arrow keys clamp at all four edges of the board with no wraparound, and the
  non-interactive buffer/lake bands can be reached but do nothing.

Record the result (and any polish applied) in this step's `Notes:`.

---

## Step 10 — Gate B: screen-reader perception, both editions

Status: pending

This is a **hard stop for owner confirmation**, plus wording polish needed to
pass it (announcement phrasing, label ordering, verbosity). Changes here should
land in `placementAnnouncement.ts` (and its tests) wherever they are wording,
not in the components. It also carries the folded-in screen-reader checks for
Steps 6 and 8.

How to verify: **manual — Gate B.** Stop and restart `npm run dev`, hard-reload,
and run the following **twice: once as Battle, once as Skirmish**, with
**Windows Narrator** running (Caps Lock + Space to leave scan mode before using
arrow keys on the board):

- **Start screen (Step 8):** "Play against the computer" announces its title,
  its detail, that it is unavailable, and its explanatory note.
- **Squares:** arrowing across the board announces each square's **position**
  and **contents** — empty, a lake, or a specific piece named by its display
  name and its side's **color**; the selected square says so; a buffer/lake-band
  square says it is outside the placement area; and on Skirmish, while a Tower
  is in hand, a closed square says it is closed to Towers (decision 3) — as does
  the existing "Towers can't go on …" hint when the Tower is picked up.
- **Tray (Step 6):** every roster type announces its name, its remaining count,
  and its selected state, **including a type with none left**.
- **Turn, progress and hand-off:** the chosen game is announced when placement
  starts (finding #3); each action announces the running "N of M placed"; and
  each Confirm announces the hand-off naming the incoming player.
- **No leak (decision 6):** immediately after the first player confirms, nothing
  the second player can hear — the live regions, the board's labels, the tray —
  describes the first player's layout.
- **No double-speak:** no event is announced twice from two different regions;
  in particular a Tower refusal speaks once.

Record the result (and any wording changes) in this step's `Notes:`.

---

## Step 11 — Gate C: no regression for mouse and touch, both editions

Status: pending

This is a **hard stop for owner confirmation**. The story requires that mouse and
touch placement continue to work exactly as before — story 00000001's placement
gates must still pass unchanged. Any fix needed here is a regression fix, not
new behaviour.

How to verify: **manual — Gate C.** Stop and restart `npm run dev`, hard-reload,
and re-run story 00000001's placement gates (see that story's
`implementation-plan.md`, Gates A–E) with the **mouse** for **both** Battle and
Skirmish:

- The board draws from the active player's own perspective, home rows nearest
  them, with the greyed buffer (Battle) and lake row above — unchanged in size,
  proportion and colour.
- Every roster piece type shows its icon, name and live remaining count; a type
  with none left is visibly unavailable and does nothing when clicked.
- Click-to-place works; clicking a placed piece selects it; clicking an empty
  square moves it; clicking another placed piece swaps them; "Return to tray",
  "Cancel" and "Clear board" behave as before.
- "Auto-fill" fills the army; "Confirm" is disabled until the army is complete
  and legal, and hands off to the other player; the second Confirm starts
  Phase 2 with the two armies just placed.
- Nothing about the visual appearance of the board, tray, controls or status bar
  has changed, and no focus ring appears on a plain mouse click.

Record the result in this step's `Notes:`.

---

## Step 12 — README accuracy check and final sweep

Status: pending

Confirm `README.md` is still accurate given this story's changes, and update it
if warranted. The story adds no new screen, dependency-facing setup step or
package-layout change, but it does change **how a player can operate the app**
(keyboard and screen reader support for placement), which the README does not
currently mention at all — decide, with the owner's plain-language audience in
mind, whether a short player-facing note belongs there, and say what you decided
in `Notes:` either way. The `/update-readme` command automates the review (it
reads the branch diff and updates `README.md` if warranted).

Also sweep everything this story touched (`placementAnnouncement.ts`,
`gridNavigation.ts`, `AccessibleGrid.tsx`, `Board.tsx`, `Tray.tsx`,
`PlacementControls.tsx`, `PlacementStatus.tsx`, `HotSeatGame.tsx`,
`StartScreen.tsx`, `eslint.config.js`) for:

- player-facing strings that say "click", "ply", "white"/"black", an edition id,
  or any grid/ARIA jargon;
- module header comments that no longer describe what the module does (this
  repository's convention is that every touched file's header is updated in the
  step that touched it) — in particular `AccessibleGrid.tsx`'s header, which
  names this story as its future second consumer and should now say it is one;
- `CONTRIBUTING.md` — check whether the new `eslint-plugin-jsx-a11y` dependency
  and the "accessibility is verified manually, pure wording is unit-tested"
  convention belong in its toolchain/dependency notes.

Re-read any changed `README.md` / `CONTRIBUTING.md` prose end to end for
accuracy and tone before finishing.

Why it comes here: last, so the documentation describes finished, gate-passed
behaviour.

How to verify: **automated** — `npm run typecheck`, `npm run lint`, `npm test`,
`npm run format:check` and `npm run build` all clean, with the documentation
read-through above done as part of the step's own work.
