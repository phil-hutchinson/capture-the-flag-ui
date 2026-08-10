# Implementation Plan — Story 00000032: How-to-play rules page

This plan adds a **"How to play"** button as the first choice on the start
screen, and a **rules page** behind it: a new member of `App.tsx`'s screen
union carrying a full-width header, six short sections in two columns, and ten
small illustrations drawn with the game's own piece artwork — four of them on
5×5 cutouts of a real board, six of them as pieces on their own with a
deliberate gap between attacker and defender.

Read `story.md` in this folder **in full** before starting any step. Its
**Amendments**, **Policy (fixed by the owner)**, **The page's content** (the
copy is fixed), **In scope / Out of scope**, **Design decisions & constraints**
and **Manual-verification gates** are settled and are not re-litigated here.
This plan resolves story.md's **"Open items to resolve at plan time"** — the
resolutions are in "Decisions resolved at plan time" below, and every step is
written assuming them.

Every step is written for an implementer who has read `story.md`, this plan,
and their own step, and nothing else.

### Read this before Steps 1–3 confuse you

This plan was **revised mid-flight**, after Steps 1, 2 and 3 were implemented
and committed, because the owner changed direction (story.md's **Amendments**
section records every change):

1. The rules surface is a **page**, not a modal popup.
2. ~~The six combat figures are drawn without a board.~~ Reversed by amendment
   3 after Step 6's first attempt: **all ten figures are drawn on a board
   cutout.** Decision 11 is marked superseded and Step 6 has been rewritten;
   Step 5's `presentation` field is removed as part of that rewrite.
3. The removal mark is a **black X, not a red one**, kept clear of each piece's
   rank numeral (amendment 4).

Steps 1–3 below are left **exactly as they were written and executed**,
including their Status and Notes — they are the record of what was actually
done, not instructions to follow again. They therefore talk about "the popup"
and about a `<dialog>`, and Step 3's product (`RulesDialog.tsx` /
`RulesDialog.css`) is a modal. **Step 4 converts that modal into a page**;
everything from Step 4 onward is written for the amended direction. Where the
older text and the newer text disagree, **the newer text wins** — the
Decisions section below has likewise been rewritten for the page, and is
current.

The words "popup" and "dialog" appear only in Steps 1–3's frozen text. Nothing
implemented from Step 4 onward is a popup.

---

## Grounding facts (read once — applies to every step)

### The rules are not restated here

