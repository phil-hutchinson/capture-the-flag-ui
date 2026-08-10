# Implementation Plan — Story 00000032: Rules popup on the start screen

This plan adds a **"How to play"** button as the first choice on the start
screen, and a single modal popup behind it: a full-width header, six short
sections in two columns, and ten small illustrations drawn with the game's own
piece artwork on 5×5 cutouts of a real board.

Read `story.md` in this folder **in full** before starting any step. Its
**Policy (fixed by the owner)**, **The popup's content** (the copy is fixed),
**In scope / Out of scope**, **Design decisions & constraints** and
**Manual-verification gates** are settled and are not re-litigated here. This
plan resolves story.md's **"Open items to resolve at plan time"** — the
resolutions are in "Decisions resolved at plan time" below, and every step is
written assuming them.

Every step is written for an implementer who has read `story.md`, this plan,
and their own step, and nothing else.

---

## Grounding facts (read once — applies to every step)

### The rules are not restated here

`doc/ruleset/rules.md` in the companion
[capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
repository is the single source of truth. The popup's copy is a deliberate
**simplification** of §4.2 (movement) and §4.3 (attacks and combat), written
for players. The copy in story.md is the copy; no step invents, extends or
"corrects" a sentence of it.

Player-facing vocabulary applies in full: the popup says **"move"**, never
"ply", and names pieces as the rules name them (**Tower**, **Flag**).

### There is no DOM/component test environment, and this story must not need one

Vitest runs in `node` only — no jsdom, no component-testing library (see
`CONTRIBUTING.md`, "Testing accessibility", and
`doc/plan/proposed-stories/automated-accessibility-and-dom-testing.md`, which
stays a separate proposed story). Consequences that shape every step:

- **Only plain `.ts` modules can be unit-tested.** Every `.tsx` component in
  this story is verified by a manual gate, exactly like every other component
  in this repo.
- That is why Steps 1 and 2 pull everything that _can_ be data — the ten
  figures, and the popup's copy — out into React-free `.ts` modules, leaving
  the `.tsx` layer as thin rendering.

### Where the relevant code is today

- `src/app/StartScreen.tsx` / `StartScreen.css` — the start screen. Three
  choice buttons today (`Play a game`, `Play against the computer` — shown but
  `aria-disabled`, `Review a game`), each a `<button class="start-screen__choice">`
  with a bold `…__choice-title` span and a `…__choice-detail` span, inside a
  `.start-screen__choices` flex-wrap row. The component holds **no state**. Its
  `<h1 class="app__title" tabIndex={-1}>` is focused on mount via `useEffect`.
- `src/board/LeaveGameDialog.tsx` / `.css` — the repo's **only** dialog and the
  pattern to follow: a native `<dialog>`, shown with `showModal()` from a
  `useEffect` keyed on an `open` prop, named via `aria-labelledby`, focus set
  explicitly on open, the native `cancel` event (Escape) `preventDefault()`ed
  and routed through the same close callback so the caller's `open` state stays
  the single source of truth. Focus returning to the control that opened it is
  the browser's own doing — nothing extra is needed for that half.
- `src/art/PieceIcon.tsx` — `PieceIcon` (draws one piece's symbol in a 64×64
  `viewBox` svg, colored `var(--side-a)`/`var(--side-b)` for white/black, with
  the piece's rank character `1`–`6`/`T`/`F` pinned in the top-left corner) and
  `PieceSpriteDefs` (mounts the symbol library, hidden; every screen that draws
  pieces mounts its own copy).
- `src/rules/primary/v2/pieces.ts` — `PIECE_CATALOG`. **Rank 1 is the
  strongest.** `masterOfArms` = rank 1, `champion` = 2, `knight` = 3,
  `halberdier` = 4, `footSoldier` = 5, `militia` = 6; `tower` and `flag` have
  `rankCode: null`.
- `src/rules/primary/v2/movement.ts` —
  `legalDestinations(board, origin, layout?)` (empty-square moves; `layout`
  defaults to Battle) and `legalAttacks(board, origin, configuration)` — note
  the second takes a **required `RuleConfiguration`**, not a layout, and reads
  its `boardLayout` and its two diagonal flags off it.
- `src/rules/primary/v2/combat.ts` — `resolveCombat(board, from, to, layout?)`
  returning a `CombatOutcome` whose `result` is
  `"attackerWins" | "attackerLoses" | "mutualLoss"`.
- `src/rules/primary/v2/configuration.ts` — `configureRules(edition, overrides)`
  (the only constructor), `STANDARD_BATTLE_CONFIGURATION`. Flags and their
  values are spelled only in `ruleFlags.ts`: `DIAGONAL_ATTACKABLE` ∈
  {`movable_only` (default), `all`}, `DIAGONAL_ATTACK_PATH` ∈ {`always`
  (default), `open_path`}.
- `src/rules/primary/v2/boardLayout.ts` — `BOARD_LAYOUTS.standard_144` (Battle,
  12×12, **lake rows 6 and 7** at columns B, C, F, G, J, K),
  `standard_64` (Skirmish, 8×8, lake rows 4–5), `asymmetric_100` (Clash, 10×10,
  lake rows 5–6).
- `src/rules/primary/v2/gameState.ts` — `BoardState` is
  `Readonly<Record<string, PlacedPiece>>` keyed by `squareKey` (`"F3"`), and
  `PlacedPiece` is `{ side, pieceType }`. Absent key = empty square. A
  hand-built `BoardState` object literal is a perfectly good test fixture; see
  the `board(...)` helper at the top of `movement.test.ts`.
- `src/board/sideNames.ts` — `sideColorName(side)` → `"Red"` / `"Blue"`. White
  is Red (`--side-a`, `#a13d2b`); Black is Blue (`--side-b`, `#33526b`).
- `src/index.css` — the shared custom properties on `:root`: `--parchment`,
  `--ink`, `--side-a`, `--side-b`, `--focus-ring`.
- `src/board/FullBoard.css` — the board's own square treatment, for reference
  only: `background: var(--parchment)`, `border: 1px solid rgba(43, 33, 24, 0.2)`,
  square size `clamp(28px, 6vmin, 64px)`.
- `README.md` — a player-facing document; its "What you can do" bullets are the
  register to match.

### Out of bounds for every step

- **`src/board/Board.tsx`, `src/board/FullBoard.tsx`, `src/board/PlayBoard.tsx`
  and `src/board/grid/AccessibleGrid.tsx` must not be modified**, and no prop,
  mode or branch may be added to any of them to serve this popup. This is a
  hard constraint fixed by the owner. Their `.css` files must not be modified
  or imported by the new code either. If a step appears to need a change there,
  **stop and escalate** — it means the approach is wrong.
- **No change to `src/rules/**`.** This story is read-only with respect to how
  the game plays. The figures are checked _against_ the rule engine; the engine
  is never adjusted to suit a figure. If a figure disagrees with the engine, the
  **figure** is wrong.
- **No new dependencies.** The dialog is the platform's native `<dialog>`.
- **No new screen and no new route.** `App.tsx` is not touched at all; the
  popup's open/closed boolean lives in `StartScreen.tsx`.
- **No link out of the app** from the popup, including to the companion
  rulebook.
- The popup is reachable **only** from the start screen.
- Do not touch `src/engine/**` or `src/encoding/eng-nn-1/**`.

A cheap self-check at the end of every step:

```
git diff --stat
```

If `Board.tsx`, `FullBoard.tsx`, `PlayBoard.tsx`, `AccessibleGrid.tsx`,
`App.tsx` or anything under `src/rules/` appears, something has gone wrong.

### The check every step runs

From the repository root:

```
npm run typecheck && npm run lint && npm test && npm run format:check && npm run build
```

All five must be clean before a step is considered done.

Steps with a **manual** verification additionally need `npm run dev` (the app
serves on `http://localhost:5173`). **This container has no file watching —
Vite never picks up a change on its own, so the dev server must be stopped and
restarted before observing anything.**

---

## Decisions resolved at plan time

These resolve story.md's "Open items to resolve at plan time", in its order.
Every step below assumes them.

### Decision 1 — Two marker shapes: a ring for a move, an arrowhead for an attack

The popup carries no legend, and colour may not be the only carrier of meaning,
so the two markers differ by **shape**:

- **Move marker** — a thin `--ink` arrow from the moving piece's square to the
  reachable square, ending in an **open ring** (an unfilled circle outline)
  drawn on that square. One arrow per reachable square, as story.md's
  descriptions of pictures 1 and 2 ask ("arrows showing the eight squares it
  can reach", "four arrows"). Used in figures 1 and 2 only.
- **Attack marker** — a thicker `--ink` arrow from the attacking piece's square
  to the attacked square, ending in a **solid filled triangular arrowhead**
  whose tip reaches the **centre** of the attacked square. Used in figures 3–10.

The two are additionally, redundantly distinguishable by their context: a move
marker always lands on an empty square, an attack marker always lands on a
square holding an enemy piece.

**Pictures 3 and 4 use the same arrow as pictures 5–10** — it is the same
relationship ("this piece may attack that square"), so there is deliberately no
second, near-identical "attackable" marking that would read as a distinction
the popup never explains. story.md's related open item is settled that way.

Both arrows are drawn in `--ink` (never in a side colour), so colour carries
nothing.

Figure 1 draws eight arrows from one piece; the two-square arrows pass through
the one-square destinations' rings. Draw the rings after (on top of) the
shafts. If Step 5's Gate B finds eight overlapping arrows too cluttered to
read, the pre-approved fallback is **four arrows (one per direction, running
the full two squares) plus a ring on each of the eight destinations** —
record it as a deviation in the step's Notes if used.

### Decision 2 — The defender's square: arrow under the piece, X and dimming over it

Per square, the draw order is: **square fill → arrow → piece → removal mark.**

- The arrow is drawn **behind** the pieces. Its head therefore terminates at the
  attacked square's centre and visibly runs _under_ the defending piece, which
  is what makes it read as "the attacker arrives on that square" rather than
  "the attacker points at that square" (story.md's requirement that the arrow do
  the double duty a single static cutout otherwise cannot).
- A **removed** piece is marked two ways, not one: it is **dimmed** (drawn at
  roughly 45% opacity) **and** overlaid with a **red X** — two straight strokes
  corner to corner, in the app's existing "this loses something" red
  `rgb(154 34 34)` (already used by `LeaveGameDialog.css` and
  `ImportScreen.css`), each stroke given a `--parchment` outline/halo so it
  stays legible over `--side-a` red, over `--side-b` blue, and over the rank
  numeral in the piece's top-left corner. story.md's open question "whether the
  struck-out piece is dimmed as well as crossed" is settled: **yes** — the
  dimming is what carries the meaning for a reader who cannot pick the red out.
- The X is the last thing drawn on its square, so it sits over both the piece
  and the arrowhead.

### Decision 3 — Each figure carries a visible caption

Each figure is a `<figure>` containing the picture and a `<figcaption>` holding
**one short sentence** naming the sides by colour and stating exactly what the
picture shows. The caption is **visible to everyone**, not hidden for assistive
technology only. Reasons: the owner must be able to review this copy at a gate
(a hidden equivalent is invisible to review); the popup has no legend, so the
caption doubles as the key to the markers; and a visible caption is one piece of
text serving both a sighted and a non-sighted reader rather than two that can
drift apart. The cost — a slightly longer popup — is accepted, and is contained
by keeping every caption to one clause-plus-clause sentence.

The picture itself (the `<svg>`) is **`aria-hidden="true"`**, so the caption is
the whole of the figure's accessible text: nothing announces twice, and no
picture can present itself as a table or a grid to be navigated (story.md's
Gate D). The pictures are inert — no click handler, no focus, no animation.

The ten captions are fixed here (they are new copy, so this plan settles them;
everything else in the popup is story.md's fixed copy):

1. "Red's piece can move to any of the eight ringed squares."
2. "With a blue piece diagonally beside it, red can reach only four squares."
3. "Red can attack the blue piece two squares ahead."
4. "Red can attack the blue piece diagonally beside it."
5. "Red's rank 1 attacks blue's rank 2: the blue piece is removed."
6. "Red's rank 3 attacks blue's rank 2: the red piece is removed."
7. "Red's rank 4 attacks blue's rank 4: both are removed."
8. "Red's rank 4 attacks a blue Tower: both are removed."
9. "Red's rank 3, with a red rank 3 beside it, attacks blue's rank 2: both are
   removed."
10. "Blue's rank 2 attacks a red rank 3 that has a red rank 3 beside it: both
    are removed."

### Decision 4 — The new code lives in `src/app/rules/`

Six new files, all under `src/app/rules/`, beside `StartScreen.tsx`:

| File                                  | Kind                | What it holds                                                         |
| ------------------------------------- | ------------------- | --------------------------------------------------------------------- |
| `figures.ts`                          | pure data, no React | the ten figures, the cutout window, the piece placements and markings |
| `figures.test.ts`                     | test                | the figures-versus-engine agreement check                             |
| `rulesCopy.ts`                        | pure data, no React | the header, the six sections, the ten captions                        |
| `rulesCopy.test.ts`                   | test                | structural and vocabulary guards on the copy                          |
| `RuleFigure.tsx` / `RuleFigure.css`   | thin render         | one figure's cutout                                                   |
| `RulesDialog.tsx` / `RulesDialog.css` | thin render         | the popup shell, header, sections and layout                          |

`src/app/` rather than a folder under `src/board/` or a new top-level folder:
the popup is a start-screen feature, opens from nowhere else, and putting it
here makes the "no core board change" constraint physically obvious in the
diff — nothing in `src/board/` is even in the neighbourhood.

**What the new code may import:** `src/art/PieceIcon.tsx` (`PieceIcon`,
`PieceSpriteDefs`), anything under `src/rules/primary/v2/` (pure rule data and
logic), `src/board/sideNames.ts` (the Red/Blue words — a two-line pure module,
not a board component), and `src/appInfo.ts`. **What it must not import:** any
component or CSS file under `src/board/` other than `sideNames.ts`.

`PieceSpriteDefs` is mounted by `RulesDialog.tsx` itself, as a **sibling of the
`<dialog>` element** (both inside one fragment), so the symbol library is never
inside a `display: none` subtree and `StartScreen.tsx` needs no knowledge of it.

### Decision 5 — Share the custom properties, share nothing else

`RuleFigure.css` uses `var(--parchment)`, `var(--ink)`, `var(--side-a)` and
`var(--side-b)` from `:root` (`src/index.css`) — those are the app's shared
design tokens and reusing them is exactly right, and is what makes the cutouts
look like the real board.

It does **not** reference, extend, `@import` or copy any `.board*` /
`.full-board*` class name, and does not import `Board.css` or `FullBoard.css`.
Where it needs a value the board also uses — the faint square border
`1px solid rgba(43, 33, 24, 0.2)` — it restates that literal with a comment
saying it deliberately mirrors `FullBoard.css`'s and is free to drift.

The figure declares its **own** square size, `--figure-square:
clamp(22px, 4.5vmin, 34px)` — deliberately not the board's
`clamp(28px, 6vmin, 64px)`. A figure inside a two-column dialog must stay small
and stable; it is not a play surface.

The cutout is drawn as a plain 5×5 patch of squares with a thin `--ink` outline
around the patch, reading as a crop of a board rather than as a tiny complete
board (the real board's outer border is 2px; the cutout's is 1px). No lake, no
buffer band, no rank/file labels, no board edge treatment.

### Decision 6 — The cutout window: Battle, columns D–H × rows 1–5, centre F3

All ten figures are 5×5 windows onto the **Battle board**
(`BOARD_LAYOUTS.standard_144`, 12×12), anchored at **D1**, i.e. columns D, E,
F, G, H by rows 1, 2, 3, 4, 5. The window's centre square is **F3**.

- **No lake anywhere in the window.** Battle's lakes are on rows 6 and 7 only,
  so rows 1–5 are entirely lake-free. Steps must assert this rather than assume
  it.
- **Honest caveat, not to be "tidied away":** Battle's lake rows make it
  impossible for _any_ lake-free five-row band to also avoid the board's top and
  bottom edge rows (rows 1–5 and 8–12 are the only lake-free bands, and each
  touches an edge). Skirmish and Clash have no lake-free five-row band at all.
  The window therefore includes row 1, White's back rank. **This is harmless and
  invisible:** every square any figure marks lies strictly inside the window,
  and no figure's claim depends on a square being off-board. Step 1's test
  pins that down by asserting that all eight of the centre's one- and two-away
  orthogonal squares exist on the board and are not lakes.
- **Orientation.** The cutout is drawn in the absolute (White) frame the app
  already uses for Red's view: **row 5 at the top, row 1 at the bottom; column D
  at the left, column H at the right.** Red (= White = `--side-a`) therefore
  advances **up** the picture and Blue (= Black = `--side-b`) advances **down**,
  which is what the game's own board shows.
- **Sides.** Red is always the piece the reader is invited to identify with;
  Blue is always the enemy. In figure 10 — the only figure where the enemy is
  the attacker — Blue attacks downward, which is the direction Blue really
  advances.

A figure names its pieces by **absolute square key** on that board (`"F3"`), and
`RuleFigure.tsx` derives the window-relative row/column from the anchor. That is
what makes the engine check meaningful: the test places exactly those pieces on
an otherwise-empty Battle `BoardState` and asks the real `legalDestinations` /
`legalAttacks` / `resolveCombat` what they say.

### Decision 7 — The ten figures (verified against the engine while writing this plan)

Piece types: rank 1 = `masterOfArms`, rank 2 = `champion`, rank 3 = `knight`,
rank 4 = `halberdier`. Red = `"white"`, Blue = `"black"`.

| #   | Section                               | Pieces                                       | Marked                                               |
| --- | ------------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| 1   | Movement                              | red R3 **F3**                                | move rings on D3, E3, F1, F2, F4, F5, G3, H3 (eight) |
| 2   | Slowed movement                       | red R3 **F3**; blue R3 **E4**                | move rings on E3, F2, F4, G3 (four)                  |
| 3   | Movement for attacks                  | red R3 **F3**; blue R3 **F5**                | attack arrow F3 → F5                                 |
| 4   | Movement for attacks                  | red R3 **F3**; blue R3 **G4**                | attack arrow F3 → G4                                 |
| 5   | Combat                                | red R1 **F2**; blue R2 **F3**                | attack arrow F2 → F3; X on F3                        |
| 6   | Combat                                | red R3 **F2**; blue R2 **F3**                | attack arrow F2 → F3; X on F2                        |
| 7   | Equal-ranked pieces and Tower attacks | red R4 **F2**; blue R4 **F3**                | attack arrow F2 → F3; X on F2 **and** F3             |
| 8   | Equal-ranked pieces and Tower attacks | red R4 **F2**; blue **Tower F3**             | attack arrow F2 → F3; X on F2 **and** F3             |
| 9   | Rank-up                               | red R3 **F2**; red R3 **E2**; blue R2 **F3** | attack arrow F2 → F3; X on F2 **and** F3             |
| 10  | Rank-up                               | blue R2 **F4**; red R3 **F3**; red R3 **E2** | attack arrow F4 → F3; X on F4 **and** F3             |

Every row above was checked against the real `legalDestinations`,
`legalAttacks` and `resolveCombat` while this plan was written, under all four
combinations of the two diagonal flags. In particular:

- Figure 2's four destinations are exactly `legalDestinations`' output with the
  diagonal enemy present; figure 1's eight are exactly its output without one.
- Figures 3–10's marked attack squares are exactly `legalAttacks`' output, and
  in every one of the ten figures that output is **identical under all four
  flag combinations** — so the popup never illustrates a rule the game does not
  always have.
- Figures 5–10 resolve to `attackerWins`, `attackerLoses`, `mutualLoss`,
  `mutualLoss`, `mutualLoss`, `mutualLoss` respectively, which is exactly the
  set of struck-out pieces the table lists.

**Constraints from story.md that these placements encode, and which a later
reader must not "tidy away":**

- The diagonally attacked enemy (figure 4, G4) is a **numbered** piece, never a
  Tower or Flag — true under `DIAGONAL_ATTACKABLE=movable_only` as well as
  `all`.
- The squares flanking that diagonal (G3 and F4) are **empty** — true under
  `DIAGONAL_ATTACK_PATH=open_path` as well as `always`.
- Figures 3 and 4 stay **two separate cutouts**. Combining them would make the
  two-square attack illegal, because the diagonal enemy slows the attacker.
- Figure 8's Tower attack is **orthogonal**, never diagonal.
- Figure 9's supporting red piece sits at **E2** (beside the attacker) and
  figure 10's at **E2** (diagonally beside the defender, and _not_ adjacent to
  the blue attacker at F4). Moving either one to a square adjacent to the enemy
  attacker would hand that attacker a second legal attack and break the
  figure's "one arrow" claim — Step 1's test catches exactly that.

### Decision 8 — The popup's layout: one grid, DOM order = reading order

- The `<dialog>` is a flex column: a **non-scrolling header area** holding the
  popup's `<h2>` title, the two header lines and the single **Close** button,
  and below it a **scrolling region** (`overflow-y: auto`,
  `overscroll-behavior: contain`) holding the six sections. The dialog is
  `max-height: min(90vh, …)` and `max-width: min(64rem, 92vw)`, so it scrolls
  internally rather than being clipped, keeps its heading and its close control
  reachable at any scroll position, and does not scroll the page behind it.
- The sections region is a **CSS grid**, `repeat(2, minmax(0, 1fr))` above a
  breakpoint (~48rem of dialog width, expressed as a viewport media query) and a
  single column below it. **Not** CSS multi-column (`columns`), which would
  split a section across columns and divorce visual order from DOM order.
- **DOM order is: header, Movement, Slowed movement, Movement for attacks,
  Combat, Equal-ranked pieces and Tower attacks, Rank-up.** With a two-column
  grid filling row by row that does not by itself put the movement sections in
  the left column, so the three movement sections are placed in column 1 and the
  three combat sections in column 2 by **grid column assignment**
  (`grid-column: 1` / `grid-column: 2` on the section wrappers, cleared at the
  single-column breakpoint) — never by `order`, which would desynchronise
  visual order from reading and tab order. Left-column sections precede
  right-column sections in the DOM in every layout, which is exactly what
  story.md's in-scope item 2 requires.
- Within a section, the one or two figures sit in a flex-wrap row: side by side
  when the column is wide enough, stacked when it is not.
- Heading levels: the popup's title is an `<h2>` (the start screen's `<h1>` is
  the app title); the six section headings are `<h3>`.

### Decision 9 — Opening, closing and focus

- `StartScreen.tsx` gains exactly one piece of state: a boolean for whether the
  popup is open. `App.tsx` is untouched.
- `RulesDialog` follows `LeaveGameDialog.tsx` exactly: an `open` prop, a
  `useEffect` that calls `showModal()` / `close()`, `aria-labelledby` pointing
  at the title, and the native `cancel` event `preventDefault()`ed and routed
  through the same `onClose` callback so the caller's boolean stays the single
  source of truth.
- **Focus on open goes to the popup's `<h2>` title**, using the `tabIndex={-1}`
  heading pattern `StartScreen.tsx` and `GameResult.tsx` already use — so a
  screen reader announces what the popup _is_ before it announces the way out.
  (`LeaveGameDialog` focuses its Cancel button instead; that is right for a
  two-choice confirmation and wrong here.)
- Escape closes; focus returns to the "How to play" button, which the native
  `<dialog>` does on its own.
- There is exactly **one** Close button, in the non-scrolling header area, so
  it is reachable at any scroll position without adding a second tab stop with
  the same name.

### Decision 10 — "How to play" goes first, and nothing else gives

The four choices stay in the existing `.start-screen__choices` flex-wrap row,
with "How to play" as the **first** child, in the same visual treatment as the
other three (`start-screen__choice` with a title span and a detail span).
Button copy, fixed by the owner: title **"How to play"**, detail **"A quick
guide to how the game works"**.

On a narrow screen the four buttons stack and "Play a game" moves down by about
one button height. **Nothing gives:** the order is the owner's policy, the start
screen is a normal scrolling page (not a fixed-height surface), and three
choices below a short first button is not a fold problem worth trading the
policy for. Step 3's Gate C looks at a phone-width viewport explicitly. If it
turns out to be genuinely bad, the pre-approved remedy is a narrow-width
tightening of `.start-screen__choice`'s vertical padding via a media query
**scoped to `StartScreen.css`** — record it as a deviation in the step's Notes
if used.

---

## Step 1 — The ten figures as pure data, checked against the rule engine

Status: committed

Notes: Created `src/app/rules/figures.ts` (the cutout window, `Figure`/
`FigurePiece`/`FigureMarking`/`FigureId` types, and the ten figures from
Decision 7's table, verbatim) and `src/app/rules/figures.test.ts` (55 tests:
window sanity, placement sanity, the two movement figures against
`legalDestinations`, the eight attack figures against `legalAttacks` under all
four diagonal-flag combinations, the six combat figures against
`resolveCombat`, and the story's standing constraints on figures 4 and 8). All
five repository checks (typecheck, lint, test, format:check, build) pass; no
file outside `src/app/rules/` was touched. No deviation from the plan.

Create `src/app/rules/figures.ts` — **plain TypeScript, no React, no JSX, no
CSS** — declaring:

- The **cutout window**: the board layout it is cut from
  (`BOARD_LAYOUTS.standard_144`), the anchor square (`D1`), and its width and
  height (5 × 5). See Decision 6.
- A **figure** type and the **ten figures** of Decision 7's table, each with: a
  stable id, the pieces it places (square key, side, piece type), and its
  marking — either a set of squares marked as **move** destinations (figures 1
  and 2) or an **attack** from one square to another (figures 3–10), plus, for
  figures 5–10, the set of squares whose pieces the fight **removes**.
- The exported list of all ten, in the order they appear in the popup.

Keep the shape as small as the renderer and the test both need; do not invent
fields nobody reads. Document in the module header that this module exists
precisely so the figures can be unit-tested in the `node`-only Vitest
environment, and that a figure that disagrees with the engine is a **wrong
figure**, never a reason to touch `src/rules/`.

**Nothing else in this step.** No component, no CSS, nothing imports this
module yet.

Depends on: nothing.

Verification (**automated**): add `src/app/rules/figures.test.ts` asserting all
of the following, then run the five repository checks.

- **Window sanity.** Every one of the window's 25 squares is on the Battle board
  and is **not** a lake. From the window's centre (F3), all eight one- and
  two-away orthogonal squares exist on the board and are not lakes — i.e. no
  figure's claim is truncated by the board edge (Decision 6's caveat).
- **Placement sanity.** Every piece of every figure sits on a square inside the
  window, no two pieces of a figure share a square, and no figure places a piece
  on a lake.
- **Movement figures.** For figures 1 and 2, the marked square set equals
  `legalDestinations(board, origin, BOARD_LAYOUTS.standard_144)` exactly
  (order-independent), where `board` is the figure's pieces on an otherwise
  empty `BoardState`. Assert the counts too: **eight** for figure 1, **four**
  for figure 2.
- **Attack figures.** For figures 3–10, `legalAttacks(board, attackerSquare,
configuration)` equals exactly the single marked attack target — **for all
  four combinations** of `DIAGONAL_ATTACKABLE` (`movable_only`, `all`) ×
  `DIAGONAL_ATTACK_PATH` (`always`, `open_path`), built with
  `configureRules(BATTLE_EDITION, { … })`. One attacker, one target, no second
  legal attack lurking in any figure, under any flag setting.
- **Combat figures.** For figures 5–10, derive the removed-piece set from
  `resolveCombat(board, from, to, BOARD_LAYOUTS.standard_144)` —
  `attackerWins` → the defender's square, `attackerLoses` → the attacker's
  square, `mutualLoss` → both — and assert it equals the figure's own declared
  removal set. Assert the counts story.md fixes: **one** removal in figures 5
  and 6, **two** in 7, 8, 9 and 10.
- **The story's standing constraints.** Figure 4's target is a piece with a
  non-null `rankCode` (never Tower or Flag) and both squares flanking its
  diagonal are empty; figure 8's attack is orthogonal (attacker and target share
  a column or a row) and its target is a Tower; figures 3 and 4 are separate
  figures with different boards.

---

## Step 2 — The popup's copy as pure data

Status: committed

Notes: Created `src/app/rules/rulesCopy.ts` (the header, the six sections keyed
by `RulesSectionId` with column/heading/body/figureIds, and the ten captions
keyed by `figures.ts`'s `FigureId`, all transcribed character-for-character
from story.md) and `src/app/rules/rulesCopy.test.ts` (structure, figure
coverage, and vocabulary guards). Deviation: the "capitalises Tower/Flag"
guard is scoped to the six sections' headings/bodies and the ten captions,
excluding the header — the header's second line ("Capture the opponent's
flag before they capture yours") is fixed copy transcribed verbatim from
story.md and deliberately keeps lower-case "flag" (an idiom, not a naming of
the piece; story.md's correction 2 capitalises Tower/Flag only in the
equal-rank section and its heading), so a blanket check over the header would
fail against the copy of record rather than catch a real regression. All five
repository checks (typecheck, lint, test, format:check, build) pass; no file
outside `src/app/rules/` was touched.

Create `src/app/rules/rulesCopy.ts` — **plain TypeScript, no React** — holding
the popup's entire text, transcribed **exactly** from story.md's "The popup's
content":

- The header: the title `"Capture the Flag: Rules"`, and the two lines
  `"Capture the opponent's flag before they capture yours"` and
  `"Place your pieces in phase one; battle your opponent in phase two."`
- The six sections, each with an id, a column (`left` / `right`), a heading and
  a body sentence, in this order: **Movement**, **Slowed movement**, **Movement
  for attacks** (left column); **Combat**, **Equal-ranked pieces and Tower
  attacks**, **Rank-up** (right column). Each section also names, in order, the
  ids of the figures that belong to it (Decision 7's table).
- The ten figure **captions** of Decision 3, keyed by the figure ids Step 1
  declared.

Copy the six body sentences character for character from story.md — they are
fixed copy, already incorporating the owner's amendments and the four listed
corrections. Do not re-word, re-punctuate or "fix" anything.

Also create the button's copy here if it helps keep the story's text in one
place, or leave it inline in `StartScreen.tsx` — either is fine, but the button
text is fixed: **"How to play"** / **"A quick guide to how the game works"**.

**Nothing else in this step.** No component, no CSS; nothing imports this
module yet.

Depends on: Step 1 (the figure ids the captions and sections are keyed by).

Verification (**automated**): add `src/app/rules/rulesCopy.test.ts` asserting,
then run the five repository checks:

- There are exactly **six** sections, in the order above, three in each column,
  and their headings are exactly the six strings above (which is the guard
  against a silent edit to fixed copy).
- Every figure id declared in `figures.ts` appears in exactly one section, every
  section's figure list is non-empty, the sections between them name all ten
  figures with no duplicates and none left over, and every figure id has exactly
  one caption.
- **Vocabulary guards** over the whole body of copy (header lines, section
  headings, section sentences and captions): the word `"ply"` never appears; the
  word `"orthogonal"` never appears (the popup says "cardinal directions");
  wherever the words "tower" or "flag" appear they are capitalised as **Tower**
  and **Flag**; and no string contains a URL (`http`), since the popup carries
  no outbound link.

---

## Step 3 — The "How to play" button and the popup shell, text only

Status: committed

Notes: Added the "How to play" button as the first child of
`.start-screen__choices` in `StartScreen.tsx`, with one new `useState`
boolean (`rulesOpen`) and a rendered `<RulesDialog>`; `App.tsx` untouched.
Created `src/app/rules/RulesDialog.tsx` (native `<dialog>`, `showModal()`
pattern copied from `LeaveGameDialog.tsx`, `aria-labelledby`, Escape routed
through `onClose`, focus moved to the `tabIndex={-1}` `<h2>` title on open,
one Close button in a non-scrolling header, `PieceSpriteDefs` mounted as a
fragment sibling) and `RulesDialog.css` (flex-column dialog with a
non-scrolling header and an internally scrolling sections grid, one column
by default and two above a 48rem viewport breakpoint, left/right sections
pinned via `[data-rules-column]` + `grid-column`, never `order`). Each
section renders its heading and body sentence from `rulesCopy.ts` verbatim;
each figure slot is a dashed, `aria-hidden` placeholder box (real
`RuleFigure`s land in Step 4). All five repository checks (typecheck, lint,
test, format:check, build) pass; `git diff --stat` touches only
`src/app/StartScreen.tsx` (modified) and the two new `src/app/rules/`
files — no forbidden file. No deviation from the plan; Decision 10's
pre-approved padding remedy was not applied, since this step's manual gate
(Gates A/C and Decision 10's check) is the owner's to run and judge.

**Post-manual-gate fixes (two defects found at the owner's manual gate,
fixed in the same files, no other step touched):**

- **Defect 1 — popup content visible while closed.** Cause confirmed:
  `.rules-dialog { display: flex; … }` in `RulesDialog.css` was
  unconditional, and its specificity (one class) beats the user-agent rule
  `dialog:not([open]) { display: none }` (one element + one attribute
  selector inside `:not()`), so the dialog rendered as a visible flex box on
  the page even while closed, overriding the native `<dialog>`'s own
  `display: none`. Fixed by moving `display: flex` out into a separate
  `.rules-dialog[open] { display: flex; }` rule, so the UA's `display: none`
  governs while the `open` attribute is absent and this rule only takes over
  once `showModal()`/`close()` have set it — the same effect
  `LeaveGameDialog.css` gets "for free" by never setting `display` at all,
  which the popup can't do here because it needs `flex-direction: column`
  while open.
- **Defect 2 — right column starting partway down.** Cause confirmed: each
  `<section>` was pinned individually with `grid-column: 1` / `grid-column:
2` (via `[data-rules-column]`) while row placement stayed automatic, so
  with six `<section>` items in one grid the three `grid-column: 1` items
  filled rows 1–3 before the first `grid-column: 2` item was placed, landing
  it (and the rest of the right column) at row 3 or later instead of row 1.
  Fixed using the plan's pre-approved wrapper alternative: `RulesDialog.tsx`
  now groups sections into two DOM wrapper elements
  (`<div className="rules-dialog__column">`), one per `rulesCopy.ts` column,
  built by filtering `RULES_SECTIONS` on its `column` field (`sectionsInColumn`,
  driven entirely by that field — no hardcoded section count). With exactly
  two wrapper elements as the grid's direct children, the grid's own
  row-by-row auto-placement puts the first wrapper in column 1 and the
  second in column 2, both starting at row 1, with no explicit `grid-column`
  or `grid-row` needed and no use of `order`. DOM order is unchanged (header,
  then the left wrapper's three sections, then the right wrapper's three
  sections), so reading/tab order and the single-column collapse are
  unaffected; each wrapper is a `flex-direction: column` list, and the outer
  `.rules-dialog__sections` grid still collapses to one column below the
  48rem breakpoint, stacking the left wrapper's three sections above the
  right wrapper's three, in the same order. Internal scrolling of the
  sections region (`overflow-y: auto` on `.rules-dialog__sections`) was
  unaffected by either fix and was re-confirmed by inspection of the
  unchanged CSS property.
- No other change. All five repository checks re-run clean after both
  fixes: typecheck, lint, `test` (942 tests), `format:check` (after a
  `prettier --write` on `RulesDialog.tsx`), and `build`. `git diff --stat`
  / `git status --porcelain` still show only `StartScreen.tsx` (modified)
  and the two new `src/app/rules/` files — no forbidden file.

Two things, which together are the first thing a player can actually see:

1. **`src/app/StartScreen.tsx`** — add the "How to play" button as the **first**
   child of `.start-screen__choices`, in the same `start-screen__choice`
   treatment as the other three (a bold `…__choice-title` span reading "How to
   play" and a `…__choice-detail` span reading "A quick guide to how the game
   works"). The component gains exactly one `useState` boolean — whether the
   popup is open — and renders `<RulesDialog>` with it. Nothing else on the
   start screen changes; `App.tsx` is not touched.
2. **`src/app/rules/RulesDialog.tsx` + `RulesDialog.css`** — the popup, per
   Decisions 8 and 9: a native `<dialog>` shown with `showModal()` from a
   `useEffect` keyed on the `open` prop, following `LeaveGameDialog.tsx`'s
   pattern for opening, closing, `aria-labelledby` and the `cancel`-event
   handling; focus moved on open to the `tabIndex={-1}` `<h2>` title; a single
   Close button in a non-scrolling header area; the six sections rendered from
   `rulesCopy.ts` into the two-column grid; internal scrolling.

**In this step the figures are not drawn.** Render each section's heading and
sentence only; leave a clearly marked placeholder where each figure will go
(e.g. an empty, `aria-hidden` box of roughly a figure's footprint), so the
column layout can be judged with realistic content. Steps 4 and 5 replace the
placeholders.

Mount `PieceSpriteDefs` now, as a sibling of the `<dialog>` inside
`RulesDialog`'s returned fragment (Decision 4), so Step 4 has nothing to wire.

Why it comes here: it is the first step with anything visible, it gives Steps 4
and 5 a place to render into, and the layout and dialog behaviour are far
easier to judge before the pictures crowd them.

Depends on: Step 2 (the copy) — and, through it, Step 1.

Verification (**manual**). Restart the dev server (`npm run dev`; this container
has no file watching) and open `http://localhost:5173`. Then run the five
repository checks.

- **Gate A (first half).** "How to play" is the **first** of the four choices on
  the start screen and looks like the other three. Clicking it opens the popup.
  The title reads "Capture the Flag: Rules", followed by **both** header lines.
  All six section headings and their sentences are present and read **word for
  word** as story.md's "The popup's content" has them — check each one against
  the story with the story open. Closing the popup returns to the start screen
  exactly as it was, and reopening works.
- **Gate C (first pass).** At a comfortable desktop width the header spans the
  full popup and the two columns sit side by side, with Movement / Slowed
  movement / Movement for attacks on the **left** and Combat / Equal-ranked
  pieces and Tower attacks / Rank-up on the **right**. Narrowing the window
  collapses them to one column with all three movement sections still read
  before all three combat sections. On a short viewport and at phone width, the
  popup scrolls **internally** — its title and Close button stay put and stay
  reachable — and the start screen behind it does not scroll.
- **Decision 10's check.** At phone width, confirm the other three choices are
  still reachable by scrolling the start screen and that nothing is clipped. If
  this reads badly, apply Decision 10's pre-approved padding remedy and record
  it in Notes.
- `git diff --stat` shows no forbidden file (see "Out of bounds").

---

## Step 4 — The board cutout: squares and pieces

Status: pending

Create `src/app/rules/RuleFigure.tsx` and `RuleFigure.css`: a thin component
that takes one figure from `figures.ts` and draws its 5×5 cutout — **squares and
pieces only, no markers yet**.

- The cutout is a 5 × 5 arrangement of `--figure-square`-sized squares with
  `var(--parchment)` fill and the faint square border of Decision 5, and a 1px
  `var(--ink)` outline around the patch. Rows run **top to bottom from row 5 to
  row 1**, columns **left to right from D to H** (Decision 6).
- Each piece is drawn with `PieceIcon` (`src/art/PieceIcon.tsx`) at its square,
  passing the figure's own side and piece type — so the artwork, the side colour
  and the corner rank numeral are the real board's, unmodified.
- The whole picture is `aria-hidden="true"`, has no click handler, is not
  focusable and animates nothing (story.md: illustrations, not a live board).
- The component wraps the picture and its caption in a `<figure>` /
  `<figcaption>` (Decision 3), taking the caption text from `rulesCopy.ts`.
- **Nothing in `src/board/` is imported, referenced or changed** (Decision 4 and
  5, and the hard constraint in "Out of bounds"). The board's class names are
  not reused; the custom properties are.

Replace Step 3's placeholders in `RulesDialog.tsx` with real `RuleFigure`s,
driven by each section's figure-id list.

Note for this step's gate: the captions describe markers that do not exist
yet — that is expected here and is fixed in Step 5.

Why it comes here: geometry, scale and the piece artwork are one thing to get
right and to look at; the marker vocabulary (Step 5) is another, and is where
this story's hardest visual questions live. Splitting them keeps each gate to
one judgement.

Depends on: Step 3 (somewhere to render), Step 1 (the figure data), Step 2 (the
captions).

Verification (**manual**). Restart the dev server and open the popup. Then run
the five repository checks.

- All **ten** cutouts appear, in the right sections and the right order:
  Movement 1; Slowed movement 1; Movement for attacks 2; Combat 2; Equal-ranked
  pieces and Tower attacks 2; Rank-up 2.
- Each cutout shows exactly the pieces Decision 7's table lists, on the right
  squares, with the right side colours (**red = the piece the reader identifies
  with, blue = the enemy, in all ten**) and the right corner numerals — R1 in
  figure 5, a Tower in figure 8, and so on. Red always advances **up** the
  picture; the blue attacker in figure 10 attacks **down**.
- The cutouts read as pieces of the real board — same artwork, same parchment,
  same square grid — at a size that sits comfortably in a column without
  dominating it. No lake, no board edge treatment, no coordinates.
- Nothing in a cutout can be clicked, focused or arrowed into: press Tab
  repeatedly through the open popup and confirm focus never lands inside a
  picture.
- Each figure has its caption below it.
- `git diff --stat` shows no forbidden file — in particular `FullBoard.tsx`,
  `Board.tsx`, `PlayBoard.tsx` and `AccessibleGrid.tsx` are untouched.

---

## Step 5 — The markers: move rings, attack arrows, removals

Status: pending

Add the marker vocabulary to `RuleFigure.tsx` / `RuleFigure.css`, per Decisions
1 and 2:

- **Move marker** — a thin `--ink` arrow from the moving piece's square to each
  marked destination, ending in an **open ring** on that square. Figures 1 and 2.
- **Attack marker** — a thicker `--ink` arrow from the attacker's square whose
  **solid triangular head reaches the centre** of the attacked square. Figures
  3–10. The same marking in figures 3 and 4 as in 5–10, deliberately.
- **Removal** — the removed piece is drawn **dimmed** and overlaid with a **red
  X** with a parchment halo. Figures 5–10.
- Draw order per square: square fill → arrow → piece → X. The arrows run
  **behind** the pieces; the X is on top of everything.

All marker geometry is derived from the figure's own data (which squares, which
direction) — no per-figure hand-tuned coordinates, so a figure that changes does
not silently keep a stale arrow.

Depends on: Step 4 (the cutout to draw on) and Step 1 (which squares are marked).

Verification (**manual**). Restart the dev server and open the popup. Then run
the five repository checks.

- **Gate B.** With the six sentences and the rules in view, read each section:
  - Figure 1 shows **eight** reachable squares, figure 2 **four**.
  - Figures 3 and 4 each mark the enemy piece as attackable, with the same
    marking figures 5–10 use — no second, near-identical marking that reads as
    an unexplained distinction.
  - Figures 5–10 each run an arrow from the attacker **onto** the defender's
    square, and the arrow reads as the attacker **arriving on** that square
    rather than merely pointing at it.
  - Exactly the right pieces are struck out: **one** in figures 5 and 6, **both**
    in 7, 8, 9 and 10.
  - Nothing in any picture contradicts the sentence above it, and every caption
    says what its picture shows.
- **Legibility.** The red X is legible over a red piece, over a blue piece, over
  the corner rank numeral, and where it meets the arrowhead. The removed piece
  is visibly dimmed as well as crossed, so the removal survives being read
  without colour. Squint-test or use a greyscale filter: move markers and attack
  markers are still tellable apart by shape alone.
- **Gate C (second pass).** With the real pictures in, re-check the layout at a
  comfortable desktop width, at a narrow width (single column, movement before
  combat), on a short viewport and at phone width — internal scrolling, nothing
  clipped, the page behind still not scrolling.
- **Gate A (second half).** All ten pictures are present and the popup as a
  whole reads as story.md describes it.
- `git diff --stat` shows no forbidden file.

---

## Step 6 — Keyboard and screen reader

Status: pending

Work the popup over from the keyboard and with a screen reader, and fix what
that finds. Expected work in this step (do each, and adjust only
`src/app/rules/*` and `src/app/StartScreen*`):

- Confirm the focus contract of Decision 9 end to end and correct it if it is
  not exactly right: Tab reaches "How to play" from the start screen; activating
  it opens the popup and moves focus to the popup's `<h2>`; Tab cannot escape
  behind the dialog; Escape closes it; focus returns to the "How to play"
  button.
- Confirm the popup's **scrolling region is keyboard-scrollable**. A scrollable
  container that holds no focusable element is not reachable by keyboard in some
  browsers; if the sections region turns out not to scroll from the keyboard,
  give it `tabIndex={0}` with an accessible name, which is the standard remedy.
- Confirm every picture is `aria-hidden` and that **no** picture presents itself
  as a table, a grid or a list to be navigated; the caption is the whole of a
  figure's accessible text.
- Confirm the popup announces itself (its accessible name comes from the `<h2>`
  via `aria-labelledby`), that each of the six headings and sentences is read,
  and that each caption conveys the same fact as its picture.
- Confirm the visible focus indicator is clearly visible on the "How to play"
  button and on the Close button.

Why it comes here: the popup's content and layout are settled, so this pass is
about interaction and semantics rather than chasing a moving target.

Depends on: Step 5 (the finished popup).

Verification (**manual**) — this is story.md's **Gate D**. With the mouse put
away, walk the whole flow described above from the keyboard alone. Then repeat
with a screen reader (Windows Narrator is this repo's convention — see
`CONTRIBUTING.md`), confirming each bullet above. Record in Notes what was
tested with and anything that had to be adjusted. Then run the five repository
checks.

---

## Step 7 — Nothing else moved, and the README

Status: pending

Two things:

1. **Regression sweep.** Confirm the rest of the app is untouched by this story.
2. **`README.md`.** Update it to mention that the app now explains the basics
   itself — one short addition in the same plain, player-facing register as the
   surrounding text (the intro paragraph mentioning the start screen, and/or a
   "What you can do" bullet). Keep the existing outbound link to the companion
   rulebook exactly as it is: the README is where that link lives, and the popup
   deliberately has none. Running `/update-readme` (which reviews the branch
   diff) is the intended way to do this; review its output against this step's
   requirements before accepting it.

Depends on: Step 6 (the story's behaviour is final).

Verification (**manual**) — this is story.md's **Gate E**, plus the README
check the plan guide requires. Restart the dev server, then:

- Play a **Skirmish** game, a **Clash** game and a **Battle** game far enough to
  confirm each still sets up (both placements), plays (a move, an attack) and
  can be ended as before, with the popup nowhere reachable from inside a game.
- Open the **review** screen with one of the sample records in `doc/samples/`
  and confirm it is unchanged.
- From a game in progress, use "Back to start" and confirm the existing "leave
  this game?" prompt still behaves as before, and that the start screen it
  returns to shows all four choices.
- Read the updated `README.md` end to end and confirm it is accurate, in
  register, and still carries the companion-rulebook link.
- Run the five repository checks a final time, and confirm `git diff --stat`
  over the whole branch touches **no** file under `src/rules/`, and none of
  `Board.tsx`, `FullBoard.tsx`, `PlayBoard.tsx`, `AccessibleGrid.tsx` or
  `App.tsx`.
