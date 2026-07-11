# Implementation Plan — 00000001 Create board layout tool (Phase 1 placement)

This plan implements Phase 1 (secret hot-seat placement) of Capture the Flag as
described in `story.md`. Read `story.md` first; this plan does not restate the
requirements, only how to build them.

## Grounding facts (resolved against the ruleset at plan time)

These were confirmed against the companion repository
`phil-hutchinson/capture-the-flag` (single source of truth). They are stated
here so every step's implementer has them without re-fetching.

- **Ruleset version:** `1.1`. Source: `doc/ruleset/technical-notes.md`
  ("Current version: 1.1 — bumped by Story 00000004"), consistent with
  `doc/ruleset/changelog.md` (Version 1.1, 2026-07-09).
- **Ruleset name / tag:** The record format stamps the ruleset as
  `NAME:VERSION` where `NAME` is `PRIMARY` (the only variant). The tag this
  story's artifact must carry is therefore **`PRIMARY:1.1`**. Source:
  `doc/ruleset/technical-notes.md`, "Record file format" → `Ruleset` tag.
- **Per-type piece counts** (per side; total 48). Source: `rules.md` §2.2
  (v1.1), unchanged since v1.0 per the changelog:

  | Rank code | Piece        | Qty | Position-block symbol |
  | --------- | ------------ | --- | --------------------- |
  | 1         | Lord Marshal | 1   | `1`                   |
  | 2         | Champion     | 2   | `2`                   |
  | 3         | Knight       | 4   | `3`                   |
  | 4         | Infantry     | 4   | `4`                   |
  | 5         | Halberdier   | 6   | `5`                   |
  | 6         | Militia      | 6   | `6`                   |
  | 7         | Skirmisher   | 6   | `7`                   |
  | 8         | Archer       | 3   | `8`                   |
  | 9         | Sapper       | 8   | `9`                   |
  | Special   | Assassin     | 1   | `A`                   |
  | —         | Tower        | 6   | `T`                   |
  | —         | Flag         | 1   | `F`                   |

  Sum = 48. **Do not alter these counts without re-checking the ruleset.**

- **Board geometry (12×12).** Coordinate frame per `rules.md` §4.4: columns
  **A–L** left→right, rows **1–12** where **row 1 is White's back rank** and
  **row 12 is Black's back rank**. Region layout, White edge → Black edge:
  - Rows **1–4**: White home zone (48 squares).
  - Row **5**: neutral buffer (empty, non-placeable).
  - Rows **6–7**: lake rows.
  - Row **8**: neutral buffer (empty, non-placeable).
  - Rows **9–12**: Black home zone (48 squares).
- **Lake pattern** on rows 6 and 7, columns A–L: `O L L O O L L O O L L O`
  (`L` at columns B, C, F, G, J, K). This forms three 2×2 lakes (B–C, F–G,
  J–K across rows 6–7). Lake squares are impassable and never placeable.
- **Position-block format** (used by the serialized artifact, from
  `technical-notes.md`): the full 12×12 board rendered in White's absolute
  frame — row 12 at top, row 1 at bottom, column A at left; 12 lines of 12
  three-character cells separated by single spaces. Cell encoding: White piece
  `[X]`, Black piece `*X*`, empty `---`, lake `XXX`, where `X` is the symbol
  from the table above.
- **Sides / colors.** First player = **White** = **Side A = red
  (`#a13d2b`)**; second player = **Black** = **Side B = blue (`#33526b`)**.
  White/Black are internal turn-order labels; player-facing text uses the
  colors (red / blue) and the word **"move"** (never "ply"). Code, tests, and
  this plan use **"ply"**.

## Architecture approach (read before Step 1)

- **Ruleset-versioned domain core, separate from React.** All rule/terrain/
  inventory/placement/serialization logic is pure TypeScript with no React
  imports, placed under a version-scoped directory (e.g.
  `src/rules/primary/v1_1/`) so a future rules change adds a sibling version
  rather than editing this one. This satisfies CLAUDE.md's "organized per
  ruleset version" constraint and lets the domain be unit-tested in the
  existing `node` vitest environment.
- **No new test infrastructure.** The existing vitest setup uses the `node`
  environment (`vite.config.ts`) with no jsdom / component-testing libraries.
  This plan keeps it that way: the domain core is covered by automated unit
  tests, and all React/UI behavior is verified through the story's five manual
  gates (A–E). Do not add jsdom or a component-testing library for this story.
- **Existing tokens.** `src/index.css` already defines `--parchment`,
  `--ink`, `--side-a` (`#a13d2b`), `--side-b` (`#33526b`). Reuse them.
- **Existing app shell.** `src/App.tsx` currently renders a welcome screen from
  `src/appInfo.ts`. The UI steps replace/extend this shell; keep the app
  building at every step.

---

### Step 1 — Board geometry & terrain model (ruleset v1.1)

Status: committed

Notes: Implemented `src/rules/primary/v1_1/board.ts` (pure TypeScript, no
React) with `Column`/`Row`/`Square`/`Region`/`Side` types, `squareKey`,
`allSquares`, `isLake`, `regionOf`, `isHomeSquareFor`, and `homeSquares`. The
non-lake "O" squares on rows 6-7 are classified as `buffer` (the plan's four
categories don't name a fifth bucket for them, and they behave like the
neutral rows 5/8: non-home, non-lake), matching the Step 7 plan text that
groups the buffer row and the near lake row together as one greyed
non-interactive band. Unit tests in `board.test.ts` cover the required
assertions (12 lake squares forming three 2x2 lakes at B-C/F-G/J-K, 48 home
squares per side, rows 5/8 buffer, White home rows 1-4, Black home rows
9-12) plus a few supporting checks (region/home-square agreement, stable
square keys). No deviations from the plan.