`doc/ruleset/rules.md` in the companion
[capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
repository is the single source of truth. The page's copy is a deliberate
**simplification** of §4.2 (movement) and §4.3 (attacks and combat), written
for players. The copy in story.md is the copy; no step invents, extends or
"corrects" a sentence of it.

Player-facing vocabulary applies in full: the page says **"move"**, never
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
  figures, and the page's copy — out into React-free `.ts` modules, leaving
  the `.tsx` layer as thin rendering.

### Where the relevant code is today

- `src/App.tsx` — the app shell. A `Screen` discriminated union held in
  `useState` (`{ kind: "start" }`, `{ kind: "play" }`, `{ kind: "import" }`,
  `{ kind: "review", … }`), a chain of `if (screen.kind === …)` returns
  mounting one screen component each, and an app-wide keyboard-modality
  `useEffect`. **No router and no URL routing** — both permanently out of
  scope. `StartScreen` is mounted with callback props (`onPlayAGame`,
  `onReviewAGame`) that do nothing but `setScreen({ … })`.
- `src/app/StartScreen.tsx` / `StartScreen.css` — the start screen. Four
  choice buttons today (`How to play` — added by Step 3, `Play a game`,
  `Play against the computer` — shown but `aria-disabled`, `Review a game`),
  each a `<button class="start-screen__choice">` with a bold
  `…__choice-title` span and a `…__choice-detail` span, inside a
  `.start-screen__choices` flex-wrap row. Its
  `<h1 class="app__title" tabIndex={-1}>` is focused on mount via `useEffect`.
  Step 3 gave it one piece of state — a `rulesOpen` boolean — which Step 4
  removes again.
- `src/review/ImportScreen.tsx` / `ImportScreen.css` and
  `src/review/ReviewScreen.tsx` / `ReviewScreen.css` — **the precedent this
  story's page follows**. Each is a `<main className="app">` containing an
  `<h1 className="app__title" tabIndex={-1}>` focused on mount, and a plain
  `<button>` calling an `onBack` prop that the shell turns into
  `setScreen({ kind: "start" })` — **no confirmation prompt**, because nothing
  is lost by leaving. `ReviewScreen`'s button reads **"Back to start"** and
  sits just below the heading; `ImportScreen`'s reads "Back" and sits at the
  bottom. Both use the same button chrome (`font: inherit`,
  `padding: 0.3rem 0.7rem`, `1px solid var(--ink)`, `border-radius: 4px`,
  `background: var(--parchment)`, `color: var(--ink)`, `cursor: pointer`),
  restated in each screen's own CSS rather than shared.
- `src/app/rules/` — this story's own folder, as Steps 1–3 left it:
  `figures.ts`, `figures.test.ts`, `rulesCopy.ts`, `rulesCopy.test.ts`,
  `RulesDialog.tsx`, `RulesDialog.css`. Step 4 renames the last two.
- `src/art/PieceIcon.tsx` — `PieceIcon` (draws one piece's symbol in a 64×64
  `viewBox` svg, colored `var(--side-a)`/`var(--side-b)` for white/black, with
  the piece's rank character `1`–`6`/`T`/`F` pinned in the top-left corner) and
  `PieceSpriteDefs` (mounts the symbol library, hidden; every screen that draws
  pieces mounts its own copy — `ReviewScreen.tsx` does it as the first child of
  its `<main>`).
- `src/rules/primary/v2/pieces.ts` — `PIECE_CATALOG`. **Rank 1 is the
  strongest.** `masterOfArms` = rank 1, `champion` = 2, `knight` = 3,
  `halberdier` = 4, `footSoldier` = 5, `militia` = 6; `tower` and `flag` have
  `rankCode: null`.
- `src/rules/primary/v2/movement.ts` —
  `legalDestinations(board, origin, layout?)` (empty-square moves; `layout`
  defaults to Battle) and `legalAttacks(board, origin, configuration)` — note
  the second takes a **required `RuleConfiguration`**, not a layout, and reads
  its `boardLayout` and its two diagonal flags off it. Both take `Square`
  objects (`{ column, row }`), not square-key strings.
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
  the `boardFromFigure` helper in `figures.test.ts`.
- `src/board/sideNames.ts` — `sideColorName(side)` → `"Red"` / `"Blue"`. White
  is Red (`--side-a`, `#a13d2b`); Black is Blue (`--side-b`, `#33526b`).
- `src/index.css` — the shared custom properties on `:root`: `--parchment`,
  `--ink`, `--side-a`, `--side-b`, `--focus-ring`; and `body`'s background,
  which is `var(--parchment)`. **The page's background is therefore the same
  parchment the board's squares are painted in**, so a cutout sits on the page
  without a seam.
- `src/App.css` — `.app` (the shared screen shell: a centred flex column,
  `gap: 1.5rem`, `padding: 2rem 1rem`) and `.app__title` with its
  keyboard-modality-gated focus ring. Every screen in the app uses both.
- `src/board/FullBoard.css` — the board's own square treatment, for reference
  only: `background: var(--parchment)`, `border: 1px solid rgba(43, 33, 24, 0.2)`,
  square size `clamp(28px, 6vmin, 64px)`.
- `README.md` — a player-facing document; its "What you can do" bullets are the
  register to match.

### Out of bounds for every step

- **`src/board/Board.tsx`, `src/board/FullBoard.tsx`, `src/board/PlayBoard.tsx`
  and `src/board/grid/AccessibleGrid.tsx` must not be modified**, and no prop,
  mode or branch may be added to any of them to serve this page. This is a
  hard constraint fixed by the owner. Their `.css` files must not be modified
  or imported by the new code either. If a step appears to need a change there,
  **stop and escalate** — it means the approach is wrong.
- **No change to `src/rules/**`.** This story is read-only with respect to how
  the game plays. The figures are checked _against_ the rule engine; the engine
  is never adjusted to suit a figure. If a figure disagrees with the engine, the
  **figure** is wrong.
- **No new dependencies.**
- **`App.tsx` _is_ touched — but only to add the new screen.** (This corrects
  the original plan, which forbade touching `App.tsx` at all; story.md's
  Amendment 1 changed that.) The permitted change is: one more member in the
  `Screen` union, one more `if (screen.kind === …)` branch mounting the new
  screen, and one more callback prop passed to `StartScreen`. Nothing else in
  `App.tsx` changes — not the existing screens, not their props, not the
  keyboard-modality effect, not `lastPlayedConfiguration`.
- **Still no router and no URL.** The page is reached by the same
  `setScreen({ … })` mechanism every other screen uses.
- **No link out of the app** from the page, including to the companion
  rulebook.
- The page is reachable **only** from the start screen.
- Do not touch `src/engine/**` or `src/encoding/eng-nn-1/**`.

A cheap self-check at the end of every step:

```
git diff --stat
```

From Step 4 onward the expected footprint is `src/App.tsx`,
`src/app/StartScreen.tsx`, `src/app/rules/**` and (in the last step)
`README.md` — nothing else. If `Board.tsx`, `FullBoard.tsx`, `PlayBoard.tsx`,
`AccessibleGrid.tsx` or anything under `src/rules/` appears, something has gone
wrong.

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

These resolve story.md's "Open items to resolve at plan time". Decisions 4, 8
and 9 were **rewritten** when the story was amended (page, not popup);
Decision 11 is **superseded** by amendment 3 (the board is back on all ten
figures) and Decisions 2 and 12 were rewritten with it; Decision 2 also carries
amendment 4 (a black X, clear of the rank numeral). Every step from 4 onward
assumes them as they now stand.

### Decision 1 — Two marker shapes: a ring for a move, an arrowhead for an attack

The page carries no legend, and colour may not be the only carrier of meaning,
so the two markers differ by **shape**:

- **Move marker** — a thin `--ink` arrow from the moving piece's square to the
  reachable square, ending in an **open ring** (an unfilled circle outline)
  drawn on that square. One arrow per reachable square, as story.md's
  descriptions of pictures 1 and 2 ask ("arrows showing the eight squares it
  can reach", "four arrows"). Used in figures 1 and 2 only.
- **Attack marker** — a thicker `--ink` arrow from the attacking piece to the
  attacked piece, ending in a **solid filled triangular arrowhead** whose tip
  ending in a **solid filled triangular arrowhead**. Used in figures 3–10.

  **Its size and extent are fixed by story.md's amendment 7**, which the owner
  made after seeing Step 7's first attempt — the arrow was too long and too thin
  to read at a glance:

  - **In the six combat figures**, the arrow is **contained entirely within the
    empty square between the two pieces** (the square amendment 5 left clear for
    exactly this) and drawn about **three times the width** of the first
    attempt's. It does not reach, touch or overlap either piece.
  - **In pictures 3 and 4**, the arrow keeps the **same centre point** it had
    but is **two-thirds as long** and **twice as wide** — a stub between the two
    pieces rather than a line joining them.
  - **The width is what does the work.** A short arrow reads as directional only
    if it is fat enough for the head to be obviously a head; do not compensate
    for the shortening by making it thinner.

The two are additionally, redundantly distinguishable by their context: a move
marker always lands on an empty square, an attack marker always lands on an
enemy piece.

**Pictures 3 and 4 use the same arrow as pictures 5–10** — it is the same
relationship ("this piece may attack that square"), so there is deliberately no
second, near-identical "attackable" marking that would read as a distinction
the page never explains. story.md's related open item is settled that way. The
arrow is the same shape and weight whether or not the figure draws a board;
only its length differs.

Both arrows are drawn in `--ink` (never in a side colour), so colour carries
nothing.

Figure 1 draws eight arrows from one piece; the two-square arrows pass through
the one-square destinations' rings. Draw the rings after (on top of) the
shafts. If Step 7's Gate B finds eight overlapping arrows too cluttered to
read, the pre-approved fallback is **four arrows (one per direction, running
the full two squares) plus a ring on each of the eight destinations** —
record it as a deviation in the step's Notes if used.

### Decision 2 — Draw order: arrow under the pieces, X and dimming over them

A figure is drawn in four layers, back to front: **board squares → arrows →
pieces → removal marks.**

- The arrow is drawn **behind** the pieces. Since amendment 7 shortened it to
  sit clear of both pieces this rarely matters visually, but the layering stays:
  a marker must never paint over a piece, and nothing should have to be
  re-reasoned if an arrow is ever lengthened again.
- **The arrow stops short of the defending piece** (amendment 7). An earlier
  draft had its head terminate on the defender, so that the overlap implied "the
  attacker moves to the destination square"; the owner preferred a short, wide
  arrow in the clear square, and that implication now rests on the section's
  sentence instead. Do not restore the overlap.
- A **removed** piece is marked two ways, not one: it is **dimmed** (drawn at
  roughly 45% opacity) **and** overlaid with a **black X** — two straight
  strokes corner to corner, in the app's existing ink (`--ink`), each stroke
  given a `--parchment` outline/halo so it stays legible over `--side-a` red and
  over `--side-b` blue. story.md's open question "whether the struck-out piece
  is dimmed as well as crossed" is settled: **yes** — the dimming is what
  carries the meaning for a reader who cannot pick the ink out.
- **The X is black, not red** (story.md amendment 4, the owner's decision after
  Step 6). Red was the original choice; it reads poorly over `--side-a`, which
  is red, and half of all removal marks land on a red piece. Do not reintroduce
  `rgb(154 34 34)` here, even though that red is the app's established "this
  loses something" colour elsewhere (`LeaveGameDialog.css`, `ImportScreen.css`)
  — over a red piece it is close to invisible, which is the whole reason it was
  dropped.
- **The X must not cover the piece's rank numeral** (same amendment). `PieceIcon`
  draws that numeral in the piece's **top-left** corner (`x=15, y=17` in a 64×64
  viewBox — note the owner described it as top-right; the code is what to build
  against). The numeral is what tells a reader which piece is which, so the mark
  saying "this one is gone" must not obscure the mark saying which one it was.
  Sit the X low on the piece: bound its strokes to roughly the lower two-thirds
  of the cell rather than running the full corner-to-corner diagonal, and check
  it against figure 8, where the Tower's `T` sits in the same corner.
- The X is the last thing drawn on its piece, so it sits over both the piece
  and the arrowhead.

### Decision 3 — Each figure carries a visible caption

Each figure is a `<figure>` containing the picture and a `<figcaption>` holding
**one short sentence** naming the sides by colour and stating exactly what the
picture shows. The caption is **visible to everyone**, not hidden for assistive
technology only. Reasons: the owner must be able to review this copy at a gate
(a hidden equivalent is invisible to review); the page has no legend, so the
caption doubles as the key to the markers; and a visible caption is one piece of
text serving both a sighted and a non-sighted reader rather than two that can
drift apart. The cost — a slightly longer page — is accepted, and is contained
by keeping every caption to one clause-plus-clause sentence. (story.md asks
this open item be re-confirmed for a page rather than a popup: it holds, and
the page has more room for it than the popup did.)

The picture itself (the `<svg>`) is **`aria-hidden="true"`**, so the caption is
the whole of the figure's accessible text: nothing announces twice, and no
picture can present itself as a table or a grid to be navigated (story.md's
Gate D). The pictures are inert — no click handler, no focus, no animation.

The ten captions are fixed here (they are new copy, so this plan settles them;
everything else on the page is story.md's fixed copy). They live in
`rulesCopy.ts`, which Step 2 committed; caption 10 is **amended by Decision
12** and Step 5 makes that edit:

1. "Red's piece can move to any of the eight ringed squares."
2. "With a blue piece diagonally beside it, red can reach only four squares."
3. "Red can attack the blue piece one square ahead."
4. "Red can attack the blue piece diagonally beside it."
5. "Red's rank 1 attacks blue's rank 2: the blue piece is removed."
6. "Red's rank 3 attacks blue's rank 2: the red piece is removed."
7. "Red's rank 4 attacks blue's rank 4: both are removed."
8. "Red's rank 4 attacks a blue Tower: both are removed."
9. "Red's rank 3, with a red rank 3 beside it, attacks blue's rank 2: both are
   removed."
10. "Blue's rank 2 attacks a red rank 3 with another red rank 3 right behind
    it: both are removed." — **amended** from the committed
    "…that has a red rank 3 beside it…" by Decision 12, which moves that
    supporting piece from beside the defender to directly behind it.

### Decision 4 — The page is a screen in `src/app/rules/`, named `RulesScreen`

The files under `src/app/rules/` after this story:

| File                                  | Kind                | What it holds                                                          |
| ------------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| `figures.ts`                          | pure data, no React | the ten figures, the cutout window, placements, markings, presentation |
| `figures.test.ts`                     | test                | the figures-versus-engine agreement check                              |
| `rulesCopy.ts`                        | pure data, no React | the header, the six sections, the ten captions, the button copy        |
| `rulesCopy.test.ts`                   | test                | structural and vocabulary guards on the copy                           |
| `RuleFigure.tsx` / `RuleFigure.css`   | thin render         | one figure, drawn on its board cutout                                  |
| `RulesScreen.tsx` / `RulesScreen.css` | thin render         | the page: header, "Back to start", sections, layout                    |

`RulesDialog.tsx` / `RulesDialog.css` (Step 3's modal) become
`RulesScreen.tsx` / `RulesScreen.css` — **renamed with `git mv`** so the file
history survives, then converted. The CSS class prefix goes from
`rules-dialog` to `rules-screen`, matching the component name and the
`review-screen__back` precedent.

**Why `src/app/rules/` and not `src/review/`-style top-level folder.**
`ImportScreen`/`ReviewScreen` live in `src/review/` because "reviewing a game"
is a feature area with several components and modules of its own. The rules
page is likewise a feature area, but it is reached only from the start screen
and is conceptually part of the app's front door, so it stays in the folder
`StartScreen.tsx` lives beside — as `src/app/rules/`, which Steps 1–3 already
created and committed. Moving it now to a new top level (e.g.
`src/howToPlay/`) would churn four committed files, break their history for no
functional gain, and gain only a cosmetic separation from `src/app/`. The one
real cost of the current location is that `src/rules/` (the rule engine) and
`src/app/rules/` (the how-to-play page) are different things with the same
folder name; that is accepted, and every module in `src/app/rules/` carries a
header comment saying what it is, so a cold reader is not misled. **Do not
rename the folder in this story.**

**What the new code may import:** `src/art/PieceIcon.tsx` (`PieceIcon`,
`PieceSpriteDefs`), anything under `src/rules/primary/v2/` (pure rule data and
logic), `src/board/sideNames.ts` (the Red/Blue words — a two-line pure module,
not a board component), `src/appInfo.ts` and `src/App.css` (the shared `.app`
shell, which every screen imports). **What it must not import:** any component
or CSS file under `src/board/` other than `sideNames.ts`.

`PieceSpriteDefs` is mounted by `RulesScreen.tsx` itself, as the first child of
its `<main className="app">` — exactly where `ReviewScreen.tsx` mounts its own
copy. `StartScreen.tsx` needs no knowledge of it.

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

The figure declares its **own** cell size, `--figure-square:
clamp(22px, 4.5vmin, 34px)` — deliberately not the board's
`clamp(28px, 6vmin, 64px)`. A figure inside a two-column page must stay small
and stable; it is not a play surface. One cell size governs all ten figures, so
a piece is drawn at exactly the same scale in every picture.

The cutout is a plain 5×5 patch of
squares with a thin `--ink` outline around the patch, reading as a crop of a
board rather than as a tiny complete board (the real board's outer border is
2px; the cutout's is 1px). No lake, no buffer band, no rank/file labels, no
board edge treatment.

For the six that do not, there is **no square fill, no square border and no
patch outline at all** — the page's own parchment background shows through,
which is the same colour the board's squares are painted in.

### Decision 6 — The cutout window: Battle, columns D–H × rows 1–5, centre F3

_(Amended: the window still defines every figure's **squares**, for all ten
figures; it is **drawn** only for figures 1–4. See Decision 11.)_

All ten figures place their pieces in a 5×5 window onto the **Battle board**
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
- **Orientation.** A figure is drawn in the absolute (White) frame the app
  already uses for Red's view: **higher rows nearer the top, column D at the
  left, column H at the right.** Red (= White = `--side-a`) therefore
  advances **up** the picture and Blue (= Black = `--side-b`) advances **down**,
  which is what the game's own board shows.
- **Sides.** Red is always the piece the reader is invited to identify with;
  Blue is always the enemy. In figure 10 — the only figure where the enemy is
  the attacker — Blue attacks downward, which is the direction Blue really
  advances.

A figure names its pieces by **absolute square key** on that board (`"F3"`), and
`RuleFigure.tsx` derives the drawing position from the anchor. **Dropping the
board does not drop the squares:** all ten figures keep real, engine-checkable
square keys, because those squares are what `figures.test.ts` feeds to
`legalDestinations` / `legalAttacks` / `resolveCombat`. A figure whose squares
stopped being real would silently stop being checked. Only the _drawing_ of the
grid is dropped, and only for figures 5–10.

### Decision 7 — The ten figures (verified against the engine while this plan was written)

Piece types: rank 1 = `masterOfArms`, rank 2 = `champion`, rank 3 = `knight`,
rank 4 = `halberdier`. Red = `"white"`, Blue = `"black"`.

All ten are drawn on the 5×5 cutout (amendment 3). The **Board?** column that
briefly distinguished them is gone, along with the `presentation` field Step 5
added to back it — Step 6 removes both.

| #   | Section                               | Pieces                                       | Marked                                               |
| --- | ------------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| 1   | Movement                              | red R3 **F3**                                | move rings on D3, E3, F1, F2, F4, F5, G3, H3 (eight) |
| 2   | Slowed movement                       | red R3 **F3**; blue R3 **E4**                | move rings on E3, F2, F4, G3 (four)                  |
| 3   | Movement for attacks                  | red R3 **F3**; blue R3 **F4**                | attack arrow F3 → F4                                 |
| 4   | Movement for attacks                  | red R3 **F3**; blue R3 **G4**                | attack arrow F3 → G4                                 |
| 5   | Combat                                | red R1 **F2**; blue R2 **F4**                | attack arrow F2 → F4; X on F4                        |
| 6   | Combat                                | red R3 **F2**; blue R2 **F4**                | attack arrow F2 → F4; X on F2                        |
| 7   | Equal-ranked pieces and Tower attacks | red R4 **F2**; blue R4 **F4**                | attack arrow F2 → F4; X on F2 **and** F4             |
| 8   | Equal-ranked pieces and Tower attacks | red R4 **F2**; blue **Tower F4**             | attack arrow F2 → F4; X on F2 **and** F4             |
| 9   | Rank-up                               | red R3 **F2**; red R3 **E2**; blue R2 **F4** | attack arrow F2 → F4; X on F2 **and** F4             |
| 10  | Rank-up                               | blue R2 **F4**; red R3 **F2**; red R3 **F1** | attack arrow F4 → F2; X on F4 **and** F2             |

**This table is amended by story.md's amendments 5 and 6** and no longer matches
`figures.ts`; Step 6 is what brings the data to it.

- **Figures 5–10 now attack from two squares away**, leaving the square between
  attacker and defender empty for the arrow. Five run **F2 → F4** with F3 empty;
  figure 10 runs **F4 → F2** with F3 empty. This is a legal two-square attack in
  every case (the attacker is unencumbered — a friendly supporting piece does
  not encumber), never a drawing offset applied to adjacent squares.
- **Figure 3 attacks one square ahead**, F3 → F4, where it previously ran
  F3 → F5. Picture 4 is unchanged at F3 → G4: a diagonal attack reaches one
  square only.
- **Figure 10's supporting red piece is F1**, directly behind the defender at
  F2 — E2 as first committed, F2 after Step 5, and now F1 because the defender
  itself moved. It is still orthogonally behind the defender and still not
  adjacent to the attacker, which is what Decision 12 requires of it.
- **Figures 1, 2 and 4 are unchanged.**

Every attack above was re-verified against this repository's own
`legalAttacks`/`resolveCombat` when these amendments were written: each gives
**exactly one** legal attack, **identical under all four combinations** of
`DIAGONAL_ATTACKABLE` × `DIAGONAL_ATTACK_PATH`, and the outcomes are
`attackerWins` (5), `attackerLoses` (6) and `mutualLoss` (7, 8, 9, 10).

Every row above was checked against the real `legalDestinations`,
`legalAttacks` and `resolveCombat` while this plan was written, under all four
combinations of the two diagonal flags — including figure 10's new F2
placement, re-verified when this plan was revised. In particular:

- Figure 2's four destinations are exactly `legalDestinations`' output with the
  diagonal enemy present; figure 1's eight are exactly its output without one.
- Figures 3–10's marked attack squares are exactly `legalAttacks`' output, and
  in every one of the ten figures that output is **identical under all four
  flag combinations** — so the page never illustrates a rule the game does not
  always have.
- Figures 5–10 resolve to `attackerWins`, `attackerLoses`, `mutualLoss`,
  `mutualLoss`, `mutualLoss`, `mutualLoss` respectively, which is exactly the
  set of struck-out pieces the table lists. Figure 10 resolves to `mutualLoss`
  with the supporter at F2 exactly as it did at E2.

**Constraints from story.md that these placements encode, and which a later
reader must not "tidy away":**

- The diagonally attacked enemy (figure 4, G4) is a **numbered** piece, never a
  Tower or Flag — true under `DIAGONAL_ATTACKABLE=movable_only` as well as
  `all`.
- The squares flanking that diagonal (G3 and F4) are **empty** — true under
  `DIAGONAL_ATTACK_PATH=open_path` as well as `always`.
- Figures 3 and 4 stay **two separate figures**. Combining them would make the
  two-square attack illegal, because the diagonal enemy slows the attacker.
- Figure 8's Tower attack is **orthogonal**, never diagonal.
- Figure 9's supporting red piece sits at **E2** (orthogonally beside the
  attacker) and figure 10's at **F2** (orthogonally behind the defender). Both
  are deliberately **not** adjacent to the enemy attacker: moving either to a
  square adjacent to it would hand that attacker a second legal attack and
  break the figure's "one arrow" claim — `figures.test.ts` catches exactly
  that. For figure 10 this leaves F2 as the **only** orthogonal neighbour of
  the defender available: E3 and G3 are both diagonally adjacent to the blue
  attacker at F4, and F4 is the attacker's own square.

### Decision 8 — The page's layout: full-width header, two columns, DOM order = reading order

_(Rewritten for the page. The modal's non-scrolling header, internal scroll
region, `max-height` and Close button are all gone.)_

- `RulesScreen` renders a `<main className="app">` — the same shell every other
  screen uses (`src/App.css`), so the page inherits the app's centred column,
  padding and title styling for free and looks like the rest of the app.
- Inside it, in DOM order: `PieceSpriteDefs`; the **header block** — an
  `<h1 className="app__title" tabIndex={-1}>` carrying
  `RULES_HEADER.title` ("Capture the Flag: Rules") and the two header lines
  beneath it; the **"Back to start" button** (Decision 9); the **sections
  region**; then the **second "Back to start" button**, outside the sections
  region.
- **The page scrolls as an ordinary page.** No `overflow` on any container, no
  `max-height`, no `overscroll-behavior`, no scroll containment. If the content
  is taller than the viewport the document scrolls, exactly as the start screen
  does. This is the single biggest reason the story moved off the modal, and no
  step may reintroduce an internal scroll region.
- The sections region is a **CSS grid**, `repeat(2, minmax(0, 1fr))` above a
  ~48rem viewport breakpoint and a single column below it, with
  `width: 100%; max-width: 64rem` so the two columns do not stretch to absurd
  measure on a wide monitor. **Not** CSS multi-column (`columns`), which would
  split a section across columns and divorce visual order from DOM order.
- **The three left-column sections and the three right-column sections are each
  grouped under their own wrapper element** (`.rules-screen__column`), built by
  filtering `RULES_SECTIONS` on its `column` field. With exactly two wrapper
  elements as the grid's direct children, the grid's own auto-placement puts
  the first wrapper in column 1 and the second in column 2, both starting at
  row 1. This is Step 3's post-gate fix and it carries over unchanged — do not
  go back to per-section `grid-column`, which left the right column starting
  partway down, and never use `order`, which desynchronises visual order from
  reading and tab order.
- **DOM order is: header, Back to start, Movement, Slowed movement, Movement
  for attacks, Combat, Equal-ranked pieces and Tower attacks, Rank-up, Back to
  start** — in every layout, which is exactly what story.md's in-scope item 2
  requires. The closing "Back to start" sits outside the sections grid, after
  it, so it is never drawn into a column.
- Within a section, the one or two figures sit in a flex-wrap row: side by side
  when the column is wide enough, stacked when it is not.
- **Heading levels.** The page's title is the `<h1>` (it is the page's own
  title, like "Reviewing a game" on the review screen — the app name is not
  repeated here); the six section headings are `<h2>`. Note this is one level
  shallower than the modal used, because there is no longer a start-screen
  `<h1>` above it.

### Decision 9 — Arriving, leaving and focus

_(Rewritten for the page. No `showModal()`, no focus trap, no Escape-to-close,
no Close button, no `::backdrop`, no confirmation prompt.)_

- `App.tsx`'s `Screen` union gains a fifth member, `{ kind: "rules" }`, and a
  branch mounting `<RulesScreen onBack={() => setScreen({ kind: "start" })} />`.
  Follow the existing branches' shape exactly.
- `StartScreen` gains an `onHowToPlay` callback prop, called by the "How to
  play" button, doing nothing but asking the shell to switch screens — exactly
  as `onReviewAGame` does. **`StartScreen` loses the `rulesOpen` state Step 3
  gave it and renders no dialog**; it goes back to holding no state at all
  besides its heading ref.
- **Leaving is a "Back to start" button** calling `onBack`, with **no
  confirmation prompt** — following `ImportScreen`/`ReviewScreen`'s precedent,
  because nothing is lost by leaving a page of rules. Its label is
  **"Back to start"** (`ReviewScreen`'s wording, which is the clearer of the
  two existing ones).
- **There are two of them** (the owner's decision at the revised plan's
  approval gate): one in the header block, immediately after the two header
  lines and before the sections, so a keyboard or screen-reader user meets the
  way out early instead of after ten figures; and a second at the foot of the
  page, after the last section, so a player who has read to the bottom of a
  genuinely long page is not made to scroll back up to leave. Both call the
  same `onBack` and carry the same label.
  - The duplicate name is a deliberate, accepted cost. Mitigate it the cheap
    way: the two buttons are the page's only controls, they are far apart in
    reading order, and the foot one is the last thing on the page — so a
    screen-reader user hearing "Back to start" twice is not left guessing which
    is which. Do **not** disambiguate them with differing `aria-label`s that
    contradict their visible text.
  - Its chrome restates the `.review-screen__back` / `.import-screen__back`
    declarations locally in `RulesScreen.css` (they are duplicated per screen in
    this repo today; follow that, do not import another screen's CSS).
- **Focus on arrival goes to the page's `<h1>`**, using the `tabIndex={-1}`
  heading pattern focused in a `useEffect` on mount — the same pattern
  `StartScreen.tsx`, `ImportScreen.tsx` and `ReviewScreen.tsx` all use — so a
  screen-reader user landing there hears what the page is instead of being
  stranded on `<body>`.
- **Returning to the start screen re-mounts `StartScreen`**, whose own
  mount effect focuses its heading. Focus therefore lands on the start screen's
  title rather than back on the "How to play" button. That is the app's
  existing, consistent behaviour for every back-to-start transition (import and
  review both do it) and is deliberately not special-cased here.
- **Escape does nothing**, and nothing traps focus: this is a page, and the
  browser's own Tab order runs from the button through the document as normal.

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
policy for. Step 3's Gate C looked at a phone-width viewport explicitly. If it
turns out to be genuinely bad, the pre-approved remedy is a narrow-width
tightening of `.start-screen__choice`'s vertical padding via a media query
**scoped to `StartScreen.css`** — record it as a deviation in the step's Notes
if used.

### Decision 11 — How a board-less figure is laid out (superseded)

**Superseded by story.md's amendment 3**, which restores the board cutout to all
ten figures. This decision fixed the geometry of a board-less figure — same cell
pitch, the defending side translated one whole cell along the attack vector to
open a gap for the arrow, everything derived from the figure's own squares. Step
6 was built to it and is being rebuilt without it.

Nothing of it survives except the principle that outlasted it, which every
figure still obeys: **piece positions are derived from the figure's own square
data, never hand-placed per figure.** That is what keeps the drawing honest
against the engine-checked squares.

There is now **one** presentation. Every figure is drawn on the 5×5 cutout
described in Decisions 5 and 6, and attacker and defender occupy adjacent cells
exactly as they do in the rules — so the arrow spans one cell boundary, the same
way it does in figures 3 and 4.

### Decision 12 — The rank-up figures, and why figure 10's supporter is at F2

story.md flagged figures 9 and 10 as the real risk of dropping the board: their
rule condition is _adjacency_, which a board makes obvious and a void does not.
**Amendment 3 removes that risk at the root** by restoring the cutout — on a
board, a piece in one of the eight surrounding squares simply _is_ in one of the
eight surrounding squares, and the reader can count it.

What survives from the board-less round, and why it should **not** be reverted:

- **Figure 10's supporting red piece stays at F2**, where Step 5 moved it (it
  was E2 as first committed). The move was made for the void, but it is at least
  as good on a board: F2 is orthogonally behind the defender at F3, on the far
  side from the blue attacker at F4, so the supporting pair reads as a column
  and the attacker is unambiguously the odd one out. Reverting to E2 would churn
  committed data and its caption for no gain.
- **Why F2 and not another square.** The supporter must be adjacent to the
  defender (the rule) and **not** adjacent to the blue attacker (or the attacker
  gains a second legal attack and the figure's single-arrow claim breaks). Of
  F3's four orthogonal neighbours, E3 and G3 are both diagonally adjacent to F4
  and F4 is the attacker itself — leaving F2 as the only orthogonal option.
- **Verified at plan time and again in Step 5** against this repository's own
  `legalAttacks`/`resolveCombat`: with red knights on F3 and F2 and a blue
  champion on F4, `legalAttacks` from F4 is exactly `["F3"]` under all four
  combinations of `DIAGONAL_ATTACKABLE` × `DIAGONAL_ATTACK_PATH`, and
  `resolveCombat(F4 → F3)` is `mutualLoss`. The generic assertions in
  `figures.test.ts` re-verify this on every run.
- **Caption 10 keeps Step 5's wording** — "with another red rank 3 right behind
  it" — because it describes the picture that is actually drawn. The rule
  sentence above it, story.md's fixed copy, still says "any of the eight squares
  immediately surrounding it", so nothing about the rule's statement narrows.
- **Figure 9 is unchanged**: its supporting red piece is at E2, orthogonally
  beside the attacker at F2, and on a cutout the two red pieces sit side by side
  on adjacent squares.

**The escalation clause is retired.** It existed because a void might have left
adjacency unreadable; with the board back, the picture states it. If Gate B
still finds either figure ambiguous, that is ordinary gate feedback, not an
escalation.

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

## Step 4 — Turn the popup into a screen

Status: committed

Notes: `git mv`'d `RulesDialog.tsx`/`RulesDialog.css` to `RulesScreen.tsx`/
`RulesScreen.css` and converted the modal to a page per Decisions 8 and 9:
`<dialog>` → `<main className="app">`, `open`/`onClose` props → a single
`onBack: () => void`, the `<h2>` title → the page's `<h1 className="app__title"
tabIndex={-1}>` (still focused on mount), section headings `<h3>` → `<h2>`,
all internal-scroll CSS removed (`overflow-y`, `overscroll-behavior`,
`max-height`, `flex: 1 1 auto`, the `::backdrop` rule, the `[open]` display
gate), and the `rules-dialog` class prefix renamed to `rules-screen`
throughout both files. Added two "Back to start" buttons calling `onBack`,
one right after the header lines (grouped in a new
`.rules-screen__header-lines` wrapper so they don't inherit the `.app`
shell's 1.5rem inter-child gap) and one after the sections region, both
sharing one `.rules-screen__back` rule restating
`.review-screen__back`'s chrome locally. Kept the two-column wrapper
structure, the 48rem breakpoint and the `aria-hidden` figure placeholders
unchanged. `App.tsx` gained `{ readonly kind: "rules" }` in the `Screen`
union and a branch mounting `<RulesScreen onBack={() => setScreen({ kind:
"start" })} />`, plus a header-comment update; `StartScreen.tsx` gained an
`onHowToPlay` prop wired to the same button, and lost the `rulesOpen`
`useState` and the rendered `<RulesDialog>`. All five repository checks
(typecheck, lint, test — 942 tests, format:check, build) pass; `git diff
--stat` touches only `src/App.tsx`, `src/app/StartScreen.tsx` and the two
renamed `src/app/rules/` files — no forbidden file. One deviation from the
plan's literal text: the plan didn't specify a wrapper for the two header
lines, but without one they inherited the `.app` shell's `gap: 1.5rem` and
read as two separate blocks rather than one short paragraph, so a
`.rules-screen__header-lines` div with its own small `gap: 0.15rem` was
added (mirroring Step 3's `.rules-dialog__header-text` treatment) — purely a
visual grouping choice within Decision 8's "header block", not a change to
DOM order, copy, or the two-`onBack`-buttons requirement. Not yet manually
verified — that is the owner's gate (Gates A/C re-run for a page, "no modal
behaviour survives", and the shell-regression check), per the plan.

This is story.md's Amendment 1, and it is the only step that touches
`App.tsx`. Nothing about the page's copy, its two-column layout or its figures
changes here — only the surface it lives on. Read Decisions 4, 8 and 9 before
starting; they are written for the page and supersede anything Step 3's frozen
text says about a dialog.

Four edits:

1. **Rename, then convert.** `git mv src/app/rules/RulesDialog.tsx
src/app/rules/RulesScreen.tsx` and likewise `RulesDialog.css` →
   `RulesScreen.css` (renaming with `git mv` keeps the file history), then
   convert the component from a modal into a screen:
   - The `<dialog>` becomes `<main className="app">` (importing `../../App.css`
     as every other screen does). Remove the `open` prop, the `useEffect` that
     called `showModal()`/`close()`, the `onCancel` handler, the
     `aria-labelledby` attribute, the Close button and the `::backdrop` rule —
     none of them has any meaning on a page.
   - The component's only prop becomes `onBack: () => void`.
   - The `<h2>` title becomes the page's `<h1 className="app__title"
tabIndex={-1}>`, still focused on mount via `useEffect` (Decision 9), still
     carrying `RULES_HEADER.title`; the two header lines follow it; the six
     section headings drop from `<h3>` to `<h2>`.
   - Add **two "Back to start" buttons** (Decision 9), both calling `onBack`
     and both carrying that same visible label: one immediately after the
     header lines and before the sections region, and one after the sections
     region, at the foot of the page and outside the sections grid. Their
     chrome restates `.review-screen__back`'s declarations locally.
   - **Remove every trace of the internal scroll region**: `overflow-y`,
     `overscroll-behavior`, `max-height`, `flex: 1 1 auto` on the sections
     region, and the dialog's `max-width`/`display: flex`/`[open]` rules. The
     sections region keeps `width: 100%; max-width: 64rem` so the columns do
     not stretch on a wide monitor, and the document does the scrolling.
   - Rename the CSS class prefix `rules-dialog` → `rules-screen` throughout
     both files.
   - **Keep** the two-column wrapper structure exactly as Step 3's post-gate fix
     left it (two `.rules-screen__column` wrappers built by filtering
     `RULES_SECTIONS` on its `column` field, no `grid-column`, no `order`), the
     48rem breakpoint, `PieceSpriteDefs` (now the first child of the `<main>`,
     as `ReviewScreen.tsx` does it), and the `aria-hidden` figure placeholders —
     Step 6 replaces those.
2. **`src/App.tsx`** — add `{ readonly kind: "rules" }` to the `Screen` union
   and an `if (screen.kind === "rules")` branch mounting
   `<RulesScreen onBack={() => setScreen({ kind: "start" })} />`, in the same
   shape as the existing branches. Extend the module's header comment to name
   the new screen and say it is reached only from the start screen and returns
   without prompting (the file's comment already narrates every screen; keep
   that habit). Change nothing else in this file.
3. **`src/app/StartScreen.tsx`** — add an `onHowToPlay: () => void` prop, call
   it from the "How to play" button, and **delete** the `rulesOpen` state, the
   `useState` import if it is now unused, and the rendered `<RulesDialog>`.
   Update the component's header comment, which currently says the popup opens
   from here and that `App.tsx` needs no new screen — it now does. Wire the new
   prop up in `App.tsx`'s `<StartScreen …>`.
4. Delete nothing else. `figures.ts`, `rulesCopy.ts` and both test files are
   untouched in this step.

Why it comes here: every remaining step draws into this page, and the direction
change has to land before anything else is built on the old surface.

Depends on: Step 3 (the component being converted).

Verification (**manual**). Restart the dev server (`npm run dev`; this
container has no file watching) and open `http://localhost:5173`. Then run the
five repository checks.

- **Gate A (first half, re-run for the page).** "How to play" is still the
  **first** of the four start-screen choices; activating it **replaces** the
  start screen with the rules page rather than opening anything over it. The
  page's title reads "Capture the Flag: Rules", followed by **both** header
  lines. All six section headings and their sentences are present and read
  **word for word** as story.md's "The page's content" has them. "Back to
  start" returns to the start screen with **no confirmation prompt**, the start
  screen looks exactly as it did, and going back into the rules page works
  again.
- **No modal behaviour survives.** There is no Close button, no dimmed
  backdrop, and pressing Escape on the rules page does nothing (it must not
  navigate anywhere).
- **Gate C (first pass, for a page).** At a comfortable desktop width the
  header spans the full width and the two columns sit side by side, with
  Movement / Slowed movement / Movement for attacks on the **left** and Combat
  / Equal-ranked pieces and Tower attacks / Rank-up on the **right**. Narrowing
  the window collapses them to one column with all three movement sections
  still read before all three combat sections. On a short viewport and at phone
  width the **page itself scrolls** — the whole document, top to bottom — and
  nothing is clipped or trapped in an inner scrollbar. Scroll to the very
  bottom and confirm the last section is fully visible.
- **Nothing else in the shell moved.** From the start screen, "Play a game" and
  "Review a game" still reach their screens and their own Back controls still
  return to the start screen.
- `git diff --stat` shows only `src/App.tsx`, `src/app/StartScreen.tsx` and
  files under `src/app/rules/` — no forbidden file (see "Out of bounds").

---

## Step 5 — Figure data for the board-less direction

Status: committed

Notes: Added `FigurePresentation` ("board" | "noBoard") to the `Figure` type
in `src/app/rules/figures.ts` and set it on all ten figures (`board` for
`movement`/`slowedMovement`/`attackOrthogonal`/`attackDiagonal`, `noBoard`
for the six combat figures), with a module-header addition explaining the
field governs drawing only. Moved figure `combatRankUpDefend`'s (figure 10)
supporting piece from E2 to F2 and updated its in-line comment to explain
why F2 is the only viable orthogonal neighbour. Updated caption 10 in
`rulesCopy.ts` to "Blue's rank 2 attacks a red rank 3 with another red rank
3 right behind it: both are removed." Verified F2 independently against the
engine with a scratch script (`legalAttacks` from F4 = exactly `["F3"]`
under all four `DIAGONAL_ATTACKABLE`×`DIAGONAL_ATTACK_PATH` combinations,
`resolveCombat(F4→F3)` = `mutualLoss`), matching Decision 12's plan-time
verification. Extended `figures.test.ts` with 16 new tests: presentation is
declared on every figure and matches the board/no-board id lists exactly
(counts 4 and 6); every board-less figure carries an attack marking with a
non-empty removal set and the board-less set is exactly the six combat
figures; a coverage check that the attack- and combat-figure id lists the
existing generic tests iterate over include all six board-less figures (so
none can later be silently exempted); and figure-10-specific checks on its
three piece placements and the supporter's orthogonal-adjacency-to-defender
/ non-adjacency-to-attacker geometry. `rulesCopy.test.ts` needed no changes
and continues to pass. All five repository checks (typecheck, lint, test —
958 tests, format:check, build) pass; `git diff --stat` touches only
`src/app/rules/figures.ts`, `src/app/rules/figures.test.ts` and
`src/app/rules/rulesCopy.ts` — no forbidden file, and `RulesScreen.tsx` was
not touched. No deviation from the plan.

Two data changes, both in the modules Steps 1 and 2 committed, both verified by
extending the existing automated tests. Read Decisions 6, 7, 11 and 12 first.

1. **Say which figures draw a board.** Add one small, additive field to the
   `Figure` type in `src/app/rules/figures.ts` recording each figure's
   presentation — a board cutout, or pieces on their own. Set it to **board**
   for figures 1–4 (`movement`, `slowedMovement`, `attackOrthogonal`,
   `attackDiagonal`) and **no board** for figures 5–10 (`combatRank1Wins`,
   `combatRank3Loses`, `combatEqualRank`, `combatTower`, `combatRankUpAttack`,
   `combatRankUpDefend`), per story.md's Amendment 2 and Decision 7's table.
   This belongs in the data, not in the renderer, because the repository has no
   DOM test environment: anything expressed as data can be asserted, and a
   renderer-side `if (figure.id === …)` list could silently drift from the
   story. Update the module header comment to say that the presentation field
   governs **drawing only**, and that **all ten figures keep real,
   engine-checked squares** — a figure whose squares stopped being real would
   silently stop being checked (Decision 6).
2. **Move figure 10's supporting piece from E2 to F2**, and change its caption
   in `src/app/rules/rulesCopy.ts` from "…that has a red rank 3 beside it…" to
   "…with another red rank 3 right behind it…" (Decisions 3 and 12). This is
   what makes "beside it" read once the board is gone: F2 is orthogonally
   adjacent to the defender at F3 and on the far side from the blue attacker,
   so the two red pieces are drawn touching. Record in the figure's comment why
   F2 and not E3/G3 (both are diagonally adjacent to the blue attacker at F4
   and would give it a second legal attack, breaking the figure's single-arrow
   claim).

**Nothing else in this step.** No component work; `RulesScreen.tsx` is not
touched.

Why it comes here: Step 6 draws the figures, and it must be told which ones
draw a board and where figure 10's pieces stand before it starts; and doing the
data change on its own keeps it under automated verification instead of
riding along inside a manual gate.

Depends on: Step 1 (`figures.ts`), Step 2 (`rulesCopy.ts`). Independent of Step 4.

Verification (**automated**): extend `src/app/rules/figures.test.ts`, then run
the five repository checks.

- Every figure declares a presentation; figures 1–4 declare **board**, figures
  5–10 declare **no board**, named explicitly by id so the assertion is a guard
  against a silent edit rather than a restatement of the data.
- The count is exactly four board figures and six board-less ones, and every
  board-less figure carries an **attack** marking with a non-empty removal set
  (i.e. the board-less set is exactly the six combat figures, not an arbitrary
  subset).
- **The engine checks still cover all ten figures.** The existing generic
  assertions (placement sanity, `legalAttacks` under all four diagonal-flag
  combinations, `resolveCombat` removal sets) already iterate over `FIGURES`
  and must continue to include the board-less six — assert that the attack- and
  combat-figure id lists the test iterates cover every figure, board or not, so
  nobody can later exempt a board-less figure from checking.
- Figure 10 specifically: its three pieces are the blue attacker on F4, the red
  defender on F3 and a **red piece on F2**; the supporting piece is
  orthogonally adjacent to the defender and **not** adjacent to the attacker;
  and (via the existing generic assertions) the blue attacker still has exactly
  one legal attack under all four flag combinations, and the fight still
  resolves to a two-piece removal.
- `rulesCopy.test.ts` still passes unchanged — every figure id still has
  exactly one caption, and the vocabulary guards still hold over the amended
  caption.

---

## Step 6 — Draw the figures on their board cutouts, no markers yet

Status: committed

Notes: **First attempt** (superseded): built `RuleFigure.tsx`/`RuleFigure.css`
with two presentations - a board cutout for figures 1-4 and a translated,
bounding-box-cropped "no board" layout for figures 5-10 (Decision 11, since
superseded). Rejected at the manual gate not for a defect but because the
owner reversed direction (story.md amendment 3): all ten figures draw on a
board cutout after all. **This attempt** (current): adapted the rejected
attempt's uncommitted board-cutout half rather than starting over. Rewrote
`RuleFigure.tsx`/`RuleFigure.css` to a single presentation - every figure
draws the full 5x5 patch (`BoardSquares`, unconditional), with piece
positions derived purely from `windowCell(piece.square)` and the shared
`FIGURE_WINDOW` anchor; removed `boardlessPlacements`, the one-cell
translation along the attack vector, the bounding-box crop/margin
arithmetic, and the `data-presentation` branch entirely. Removed the
`presentation` field from the `Figure` interface and the `FigurePresentation`
type in `figures.ts` (and its per-figure literals), updating the module's
header comments to describe one presentation; kept figure 10's supporter at
F2 and its caption unchanged. In `figures.test.ts`, deleted the
`"figure presentation (board or no board)"` describe block's ten
board/no-board-listing tests (declares-a-presentation, the four+six
per-id loops, the counts-of-4-and-6 test, and the board-less-attack-marking
test) and the `expect(figure.presentation).toBe("noBoard")` line in the
`combatRankUpDefend` tests (leaving an unused `figure` var there, also
removed). **Kept and relocated** the coverage test (renamed describe block to
`"figure coverage"`) that asserts every figure id is covered by the move-,
attack- or combat-figure id lists the engine checks iterate over, and that
every combat figure id appears in both the attack-figure and combat-figure
lists - rewritten to iterate `COMBAT_FIGURES` directly instead of the deleted
`NO_BOARD_FIGURE_IDS` constant (the two were the same six ids), so the
"can't silently exempt a figure from checking" protection survives unchanged
in substance. `RulesScreen.tsx`/`RulesScreen.css` needed no further edits:
the rejected attempt's uncommitted changes there (rendering a `RuleFigure`
per figure id in place of Step 4's placeholders, and removing the
placeholder CSS) already matched what this step wants and were left as-is.
Test count dropped from 958 to 945 (figures.test.ts: 71 → 58) - exactly 13
fewer `it(...)` blocks (1 declares-a-presentation + 4 per-id board + 6
per-id no-board + 1 counts-of-4-and-6 + 1 board-less-attack-marking), the
coverage test surviving as one test both before and after since it was
rewritten in place rather than deleted. All five repository checks (typecheck, lint,
test - 945 tests, format:check, build) pass; `git diff --stat` touches only
`src/app/rules/figures.ts`, `src/app/rules/figures.test.ts`,
`src/app/rules/RulesScreen.tsx` and `src/app/rules/RulesScreen.css`
(modified) plus the new `src/app/rules/RuleFigure.tsx`/`RuleFigure.css` - no
forbidden file, `src/board/**` and `src/rules/**` untouched. Rendered the
page with a Playwright screenshot (Chromium, installed transiently for this
check only - not added as a project dependency) at desktop width to confirm
by eye that all ten pictures show a visible 5x5 grid, attacker and defender
sit on adjacent squares with no gap, figure 9's two red pieces sit side by
side and figure 10's sit in a vertical column with blue attacking downward
into it, and caption 10 reads "…with another red rank 3 right behind it…" -
this was a self-check, not a substitute for the step's own manual gate, which
remains the owner's to run. No deviation from the plan's substance; the only
departure from its literal text is keeping the coverage test's assertions as
one rewritten test rather than deleting and re-adding it, which the plan's
"keep… the coverage check" instruction anticipates.

**Amendment pass** (story.md amendments 5 and 6, applied after this step's
first gate): the owner asked for a real empty square between attacker and
defender in the six combat figures, and a one-square (not two-square) attack
in figure 3. Updated only `figures.ts`'s data: figures `combatRank1Wins`,
`combatRank3Loses`, `combatEqualRank`, `combatTower` and
`combatRankUpAttack` now attack **F2 → F4** (previously the adjacent
F2 → F3), each leaving F3 empty; `combatRankUpDefend` now attacks
**F4 → F2** (previously F4 → F3), also leaving F3 empty, with its
supporting piece moved from F2 to **F1** (directly behind the new defender
square, still orthogonally adjacent to it and not adjacent to the attacker);
`attackOrthogonal` (figure 3) now attacks **F3 → F4** (previously F3 → F5),
a one-square attack. Updated caption `attackOrthogonal` in `rulesCopy.ts`
from "…two squares ahead." to "…one square ahead."; caption
`combatRankUpDefend` ("…right behind it…") needed no change since it already
described a piece directly behind, not beside. Updated `figures.test.ts`'s
figure-10-specific tests (piece placements and the supporter-adjacency
check) to name F4/F2/F1 instead of F4/F3/F2, and to assert F3 is empty; no
other test needed updating, since every other assertion is written generically
against each figure's own `marking`/`pieces` data rather than hand-coded
squares. Confirmed by re-reading it that `RuleFigure.tsx`/`RuleFigure.css`
derive every piece's drawn position purely from `windowCell(piece.square)`
and the shared window anchor, with no per-figure hand-placed coordinate
anywhere - so **no renderer change was needed or made**; a transient
Playwright screenshot (Chromium installed to the OS scratchpad only, not
added to `package.json`/`package-lock.json` - both files' checksums were
confirmed unchanged before and after) of the rendered page confirmed the six
combat figures now show a visibly empty square between attacker and
defender, figure 3 shows a one-square attack, figure 10's three pieces read
as attacker/gap/defender/supporter in a vertical column, and caption 3 reads
"…one square ahead." All five repository checks (typecheck, lint, test - 945
tests unchanged, format:check, build) pass. `git diff --stat` for this pass
touches only `src/app/rules/figures.ts`, `src/app/rules/figures.test.ts` and
`src/app/rules/rulesCopy.ts` - no forbidden file, no new dependency. No
deviation from the amendment's instructions.

**This step was implemented once and rejected at its gate**, not because the
work was wrong but because the owner reversed the direction it was built to
(story.md amendment 3: the board comes back for all ten figures). The
uncommitted `RuleFigure.tsx` / `RuleFigure.css` from that attempt are in the
tree and are the right starting point — the cutout half of them is exactly what
is now wanted for all ten. Read Decisions 5, 6, 11 and 12 before starting;
Decision 11 is marked superseded and says what survives it.

Create/finish `src/app/rules/RuleFigure.tsx` and `RuleFigure.css`: a thin
component that takes one figure from `figures.ts` and draws it — **pieces only,
no markers yet** — on a 5×5 board cutout.

- **One presentation, not two.** Every figure draws the full 5×5 patch:
  `var(--parchment)` square fill, the faint square border of Decision 5, and a
  1px `var(--ink)` outline around the patch. No lake, no board edge treatment,
  no coordinates.
- **Remove the board-less path entirely** — the one-cell translation of the
  defending side, the bounding-box crop, and the branch that selects between
  presentations. Where a figure needs a gap between attacker and defender, that
  gap is now a **real empty square in the figure's own data**, not a drawing
  offset (below).
- **Move the pieces onto their amended squares** (Decision 7's table, as revised
  by story.md's amendments 5 and 6). Figures 5–9 attack **F2 → F4** and figure
  10 attacks **F4 → F2**, each leaving **F3 empty** for Step 7's arrow to sit
  in; figure 10's supporting piece follows its defender to **F1**; figure 3
  becomes a one-square attack, **F3 → F4**. Figures 1, 2 and 4 do not change.
  Caption 3 in `rulesCopy.ts` becomes "Red can attack the blue piece one square
  ahead." — caption 10 keeps its "right behind it" wording, which is still what
  the picture shows.
  - **The gap is a legal position, not a trick.** Every one of these is a real
    two-square attack by an unencumbered piece. `figures.test.ts` re-verifies
    that automatically and will fail loudly if a placement is wrong — trust it
    rather than reasoning about the geometry by hand, and do not "simplify" a
    figure back onto adjacent squares.
- **Remove the now-vestigial `presentation` field** from `figures.ts`, along
  with the `FigurePresentation` type and the `figures.test.ts` assertions that
  pin the board / no-board id lists and their counts (Step 5 added all of it).
  A field whose every value is the same is noise, and a test asserting a
  distinction that no longer exists is worse than none. **Keep** everything else
  Step 5 did: figure 10's supporter at F2, its caption, and the coverage check
  that ties the figure ids to the engine-checked id lists — that check is what
  stops a figure being silently exempted from verification, and it must survive
  this edit. Run the suite and confirm the count drops only by the assertions
  deliberately removed.
- **Positions are derived from the figure's own square data** — column offset
  from the window anchor, rows running downward from row 5 at the top to row 1
  at the bottom, one `--figure-square` cell each. No per-figure hand-placed
  coordinates anywhere. This is the one principle that outlived the board-less
  round and it is not negotiable: it is what keeps the drawing honest against
  the engine-checked squares.
- Each piece is drawn with `PieceIcon` (`src/art/PieceIcon.tsx`), passing the
  figure's own side and piece type — so the artwork, the side colour and the
  corner rank numeral are the real board's, unmodified, at the same size in all
  ten figures.
- The whole picture is `aria-hidden="true"`, has no click handler, is not
  focusable and animates nothing (story.md: illustrations, not a live board).
- The component wraps the picture and its caption in a `<figure>` /
  `<figcaption>` (Decision 3), taking the caption text from `rulesCopy.ts`.
- **Nothing in `src/board/` is imported, referenced or changed** (Decisions 4
  and 5, and the hard constraint in "Out of bounds"). The board's class names
  are not reused; the custom properties are.

`RulesScreen.tsx` renders a `RuleFigure` per figure id in each section, in place
of Step 4's placeholders; the placeholder CSS goes.

Note for this step's gate: the captions describe markers that do not exist yet —
that is expected here and is fixed in Step 7.

Why it comes here: geometry, scale and the piece artwork are one thing to get
right and to look at; the marker vocabulary (Step 7) is another, and is where
this story's hardest visual questions live. Splitting them keeps each gate to
one judgement.

Depends on: Step 4 (the page to render into), Step 5 (figure 10's placement and
its caption), Step 1 (the figure data), Step 2 (the captions).

Verification (**manual**). Restart the dev server and open the rules page. Then
run the five repository checks.

- All **ten** pictures appear, in the right sections and the right order:
  Movement 1; Slowed movement 1; Movement for attacks 2; Combat 2; Equal-ranked
  pieces and Tower attacks 2; Rank-up 2.
- Each picture shows exactly the pieces Decision 7's table lists, with the right
  side colours (**red = the piece the reader identifies with, blue = the enemy,
  in all ten**) and the right corner numerals — R1 in figure 5, a Tower in
  figure 8, and so on. Red always advances **up** the picture; the blue
  attacker in figure 10 attacks **down**.
- **All ten** read as cutouts of the real board — same artwork, same parchment,
  same square grid — at a size that sits comfortably in a column without
  dominating it. No lake, no board edge treatment, no coordinates, and no figure
  drawn without a board.
- In the six combat figures the attacker and defender are **two squares apart
  with one visibly empty square between them** — that square is where Step 7's
  arrow will go. In figure 3 the enemy is **one square ahead**; in figure 4 it
  is diagonally adjacent.
- **The rank-up figures (9 and 10).** In figure 9 the two red pieces sit side by
  side on adjacent squares; in figure 10 the supporting red piece sits directly
  behind the defender, with the empty square on the defender's other side. In
  both, a reader can see that the two red pieces are on neighbouring squares.
- Nothing in a picture can be clicked, focused or arrowed into: press Tab
  repeatedly through the page and confirm focus never lands inside a picture.
- Each figure has its caption below it, and caption 10 reads "…with another red
  rank 3 right behind it…".
- `git diff --stat` shows no forbidden file — in particular `FullBoard.tsx`,
  `Board.tsx`, `PlayBoard.tsx` and `AccessibleGrid.tsx` are untouched.

---

## Step 7 — The markers: move rings, attack arrows, removals

Status: implemented

Notes: Added the marker vocabulary to `RuleFigure.tsx`/`RuleFigure.css`,
derived entirely from each figure's existing `marking` data (no changes to
`figures.ts` or `rulesCopy.ts` were needed). A new `Markers` component draws
one `<svg viewBox="0 0 5 5">` per figure, positioned in the DOM between
`BoardSquares` and the piece divs so it paints behind the pieces with no
`z-index` (every layer is `position: absolute`, so DOM order alone decides
paint order - Decision 2). For a `"move"` marking it draws all destination
shafts first and all open rings second, so a two-square shaft passes under a
one-square destination's ring rather than over it, matching Decision 1's
pre-approved handling; for an `"attack"` marking it draws one thicker shaft
plus a solid triangular arrowhead computed from the attacker-to-defender unit
vector, with the shaft stopping at the arrowhead's base and the tip landing
exactly on the target square's centre. A removed piece's `PieceIcon` gets a
`--removed` modifier class (opacity 0.45); a `RemovalMark` (two diagonal
lines, each drawn twice - a wide `--parchment` halo, then a narrower `--ink`
line on top) is rendered as a later sibling of the icon, inside the same
piece wrapper, so it is never itself dimmed and always paints over both the
piece and the arrowhead. The X's vertical bounds (`REMOVAL_X_TOP = 0.4` of
the cell) were chosen to clear `PieceIcon`'s top-left rank numeral (bounded
at roughly `y ≤ 0.27` of the cell, worked out from its `x=15,y=17,
fontSize=18` text in the 64x64 `viewBox`), verified visually against figure
8's Tower `T` and every other figure. All geometry (cell centres, shaft
endpoints, arrowhead points, ring positions) is computed from
`cellCenter`/`windowCell`, the same lattice Step 6 established from each
figure's own square keys - no per-figure hand-tuned coordinate was added.
Verified visually with a transient Playwright/Chromium install (browser
binary cached under the OS scratchpad only; `package.json` and
`package-lock.json` checksums confirmed byte-identical before and after, and
`git diff --stat` for this step touches only `RuleFigure.tsx` and
`RuleFigure.css`) at desktop and phone (420px) widths, after discovering and
working around a stale dev-server instance left over from a prior session
(killed it and started a fresh one - not a code defect). By eye: figure 1
shows eight rings and figure 2 four, all reachable by a shaft distinguishable
by shape (open ring) from the six combat figures' solid arrowheads; figures
3-10 each show one arrow spanning exactly the gap `figures.ts` leaves between
attacker and defender (one square in 3/4, two squares with a visibly empty
middle square in 5-10), terminating on the defending piece; the right
piece(s) are struck through and dimmed in each combat figure (one in 5 and
6, both in 7-10) and the rank numeral stays legible on every struck piece
including figure 8's Tower; figures 9 and 10's supporting piece is
unmarked and plainly adjacent to its partner. All five repository checks
(typecheck, lint, test - 945 tests, unchanged since no data changed,
format:check, build) pass. No deviation from the plan's substance; the only
departure from its literal text is drawing the attack arrowhead as a
manually-computed `<polygon>` rather than an SVG `<marker>` element, to avoid
`id` collisions across the ten separately-rendered `RuleFigure` instances on
one page without reaching for `useId` - the visual result (Decision 1's
"solid filled triangular arrowhead") is unaffected.

