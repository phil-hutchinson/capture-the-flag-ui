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

  | Rank code | Piece | Qty | Position-block symbol |
  |---|---|---|---|
  | 1 | Lord Marshal | 1 | `1` |
  | 2 | Champion | 2 | `2` |
  | 3 | Knight | 4 | `3` |
  | 4 | Infantry | 4 | `4` |
  | 5 | Halberdier | 6 | `5` |
  | 6 | Militia | 6 | `6` |
  | 7 | Skirmisher | 6 | `7` |
  | 8 | Archer | 3 | `8` |
  | 9 | Sapper | 8 | `9` |
  | Special | Assassin | 1 | `A` |
  | — | Tower | 6 | `T` |
  | — | Flag | 1 | `F` |

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
groups the buffer row and lake-row sliver together as one greyed
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

Status: pending

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

Status: pending

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

Status: pending

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

Status: pending

Replace the welcome shell with a board renderer that draws the 12×12 grid for the
**active player** (start with White as the active player for this step). Render
the active player's 4 home rows as an interactive zone at the bottom; above them,
render the neutral buffer row and a **sliver of the nearest lake row** in a greyed,
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
non-interactive buffer row and a sliver of the first lake row above them; lake
squares match `O L L O O L L O O L L O` forming three 2×2 lakes; orientation and
greying look right.

### Step 8 — Piece tray, inventory & click-to-place — Gate B

Status: pending

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

Status: pending

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

Status: pending

Introduce a minimal session model holding both players' placement states and
whose turn it is (White first, then Black). Add to the UI: a placement-progress
readout (e.g. "42 / 48 placed"); a **Confirm** action that stays disabled until
the active player's army is complete (`isComplete`); an **auto-fill/randomize**
button that calls Step 4 to fill only the remaining empty home squares. On
Confirm, the active player's layout is stored in the session and the app
immediately presents the **next** player with an **empty** board from that
player's own (flipped) perspective — the confirm *is* the hand-off; no separate
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

Status: pending

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

Status: pending

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