Implement the pure-TypeScript board model under the version-scoped domain
directory: the 12×12 grid, the coordinate frame (columns A–L, rows 1–12; row 1
= White back rank, row 12 = Black back rank), and a classification of every
square into one of: White-home, Black-home, buffer, or lake — using the region
layout and lake pattern in "Grounding facts". Expose helpers to look up a
square's region, whether it is a home square for a given side, and whether it is
a lake, plus the list of the 48 home squares for each side.

Why it comes here: every later step (placement legality, rendering, auto-fill,
serialization) depends on this geometry. It has no dependencies of its own.

Verification (automated): Add unit tests (vitest) asserting: 12 lake squares in
total — columns B, C, F, G, J, K on each of rows 6 and 7 — forming three
separate 2×2 lakes (B–C, F–G, J–K); each side has exactly 48 home squares; rows
5 and 8 are buffer; White home = rows 1–4, Black home = rows 9–12. Run
`npm test`.

### Step 2 — Piece catalog & army inventory (ruleset v1.1)

Status: committed

Notes: Implemented `src/rules/primary/v1_1/pieces.ts` (pure TypeScript, no
React) with `PieceTypeId`, `RankCode`, `PositionBlockSymbol`,
`PieceCatalogEntry`, `PIECE_TYPES`, `PIECE_CATALOG`, `pieceCatalogEntries`,
`ARMY_SIZE`, and `freshInventory`. Tower and Flag are modeled with
`rankCode: null` (the table's "—") rather than a literal shared string,
since two pieces both lacking a rank isn't the same as sharing one; the
"distinct rank code" test therefore checks distinctness only among the ten
pieces that do carry a rank code (1-9 and Assassin's `"special"`), plus a
separate assertion that Tower and Flag are exactly the two unranked types.
Position-block symbols (all 12) are asserted fully distinct, matching the
plan's table. Unit tests in `pieces.test.ts` cover per-type quantities
against the ruleset table, the 48 total, symbol/rank-code distinctness,
non-empty display names, and `freshInventory` returning a fresh full-48
inventory each call. `npm run typecheck`, `npm run lint`, `npm run
format:check`, and `npm test` all pass. No other deviations from the plan.

Implement, in the same version-scoped domain directory, the catalog of the 12
piece types with their rank code, position-block symbol, and per-side quantity
from the "Grounding facts" table, plus a function that builds a fresh full
inventory (a full 48-piece army as remaining-count-per-type). Include the
player-facing display name for each type (for the tray later).

Why it comes here: placement, tray, auto-fill, and serialization all consume the
piece catalog and the fresh-army inventory. Depends only on nothing (independent
of Step 1) but is grouped with the domain core.

Verification (automated): Unit tests asserting each type's quantity equals the
table, the total across all types is exactly 48, and every type has a distinct
rank code and symbol. Run `npm test`.

### Step 3 — Placement state model & core operations

Status: committed

Notes: Implemented `src/rules/primary/v1_1/placement.ts` (pure TypeScript, no
React) with a `PlacementState` (`side` + `placements: ReadonlyMap<string,
PieceTypeId>` keyed by `squareKey` + derived `remaining: Inventory`),
`emptyPlacement`, `pieceAt`, and the five operations `place`/`move`/`swap`/
`returnToTray`/`clear`, plus derived queries `remainingCount`, `placedCount`,
`progress` (`{ placed, total }`), and `isComplete`. All five operations
reuse `isHomeSquareFor` from Step 1's board model to structurally reject any
square outside the state's own side's home zone (lake, buffer, or the
opponent's zone), and reject other invariant violations (occupied/empty
squares, zero-remaining placement) by throwing an `Error` rather than
silently no-op'ing — a deliberate, documented choice since the plan's wording
("must reject") was open to interpretation and the UI (Steps 7+) will only
ever offer legal squares as interactive targets, making these true
programming-invariant violations rather than recoverable user errors. Unit
tests in `placement.test.ts` (20 tests) cover every required case: place
decrements remaining/occupies the square and rejects non-home/occupied/
zero-remaining squares; move/swap preserve remaining counts and reject
empty/occupied/non-home squares; returnToTray increments remaining and
rejects empty/non-home squares; clear empties the board and restores the
full 48-count inventory; isComplete is true only at 48/48; progress reports
placed/48 accurately as pieces are placed. `npm run typecheck`, `npm run
lint`, `npm run format:check`, and `npm test` all pass (41 tests total,
repo-wide). No other deviations from the plan.

Implement a pure placement-state model for one player: a mapping of that
player's home squares → placed piece type (or empty), plus a derived
remaining-inventory. Implement operations that return new state (immutable
style): place a piece type onto an empty home square, move a placed piece to
another (empty) home square, swap two placed pieces, return a placed piece to
the tray, and clear the whole board back to the tray. Include derived queries:
remaining count per type, total placed / total (48) progress, and
`isComplete`. All operations must reject squares that are not the player's own
home squares (lakes, buffers, and the opponent's zone are structurally illegal),
and placement must respect remaining counts (cannot place a type with zero
remaining).

Why it comes here: this is the interaction engine the UI (Steps 8–10) drives and
the serializer (Step 5) reads. Depends on Steps 1 (home-square set, legality)
and 2 (inventory).

Verification (automated): Unit tests covering: place decrements remaining and
occupies the square; placing on a non-home square is rejected; move/swap
preserve counts; return-to-tray increments remaining; clear empties the board
and restores the full 48-count inventory; `isComplete` is true only when all 48
home squares are filled; progress reports placed/48 correctly. Run `npm test`.

### Step 4 — Auto-fill / randomize

Status: committed

Notes: Added `autoFill(state, random = Math.random)` to
`src/rules/primary/v1_1/placement.ts`, plus an exported `RandomSource` type
(`() => number`, matching `Math.random`'s shape). It collects the side's
currently-empty home squares and the remaining pieces (expanded to one entry
per remaining unit), Fisher-Yates-shuffles both lists with the injected
`random` source, then places them 1:1 via the existing `place` operation (so
it inherits `place`'s own-home-square/occupied/remaining-count checks rather
than duplicating them). Defaults to `Math.random` so the UI (Step 10) gets
fresh randomness on each click with no extra wiring, while tests inject a
seeded generator for determinism. Added 5 unit tests to
`placement.test.ts` (using a small seeded LCG test helper, not a
dependency) covering: empty-board auto-fill yields a complete, count-correct
army; no piece ever lands on a lake/buffer square; already-placed pieces are
left untouched and only empty squares are filled; a fixed seed reproduces the
identical layout; and Black's auto-fill doesn't touch White's squares. `npm
run typecheck`, `npm run lint`, and `npm test` all pass (46 tests total,
repo-wide); `npm run format:check` also passes for both files touched (two
pre-existing markdown formatting warnings in this story's own `story.md` and
`implementation-plan.md` predate this step and are unrelated to it). No
deviations from the plan.

Implement an auto-fill operation on the placement-state model that fills **only
the currently-empty** home squares using the remaining pieces, never touching
lakes/buffers/opponent squares and always respecting remaining counts, leaving
already-placed pieces untouched. From a complete-army starting inventory this
must always fully complete the board. Support a seeded/injectable randomness
source so the operation is deterministic under test while still random in the
UI.

Why it comes here: it is a placement operation and the UI auto-fill button
(Step 10) calls it. Depends on Step 3.

Verification (automated): Unit tests asserting: from an empty board, auto-fill
yields a complete, count-correct placement with no piece on a lake/buffer; from
a partially-filled board, previously-placed pieces are unchanged and only empty
squares get filled; with a fixed seed the result is reproducible. Run
`npm test`.

### Step 5 — Versioned initial game-state serialization

Status: committed

Notes: Added `src/rules/primary/v1_1/gameState.ts` (pure TypeScript, no
React) with `RULESET_TAG` (`"PRIMARY:1.1"`), the `PlacedPiece`/`BoardState`/
`InitialGameState` types, `buildInitialGameState(white, black)` (combines two
completed `PlacementState`s into a single plain, JSON-serializable board
keyed by `squareKey` in White's absolute frame; throws if either state is
the wrong side or incomplete - both are structural invariants by the point
this is called, matching Step 3's own error-vs-no-op precedent), and
`renderPositionBlock(gameState)` (renders any `InitialGameState.board`,
complete or not, to the 12x12 position-block text form). `InitialGameState`
is intentionally the _only_ new artifact type - no separate "record file"
model was introduced, since the step explicitly must anticipate the replay
record format without implementing it; the `ruleset` tag and board shape are
the anticipation point. Added `gameState.test.ts` (8 tests) covering: the
artifact carries `PRIMARY:1.1`; a full JSON round-trip (`JSON.parse(JSON.
stringify(...))`) of two auto-filled armies reproduces both armies exactly,
square-by-square, with no square outside the 96 home squares populated;
wrong-side and incomplete-army inputs are rejected; per-type counts in the
artifact match the catalog; a hand-constructed sparse four-piece placement
(not a full army, so the expected 12-line block could be verified by
inspection) renders to an exact expected position-block string covering a
White piece, a Black piece, empty squares, and both lake rows; the block is
always 12 lines of 12 three-char cells; and lake squares render `XXX`
regardless of nearby placements. `npm run typecheck`, `npm run lint`, and
`npm test` all pass (54 tests total, repo-wide); `npm run format:check`
passes for both files touched (the two pre-existing markdown warnings on
this story's own `story.md`/`implementation-plan.md` predate this step, per
Step 4's notes). No deviations from the plan.

Implement serialization of a completed setup (two completed placement states,
one per player) into a versioned initial game-state artifact tagged
`PRIMARY:1.1`. Produce two representations: (a) an inspectable JSON structure
capturing both armies keyed by absolute square (White frame), the ruleset tag,
and enough structure that Phase 2 / replay can build on it without a rewrite;
and (b) the position-block text render described in "Grounding facts"
(White-absolute frame, `[X]` / `*X*` / `---` / `XXX`). This must anticipate the
replay record format from the companion `technical-notes.md` but must not
implement replay itself.

Why it comes here: this is the "not throwaway" output of the story (in-scope
item 9) and the input to the end-state artifact (Step 11). Depends on Steps 1
(geometry / symbols), 2 (symbols), and 3 (completed placement state).

Verification (automated): Unit tests asserting: the artifact carries
`PRIMARY:1.1`; the JSON round-trips both armies exactly; the position block is
12 lines × 12 three-char cells, lakes render as `XXX` at the correct squares,
White pieces as `[X]` and Black as `*X*`, and a hand-constructed known placement
renders to the exact expected block. Run `npm test`.

### Step 6 — Piece sprite sheet (re-tokenized glyphs pulled into the repo)

Status: committed

Notes: Added `src/art/pieceSprites.svg` — a `<defs>`-only sprite sheet
carrying the 12 piece `<symbol>`s plus `p-lake` from
`.local/ctf-tile-prototype.svg`, unchanged in shape. Re-tokenized only the
four cutout colors (Champion's blade fuller, Knight's eye + mouth circle and
line, Infantry's shield cross-lines, Tower's doorway) from literal
`#e8dfc8` to `var(--parchment)`; left `currentColor` (already used for every
side-varying fill/stroke) and the two fixed accents (Marshal's gold boss
`#a67c2e`, lake wave strokes `#3f7b8a`) untouched. Side-color tokenization
(`var(--side-a)`/`var(--side-b)`) is applied by the consumer, not baked into
the defs: added `src/art/PieceIcon.tsx` with `PieceSpriteDefs` (mounts the
sheet's raw markup into the DOM once, via a Vite `?raw` import, for later
steps to render near the app root) and `PieceIcon` (draws one piece's
`<use>`, with `color` set to `var(--side-a)` for white / `var(--side-b)` for
black), plus an exported `LAKE_SYMBOL_ID` constant for Step 7's direct
terrain use. Did not wire `PieceSpriteDefs` into `App.tsx` — mounting it is
tied to replacing the welcome shell, which is Step 7's scope, not this
step's; `PieceIcon` is otherwise complete and ready for Steps 7-8 to consume.
Updated the `src/index.css` header comment to describe the cutouts as
referencing `--parchment` directly rather than being coupled to a frozen
literal. Added `src/art/pieceSprites.test.ts` (5 tests) asserting: all 13
symbol ids are present; no literal `#a13d2b`/`#33526b`; no literal
`#e8dfc8`; the four cutout occurrences (1 in Champion, 2 in Knight, 1 in
Infantry, 1 in Tower) reference `var(--parchment)`; and the two fixed
accents remain literal. One deviation from the plan's literal verification
wording: used a Vite `?raw` import of the `.svg` (typed by `vite/client`,
already referenced in `src/vite-env.d.ts`) to read the sprite source in the
test, rather than `node:fs`, since `@types/node` is not an existing
dependency and this repo's toolchain doesn't otherwise need Node's type
declarations; `?raw` imports work identically under vitest's `node` test
environment since the transform is asset-level, not DOM-dependent. `npm run
typecheck`, `npm run lint`, and `npm test` all pass (59 tests total,
repo-wide); `npm run format:check` passes for all files touched (the two
pre-existing markdown warnings on this story's own `story.md`/
`implementation-plan.md` predate this step, per Steps 4-5's notes).

Bring the prototype glyphs from `.local/ctf-tile-prototype.svg` into the repo as
a reusable SVG symbol sheet plus a small React `PieceIcon` component that renders
one symbol by piece type and side. Copy the 12 piece `<symbol>`s and the `p-lake`
terrain symbol (13 symbols total); **do not create new glyphs**. Re-tokenize the
literal colors per the story's themeability constraint and
`.local/ctf-tile-prototype.md`:

- Side color: each `<use>`'s `color` is driven by `var(--side-a)` (red / White)
  or `var(--side-b)` (blue / Black); glyph interiors already use `currentColor`.
- The four `#e8dfc8` **cutout** colors (Champion blade fuller, Knight eye+mouth,
  Infantry shield cross-lines, Tower doorway) must reference the board-background
  variable (the existing `--parchment`) so they always track the actual board
  color rather than a frozen literal.
- Leave the deliberately-fixed accents literal: the Marshal boss gold
  (`#a67c2e`) and the lake wave stroke (`#3f7b8a`).
  Update the note in `src/index.css` (which currently says parchment is coupled to
  the cutouts) to reflect that the cutouts now reference the variable.

Why it comes here: the board renderer (Step 7) and tray (Step 8) both render
these icons. Depends on nothing in earlier steps but must precede the UI steps.

Verification (automated): A test/script asserts the committed sprite source
contains all 13 expected `<symbol>` ids, contains **no** literal `#e8dfc8`,
`#a13d2b`, or `#33526b`, and that the four cutout fills reference the background
variable. (Visual correctness of the icons is confirmed later under Gate B.) Run
`npm test`.

### Step 7 — Board renderer from the active player's perspective — Gate A

Status: committed

Notes: Added `src/board/boardView.ts` (pure TypeScript, no React) exposing
`visibleRows(side)` and `visibleColumns(side)`, which map the domain board
model onto one player's cropped screen view: for White (un-rotated, i.e. the
absolute frame from `rules.md` §4.4) the visible rows top-to-bottom are `[6
(lake-row), 5 (buffer), 4, 3, 2, 1 (home, back rank last)]` and columns
run `A...L`; for Black (180° rotation, both axes reversed) rows are `[7
(lake-row), 8 (buffer), 9, 10, 11, 12 (home, back rank last)]` and
columns run `L...A`. Added `src/board/Board.tsx` (`Board` component, prop
`activeSide: Side`) and `src/board/Board.css`, which render a CSS grid sized
by a single `--square` custom property: all six visible rows (the full near
lake row, the buffer row, and the four home rows) are full-square tracks
(`grid-template-rows: repeat(6, var(--square))`), so the near lake row shows
in full rather than as a clipped sliver — updated per the owner's Gate A
feedback that a full lake row reads better than the earlier half-row sliver.
Lake squares (via `isLake` from Step 1's board model) additionally draw the
`p-lake` sprite (`LAKE_SYMBOL_ID` from Step 6); the buffer and lake-row rows
share a greyed, `pointer-events: none` style, while home-row cells get a plain
parchment/interactive look (`cursor: pointer`) though no click handler is
wired yet (that is Step 8's scope). Replaced the welcome shell:
`src/App.tsx` now mounts `PieceSpriteDefs` once near the root and renders
`<Board activeSide="white" />` under a small title (`src/App.css`, new);
removed the now-unused `.welcome` rules from `src/index.css`. Added
`src/board/boardView.test.ts` (5 unit tests, pure logic, no jsdom — asserts
the row/column orders above and that neither side's view includes the
opponent's home rows), consistent with earlier steps' pattern of unit-testing
pure domain/view logic. `npm run typecheck`, `npm run lint`, `npm test` (64
tests, repo-wide), and `npm run build` all pass; `npm run format:check`
passes for every file touched this step (the two pre-existing markdown
warnings on this story's own `story.md`/`implementation-plan.md` predate
this step, per Steps 4-6's notes). Verified `npm run dev` serves the app at
HTTP 200 with the new module graph loading correctly. Gate A was confirmed by
the owner in the running app after the near lake row was changed from a 0.32×
clipped sliver to the full nearest lake row (6 full rows) per owner feedback
that the full row reads better; the story and this plan were adjusted to
match. One
minor deviation from the plan's literal wording: added the `boardView.test.ts`
unit tests, which the plan did not explicitly request for this step (its
verification section is manual-only) — done because the row/column mapping
is pure, non-React logic exactly like earlier steps' domain code, and the
plan's "no new test infrastructure" constraint is about jsdom/component
testing, not about withholding plain vitest tests from pure logic.

Replace the welcome shell with a board renderer that draws the 12×12 grid for the
**active player** (start with White as the active player for this step). Render
the active player's 4 home rows as an interactive zone at the bottom; above them,
render the neutral buffer row and the **full nearest lake row** in a greyed,
non-interactive style as a visual reminder of the lakes; do not render the
opponent's zone. Orient/flip the board so the active player's home zone is in
front of them (a 180° rotation of the absolute frame for Black; White is
un-rotated). Draw lake squares using the `p-lake` sprite from Step 6. No pieces or
placement interaction yet — this step is board geometry and terrain only.

Why it comes here: it is the visual foundation the tray and placement interactions
sit on. Depends on Steps 1 (geometry) and 6 (lake sprite). The 180° flip is
verified for real only once Black becomes active in Step 10, but the White view is
fully checkable now.

Verification (manual — Gate A): Run `npm run dev` and confirm from the active
(White) player's view: 4 interactive-looking home rows at the bottom; the greyed,
non-interactive buffer row and the full nearest lake row above them; lake
squares match `O L L O O L L O O L L O` forming three 2×2 lakes; orientation and
greying look right.

### Step 8 — Piece tray, inventory & click-to-place — Gate B

Status: committed

Notes: Added `src/board/Tray.tsx` + `src/board/Tray.css` — a `Tray` component
rendering one row per piece type (in `pieceCatalogEntries()` order) as a
native `<button>`: real `PieceIcon` (colored for the active side), display
name, and a live remaining-count badge sourced from `PlacementState.
remaining`. Clicking a type with `count > 0` selects it (`aria-pressed`,
highlighted via `tray__item--selected`); clicking the already-selected type
deselects it; a type at zero remaining is shown (so its full-army count
stays visible) but `disabled` so it cannot be selected. Extended
`src/board/Board.tsx` (Step 7's board) with two new optional props:
`placement` (a `PlacementState` — when given, each home square renders its
placed piece, if any, via `PieceIcon`) and `onSquareClick` (wired only onto
`band === "home"` cells, since buffer/lake-row cells are already
non-interactive per Step 7's CSS `pointer-events: none`; this keeps illegal
squares structurally non-clickable rather than validated after the fact).
Added a small `board-square__piece-icon` CSS rule (`Board.css`) sizing the
placed-piece icon to fill the square, mirroring the existing lake-icon rule.
Wired it together in `src/App.tsx`: local `useState` for a single active
player's `PlacementState` (`emptyPlacement("white")`, matching Step 7's
hardcoded White-only shell — the two-player session model is Step 10's
scope) and the currently-selected `PieceTypeId | null`. `handleSquareClick`
ignores clicks with no type selected and clicks on already-occupied squares
(interacting with a placed piece — move/swap/return-to-tray — is Step 9's
scope, not this step's), otherwise calls Step 3's `place` and auto-clears
the selection once that type's remaining count hits zero. Added a
`.app__layout` flex row (`App.css`) to lay the board and tray side by side.
`npm run typecheck`, `npm run lint`, `npm test` (64 tests, unchanged — this
step added no new pure-logic tests since it is pure React wiring over
already-unit-tested domain operations, consistent with the plan's "all
React/UI behavior is verified through the manual gates" constraint), `npm
run build`, and `npm run format:check` all pass (the two pre-existing
markdown warnings on this story's own `story.md`/`implementation-plan.md`
predate this step, per Steps 4-7's notes). Confirmed `npm run dev` serves
the app at HTTP 200. No deviations from the plan; Gate B itself remains for
the owner to confirm manually (real icons/counts against the ruleset in
practice, click-to-select then click-to-place, lake/buffer squares inert).

Gate B refinement (owner feedback): the piece icons were missing the top-left
corner rank code the prototype shows. Added it to `PieceIcon`
(`src/art/PieceIcon.tsx`) as a `<text>` overlay drawn alongside the `<use>`
(`x=15 y=17`, `font-size=18`, Times New Roman 700, `text-anchor="end"`,
`fill="currentColor"` so it tracks the side color), rendering
`PIECE_CATALOG[type].symbol` (the position-block symbol `1`-`9`/`A`/`T`/`F`,
which equals the prototype's "corner code"). This corner numeral is
deliberately separate overlay markup, not part of the `<symbol>`; Step 6's
sprite sheet correctly did not carry it. The size/font values match the
tuned `class="badge"` `<text>` in the prototype sample sheet
(`.local/ctf-tile-prototype.svg`) rather than the stale numbers in
`.local/ctf-tile-prototype.md` (which said 32px/Georgia — the sheet actually
uses 18px/Times New Roman). It is not automatically tested (SVG render, verified under Gate B). Since
every `PieceIcon` flows through this component, the badge appears on both the
tray and the placed board pieces.

Add the piece tray/inventory panel showing every piece type with the real icon
(Step 6, in the active player's side color) and a live remaining count driven by
the placement-state model (Step 3). Implement the primary interaction:
click-to-select a piece type in the tray, then click an empty home square to
place it; the placed icon appears on the board and the tray count decrements.
Illegal squares (lakes, buffer, and — structurally — everything outside the
active player's home zone) are non-interactive, so illegal placement cannot
happen. Drag-and-drop is explicitly out of scope; click is the only interaction.

Why it comes here: it is the core placement loop and the heart of the story.
Depends on Steps 3 (placement operations), 6 (icons), and 7 (interactive board).

Verification (manual — Gate B): Run `npm run dev` and confirm: every piece type
appears with the correct count (this also confirms the inventory counts against
the ruleset in practice), rendered with the real icons on the board background;
selecting a type then clicking an empty home square places it and decrements the
count; clicking a lake/buffer square does nothing.

### Step 9 — Interacting with placed pieces — Gate C

Status: committed

Notes: Wired `move`/`swap`/`returnToTray`/`clear` (Step 3) into the UI. Click
grammar (documented in a header comment in `src/App.tsx`): selection is one
of two mutually-exclusive tracks - a tray type (`trayType`, Step 8, unchanged)
or an already-placed piece picked up from the board (`boardSquare`, new this
step) - selecting one always clears the other. Clicking an _occupied_ home
square always acts on the board-selection track regardless of any pending
tray selection: nothing selected yet -> selects that square; the same square
already selected -> deselects it; a _different_ square already selected ->
swaps the two pieces and clears the selection. Clicking an _empty_ home
square: a tray type selected -> places it (unchanged); a board square
selected -> moves that piece there and clears the selection; nothing
selected -> no-op. Return-to-tray and clear-all have no natural
second-square-click expression (empty-square-click already means "move
here" and occupied-square-click already means "swap"), so they are explicit
buttons in a new `src/board/PlacementControls.tsx` (+ `.css`) panel rendered
below the board: while a board piece is selected it shows the selected
piece's icon/name plus "Return to tray" / "Cancel" buttons; a "Clear board"
button (disabled once the board is empty, via `placedCount`) is always
present. Extended `src/board/Board.tsx` with an optional `selectedSquare`
prop, highlighting that square (new `.board-square--selected` rule in
`Board.css`, an inset `box-shadow` matching the tray's existing selected
style) so the player can see which placed piece is picked up; `Board.tsx`
itself stays unaware of the click grammar, only rendering whichever square
is passed in. `src/App.tsx` now owns a `Selection` union
(`{kind:"trayType",...} | {kind:"boardSquare",...} | null`) instead of the
Step 8 bare `PieceTypeId | null`, and derives `Tray`'s `selectedType` /
`Board`'s `selectedSquare` / `PlacementControls`' `selectedPieceType` from
it. `npm run typecheck`, `npm run lint`, `npm test` (64 tests, unchanged -
this step is pure React wiring over already-unit-tested Step 3 operations,
same rationale as Step 8), `npm run build`, and `npm run format:check` all
pass (the two pre-existing markdown warnings on this story's own
`story.md`/`implementation-plan.md` predate this step, per Steps 4-8's
notes); confirmed `npm run dev` serves the app at HTTP 200. No deviations
from the plan's requirements; the click grammar itself (which specific
clicks map to which of the four operations, and using explicit buttons for
return-to-tray/clear-all rather than a click sequence) is a design choice
made in the course of implementing this step, documented above and in
`App.tsx`'s header comment. Gate C itself remains for the owner to confirm
manually (move, swap, return-to-tray, and clear-all each behave correctly).

Gate C fix (owner feedback): selecting a placed piece opened a jarring empty
gap beside the board and reflowed/shrank the centered layout, because
`.app__board-column` had no width and grew to fit the wide selection-controls
row. Pinned `.app__board-column` to `width: min-content` (the board's own
fixed width) so the controls wrap within the board's width instead of
widening the column, and added `min-width: 0` to `.placement-controls__label`
so its text wraps rather than forcing the row wide. Owner confirmed the gap is
gone. No functional change.

Wire the remaining placement operations from Step 3 into the UI: move a placed
piece to another empty home square, swap two placed pieces, return a placed piece
to the tray, and a clear-all-board action that returns every placed piece to the
tray. Define and implement the click grammar for these (e.g. selecting a placed
piece then clicking a destination) so all four behaviors are reachable with clicks
only.

Why it comes here: it completes the manipulation of an in-progress layout on top
of the placement loop. Depends on Steps 3 and 8.

Verification (manual — Gate C): Run `npm run dev` and confirm move, swap,
return-to-tray, and clear-all each behave correctly (counts stay consistent, no
piece ends on a lake/buffer, clear-all empties the board and restores full tray
counts).

### Step 10 — Completion, confirm-as-hand-off & auto-fill — Gate D

Status: committed

Notes: Added `src/board/placementSession.ts` (pure TypeScript, no React): a
`PlacementSession` holding both sides' own `PlacementState` (Step 3) plus
`active: Side | null` (White first, then Black, `null` once both have
confirmed - there is nobody left to hand off to). `newSession()` builds the
starting session; `activePlacement`/`updateActivePlacement` read/write only
the active side's own placement (throwing if the session is already
complete); `confirmActive` is the hand-off itself - it requires the active
side's placement to be `isComplete` (Step 3), then advances `active` to the
other side (White -> Black) or to `null` (Black -> nobody, i.e. session
complete), without ever touching either side's stored `PlacementState`
directly (the next side's board is simply whatever `PlacementState` it
already had - untouched-and-empty the first time it becomes active). Added
`src/board/placementSession.test.ts` (9 tests) covering: a fresh session
starts White-active with both boards empty; `activePlacement`/
`updateActivePlacement` only ever touch the active side and throw once the
session is complete; `confirmActive` rejects an incomplete army, hands off
White -> Black leaving Black's board provably empty and White's completed
`PlacementState` untouched (`toBe` identity check), completes the session
(`active` becomes `null`) once Black also confirms, and throws if confirmed
again afterward. Added `src/board/PlacementStatus.tsx` + `.css`: a new
session-level action bar (distinct from Step 9's per-selection
`PlacementControls`) showing the active side's player-facing color name
("Red"/"Blue" - the internal White/Black labels never appear in player-facing
text), a live "N / 48 placed" readout (`progress`), an "Auto-fill" button
(calls Step 4's `autoFill`), and a "Confirm" button disabled until
`isComplete`. Rewired `src/App.tsx` off the Step 8/9 single hardcoded
`ACTIVE_SIDE`/local `PlacementState` onto the new session: a `PlacementSession`
`useState` replaces the bare `PlacementState` one, every existing
place/move/swap/return/clear handler is routed through
`updateActivePlacement` so it only ever mutates the active side's own layout,
and two new handlers - `handleAutoFill` and `handleConfirm` - call `autoFill`
and `confirmActive` respectively; both also reset the local click-selection
state, since a selection from one player's board must never carry over to the
next player's (this is the "zero trace" requirement from the gate). When
`session.active` is `null` (both confirmed), `App` renders a minimal
placeholder ("Both players have placed their armies. Setup is complete.")
instead of the board/tray - a deliberate stub, not the real neutral end
state: Step 11 owns building the actual "both armies ready" screen and the
inspectable serialized artifact on top of this session, per its own scope in
this plan. `npm run typecheck`, `npm run lint`, `npm test` (73 tests,
repo-wide - 9 new), and `npm run build` all pass; `npm run format:check`
passes for every file touched this step (the two pre-existing markdown
warnings on this story's own `story.md`/`implementation-plan.md` predate this
step, per Steps 4-9's notes). Confirmed `npm run dev` serves the app at HTTP 200. One wording deviation from the plan's literal text: player-facing copy
says "Red's turn to place their army" rather than using the word "move" -
CLAUDE.md's "move" vocabulary rule specifically concerns the ply/move
distinction from Phase 2 movement, which does not apply during placement (a
literal "Red's move" would misleadingly suggest a Phase 2 piece move); "turn"
is a plain, non-technical English word suited to describing hot-seat
hand-off and was used instead. No other deviations from the plan. Gate D
itself remains for the owner to confirm manually (Confirm disabled until
full with an accurate progress count; auto-fill fills only empty home
squares, never lakes, respecting counts; and confirming as White hands off to
Black's empty board, flipped to Black's perspective, with zero trace of
White's pieces).

Gate D fix (owner feedback): the Auto-fill button is now disabled once the
army is fully placed (`progress.placed >= progress.total`), since there are no
empty squares left for it to fill. Purely a `disabled` guard in
`PlacementStatus.tsx` using the already-passed `progress` prop; no wiring
change.

Introduce a minimal session model holding both players' placement states and
whose turn it is (White first, then Black). Add to the UI: a placement-progress
readout (e.g. "42 / 48 placed"); a **Confirm** action that stays disabled until
the active player's army is complete (`isComplete`); an **auto-fill/randomize**
button that calls Step 4 to fill only the remaining empty home squares. On
Confirm, the active player's layout is stored in the session and the app
immediately presents the **next** player with an **empty** board from that
player's own (flipped) perspective — the confirm _is_ the hand-off; no separate
privacy interstitial. Player-facing text refers to sides by color and uses
"move," not "ply."

Why it comes here: it turns the single-player placement tool into the two-player
hot-seat flow and is the first point the Black-perspective flip (Step 7) is
exercised for real. Depends on Steps 4 (auto-fill), 3 (isComplete/progress), and
7–9 (the placement UI).

Verification (manual — Gate D): Run `npm run dev` and confirm: Confirm is disabled
until the board is full and the progress count is accurate; auto-fill fills only
empty home squares, never lakes, respecting remaining counts; and confirming as
White hands off to Black's empty board, flipped to Black's perspective, with zero
trace of White's pieces.

### Step 11 — End-to-end session, end state & inspectable artifact — Gate E

Status: committed

Notes: Added `src/board/SessionComplete.tsx` + `.css`, rendered by
`src/App.tsx` in place of Step 10's minimal placeholder whenever
`session.active === null` (both players have confirmed). It never renders a
`Board` or either side's raw `PlacementState`, so the screen stays neutral
and reveals neither layout — it only shows the fixed "Both players have
placed their armies. Setup is complete." notice. Below that, it builds the
Step 5 artifact via `buildInitialGameState(session.white, session.black)`
(memoized with `useMemo`) and surfaces it as a developer-facing affordance:
a collapsed `<details>` disclosure (`"Developer: inspect initial game
state"`) containing the `ruleset` tag (`PRIMARY:1.1`), the position-block
text render (`renderPositionBlock`), and a read-only `<textarea>` holding
the full `JSON.stringify(gameState, null, 2)` (selectable/copyable natively,
satisfying the story's "view/copy" wording without adding a Clipboard-API
button); the same artifact is also `console.log`ged once per game-state
change via `useEffect`, giving a second, always-available inspection path.
Removed the now-unused `.app__complete-notice` CSS rule from `App.css`
(superseded by `SessionComplete.css`). `npm run typecheck`, `npm run lint`,
`npm test` (73 tests, unchanged — this step is pure React wiring over the
already-unit-tested Step 5 serializer, same rationale as Steps 8-10), `npm
run build`, and `npm run format:check` all pass (the two pre-existing
markdown warnings on this story's own `story.md`/`implementation-plan.md`
predate this step, per Steps 4-10's notes); confirmed `npm run dev` serves
the app at HTTP 200. No deviations from the plan. Gate E remains for the
owner to confirm manually: a full run-through (White places/confirms, Black
places/confirms, landing on this neutral end state with neither layout
rendered) and that the disclosed artifact is inspectable, tagged
`PRIMARY:1.1`, and matches the two armies just placed.

Complete the flow: after the second player (Black) confirms a complete army, land
on a neutral **"both armies ready"** end state that reveals **neither** layout
(no reveal in this story). At that point produce the versioned initial game-state
artifact from Step 5 (both armies, tagged `PRIMARY:1.1`) and make it inspectable
via a developer-facing affordance (at minimum a JSON dump the owner can view/copy,
e.g. on the end-state screen or console). Ensure the artifact is the foundation
Phase 2/replay will build on.

Why it comes here: it is the terminal state and the story's tangible output.
Depends on Steps 5 (serialization) and 10 (session / both placements).

Verification (manual — Gate E): Run `npm run dev` for a full run-through: White
places (optionally via auto-fill) and confirms, then Black places and confirms,
landing on the neutral "both armies ready" state with neither layout revealed;
open the produced artifact and confirm it is inspectable, tagged `PRIMARY:1.1`,
and matches the two armies just placed. (Individual interactions covered by Gates
A–D need not be re-tested here.)

### Step 12 — README accuracy check

Status: committed

Notes: Updated `README.md` via the `/update-readme` review. The "What you can
do" section's first bullet, which implied full friend-vs-friend play, now reads
"Set up a game with a friend … take turns secretly placing your 48-piece army …
When both armies are placed, the game is ready for battle," and a new "Fight the
battle _(coming next)_" bullet was added so the battle phase is clearly not yet
built. The Status line changed from "Nothing playable yet" to "you can now set
up a game by placing both armies. The battle phase itself is still being built."
Replay _(coming soon)_ and AI _(planned)_ bullets were left unchanged — still
accurate. Scope was deliberately not overstated: Phase 2 play, AI, and replay
remain marked as future. Separately, ran `prettier --write` on this story's own
`story.md` and `implementation-plan.md` to clear the two long-standing
markdown-formatting warnings (formatting only — emphasis-marker style, table
column padding, blank-line normalization; no content changes), so the whole
repository now passes `format:check` cleanly. Closing verification: `npm run
typecheck`, `npm run lint`, `npm run format:check` (fully clean), and `npm test`
(73 tests) all pass. No deviations from the plan.

Review `README.md` against the changes in this story and update it if warranted.
The current README says "early days … Nothing playable yet"; after this story,
local two-player Phase 1 placement is playable, so the status/"What you can do"
section likely needs adjusting. Use the `/update-readme` command (it reviews the
branch diff and updates `README.md` if warranted), or confirm no change is
needed. Do not overstate scope — Phase 2 play, AI, and replay remain unbuilt.

Why it comes here: it is the standard closing documentation check and depends on
the full feature set being in place. Depends on Steps 1–11.

Verification (automated): Run `/update-readme`; confirm the resulting `README.md`
accurately reflects that placement is now playable and nothing beyond this story
is claimed. Then run `npm run typecheck`, `npm run lint`, `npm run format:check`,
and `npm test` to confirm the whole repository is clean.