Add the marker vocabulary to `RuleFigure.tsx` / `RuleFigure.css`, per Decisions
1 and 2:

- **Move marker** — a thin `--ink` arrow from the moving piece to each marked
  destination, ending in an **open ring** on that destination square. Figures 1
  and 2 only (both board figures).
- **Attack marker** — a short, wide `--ink` arrow with a solid triangular head,
  sized per Decision 1 as amended: in the six combat figures it sits **entirely
  within the empty square between the pieces**, about three times the width of
  Step 7's first attempt; in figures 3 and 4 it is two-thirds as long about the
  same centre point, and twice as wide. It touches neither piece.
- **Removal** — the removed piece is drawn **dimmed** and overlaid with a
  **black X** (`--ink`) with a parchment halo, **sitting low enough on the piece
  not to cover the rank numeral in its top-left corner** (Decision 2, story.md
  amendment 4). Figures 5–10.
- Draw order: board squares → arrows → pieces → X. The arrows run **behind** the
  pieces; the X is on top of everything.

All marker geometry is derived from the figure's own data (which squares, which
direction) and from the same lattice Step 6 established — no per-figure
hand-tuned coordinates, so a figure that changes does not silently keep a stale
arrow.

Depends on: Step 6 (the pictures to draw on) and Step 1 (which squares are
marked).

Verification (**manual**). Restart the dev server and open the rules page. Then
run the five repository checks.

- **Gate B.** With the six sentences and the rules in view, read each section:
  - Figure 1 shows **eight** reachable squares, figure 2 **four**.
  - Figures 3 and 4 each mark the enemy piece as attackable, with the same
    marking figures 5–10 use — no second, near-identical marking that reads as
    an unexplained distinction.
  - Figures 5–10 each carry an arrow **filling the empty square between the two
    pieces**, touching neither, and it is wide enough that which piece it points
    at is in no doubt. Figures 3 and 4 carry the same arrow as a shorter stub
    centred between their two pieces.
  - Exactly the right pieces are struck out: **one** in figures 5 and 6,
    **both** in 7, 8, 9 and 10 — and in 9 and 10 the supporting red piece is
    **not** struck out.
  - In figures 9 and 10 the supporting piece still reads as standing beside (9)
    or right behind (10) its partner now that the arrow is present to be
    compared against, and is plainly not what the arrow points at.
  - Nothing in any picture contradicts the sentence above it, and every caption
    says what its picture shows.
- **Legibility.** The black X is legible over a red piece, over a blue piece,
  and where it meets the arrowhead — check figure 5's red rank 1 and figure 6's
  blue rank 2 in particular, since a dark mark over a dark piece is the risk
  that made red unusable. **The X leaves every rank numeral readable**, figure
  8's Tower `T` included. The removed piece is visibly dimmed as well as
  crossed, so the removal survives being read without colour. Squint-test or use
  a greyscale filter: move markers and attack markers are still tellable apart
  by shape alone.
- **Gate C (second pass).** With the real pictures in, re-check the layout at a
  comfortable desktop width, at a narrow width (single column, movement before
  combat), on a short viewport and at phone width — the document scrolls
  normally, nothing is clipped, and no inner scrollbar has crept back in.
- **Gate A (second half).** All ten pictures are present and the page as a whole
  reads as story.md describes it.
- `git diff --stat` shows no forbidden file.

---

## Step 8 — Keyboard and screen reader

Status: pending

Work the page over from the keyboard and with a screen reader, and fix what
that finds. Expected work in this step (do each, and adjust only
`src/app/rules/*` and `src/app/StartScreen*`; `src/App.tsx` should not need to
change again):

- Confirm the focus contract of Decision 9 end to end and correct it if it is
  not exactly right: Tab reaches "How to play" from the start screen;
  activating it navigates to the rules page and moves focus to the page's
  `<h1>`; Tab from there reaches the header's "Back to start" and then runs
  through the document in reading order (left column's three sections before
  the right column's, in every layout), ending on the foot's "Back to start";
  activating either returns to the start screen, whose own heading takes focus.
  Confirm the two identically named buttons are not confusing in practice —
  they are the page's only controls and sit at its two ends — and do **not**
  paper over it with `aria-label`s that contradict the visible text.
- Confirm the page **scrolls from the keyboard** with Page Down / arrow keys
  from anywhere on it — a page, unlike the old modal's inner scroll container,
  should need nothing special for this. If something has been given `overflow`
  by accident, remove it rather than adding a `tabIndex` workaround.
- Confirm every picture is `aria-hidden` and that **no** picture presents itself
  as a table, a grid or a list to be navigated; the caption is the whole of a
  figure's accessible text.
- Confirm the heading structure reads sensibly: one `<h1>` (the page title) and
  six `<h2>` section headings, in DOM order, with nothing skipped.
- Confirm each of the six headings and sentences is read, and that each caption
  conveys the same fact as its picture.
- Confirm the visible focus indicator is clearly visible on the "How to play"
  button and on the "Back to start" button.

Why it comes here: the page's content and layout are settled, so this pass is
about interaction and semantics rather than chasing a moving target.

Depends on: Step 7 (the finished page).

Verification (**manual**) — this is story.md's **Gate D**. With the mouse put
away, walk the whole flow described above from the keyboard alone. Then repeat
with a screen reader (Windows Narrator is this repo's convention — see
`CONTRIBUTING.md`), confirming each bullet above. Record in Notes what was
tested with and anything that had to be adjusted. Then run the five repository
checks.

---

## Step 9 — Nothing else moved, and the README

Status: pending

Two things:

1. **Regression sweep.** Confirm the rest of the app is untouched by this
   story — with particular attention to the shell, since this story added a
   screen to it.
2. **`README.md`.** Update it to mention that the app now explains the basics
   itself — one short addition in the same plain, player-facing register as the
   surrounding text (the intro paragraph mentioning the start screen, and/or a
   "What you can do" bullet). Say **page**, not popup. Keep the existing
   outbound link to the companion rulebook exactly as it is: the README is
   where that link lives, and the rules page deliberately has none. Running
   `/update-readme` (which reviews the branch diff) is the intended way to do
   this; review its output against this step's requirements before accepting
   it.

Depends on: Step 8 (the story's behaviour is final).

Verification (**manual**) — this is story.md's **Gate E**, plus the README
check the plan guide requires. Restart the dev server, then:

- Play a **Skirmish** game, a **Clash** game and a **Battle** game far enough to
  confirm each still sets up (both placements), plays (a move, an attack) and
  can be ended as before, with the rules page nowhere reachable from inside a
  game.
- Open the **review** screen with one of the sample records in `doc/samples/`
  and confirm it is unchanged.
- From a game in progress, use "Back to start" and confirm the existing "leave
  this game?" prompt still behaves as before, and that the start screen it
  returns to shows all four choices.
- Confirm every screen transition still works in both directions: start →
  play → start, start → review → import → review → start, and start → rules →
  start.
- Read the updated `README.md` end to end and confirm it is accurate, in
  register, and still carries the companion-rulebook link.
- Run the five repository checks a final time, and confirm `git diff --stat`
  over the whole branch touches **no** file under `src/rules/`, and none of
  `Board.tsx`, `FullBoard.tsx`, `PlayBoard.tsx` or `AccessibleGrid.tsx` — and
  that its changes to `src/App.tsx` are limited to the new screen (one union
  member, one branch, one extra `StartScreen` prop, plus comment).
