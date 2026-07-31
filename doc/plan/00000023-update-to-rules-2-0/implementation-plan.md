# Implementation Plan — Story 00000023: Update to rules 2.0

This plan takes the app from **rules 1.2** (`1-2:PRE-RELEASE`, internally tagged
`1.2:PRE-RELEASE`) to **rules major 2**, editions **`2-0:BATTLE`** and
**`2-0:SKIRMISH`**. It is a **go-forward replacement, not an addition**: the
major-1 rule code is replaced, no `1.2:PRE-RELEASE` compatibility is kept, and
the old records deliberately stop being reviewable. Read `story.md` in this
folder in full before starting any step — its **Policy (fixed by the owner)**,
**In scope / Out of scope**, and **Design decisions** sections are fixed and are
not re-litigated here.

## Grounding facts (read once — applies to every step)

The single source of truth is the companion `capture-the-flag` repository. The
major-2 rules are **not yet on that repo's `main`**: they live on branch
`feat/34-rule-change-allow-diagonal-attack-and-board-sizing` (that repo's story
00000034). Fetch the raw text from that branch if a step needs to re-check a
detail:

- `gh api "repos/phil-hutchinson/capture-the-flag/contents/doc/ruleset/rules.md?ref=feat/34-rule-change-allow-diagonal-attack-and-board-sizing" --jq '.content' | base64 -d`
- same for `doc/ruleset/technical-notes.md` and `doc/ruleset/changelog.md`.

The rules facts this plan is built on, resolved at plan time against those docs
(these settle the story's "Open items to resolve at plan time"):

- **Two boards (rules §2.1).** Coordinates: columns lettered from `A`, rows
  numbered from `1`, row 1 = White's back rank, highest row = Black's back rank.
  Up to 26 columns are permitted (single-letter names).
  - **Battle** (`BOARD_LAYOUT = standard_144`): 12×12. Rows from White's edge:
    4 home / 1 buffer / 2 lake / 1 buffer / 4 home. Home zone = 48 squares. Lake
    columns on the two lake rows follow `O L L O O L L O O L L O` (columns
    B,C,F,G,J,K) → three 2×2 lakes. **This is the existing layout, unchanged.**
  - **Skirmish** (`BOARD_LAYOUT = standard_64`): 8×8. Rows from White's edge:
    3 home / 2 lake / 3 home. **No neutral buffer rows** — home zones sit
    directly against the lakes. Home zone = 24 squares. Lake columns follow
    `O L L O O L L O` (columns B,C,F,G) → two 2×2 lakes.
- **Two armies (rules §2.2).** Selected by `ARMY_COMPOSITION`.
  - **Battle** (`standard_battle`): 25 pieces — 3 each of ranks 1–6
    (Master-of-Arms 1, Champion 2, Knight 3, Halberdier 4, Foot Soldier 5,
    Militia 6), 6 Towers, 1 Flag. **Unchanged from major 1.**
  - **Skirmish** (`standard_skirmish`): 16 pieces — 3 each of ranks 1–4, 3
    Towers, 1 Flag. **No Foot Soldier or Militia.** Position-block symbols are
    unchanged (`1`–`6`, `T`, `F`); Skirmish simply never uses `5`/`6`.
  - Names and rank codes are unchanged from major 1.
- **Editions (rules Appendix B / technical-notes "editions and flags").** An
  edition is a major baseline plus a complete set of flag values. The two active
  editions differ **only** in the two flags:
  - `2-0:BATTLE` = `BOARD_LAYOUT=standard_144`, `ARMY_COMPOSITION=standard_battle`.
  - `2-0:SKIRMISH` = `BOARD_LAYOUT=standard_64`, `ARMY_COMPOSITION=standard_skirmish`.
  The `Ruleset` record tag is the **full edition id** with **no deviating
  flags** (each edition sets both flags explicitly, and a flag at its resolved
  value is omitted). A bare ruleset name is never written.
- **Invalid combinations are simply not offered.** `BOARD_LAYOUT` and
  `ARMY_COMPOSITION` are independent, so a config can name an army that does not
  fit its home zone (25 pieces on Skirmish's 24 home squares). Only the two
  published editions are offered for play.
- **Diagonal attacks (rules §4.2/§4.3, "Diagonal attacks").** A mobile
  (numbered) piece may attack an enemy one square **diagonally**, resolving
  combat by the ordinary rules (rank / equal rank / formation bonus — none
  depends on direction). Constraints, all confirmed against the reference docs:
  - **One square only** — there is no two-square diagonal; the unencumbered
    bonus never extends a diagonal, and a piece with an enemy on its diagonal is
    encumbered anyway.
  - **Movable targets only** — Towers and the Flag may **not** be attacked
    diagonally (only orthogonally). Consequence: **the Flag can only ever be
    captured from an orthogonally adjacent square.**
  - **No diagonal move onto an empty square, ever** — the diagonal is an
    attacking direction and nothing else.
  - **Lake corner does not block (the "skirt")** — a diagonal attack may pass
    the corner of a lake; only the **attacked square itself** must not be a
    lake. On Battle, a piece on A6 may attack B5 though B6 is a lake.
  - **The "squeeze" (a diagonal slipping between two lakes) is NOT implemented
    as a special case** — it is unreachable on both published boards
    (technical-notes reserves it for a future layout). The only rule enforced is
    "the attacked square is not a lake."
- **The rest of movement/combat/endings is major 2 as written = major 1
  unchanged.** Orthogonal one-square step; unencumbered two-square straight
  move; encumbrance judged at the origin over all eight surrounding squares
  (diagonal enemies already fold in); combat (lower rank wins, equal ranks
  trade, one-rank-weaker + formation bonus draws, any piece trades with a
  Tower); single shared inactivity counter draws at 50; Flag capture wins; no
  legal move loses; draw by agreement.
- **Position block (technical-notes "The position block").** The full board from
  White's perspective, highest row at top, column A at left; each square a
  fixed-width 3-char cell (`[R]` White, `*R*` Black, `---` empty, `XXX` lake),
  cells space-separated, one board row per line. It is **size-describing**: a
  reader recovers **dimensions** by counting lines/cells and the **lake layout**
  from the `XXX` cells. It does **not** carry the home-zone row count (a
  mid-game position hides it); anything needing it (placement validation) reads
  it from the `BOARD_LAYOUT` value instead.
- **Notation needs no change for diagonal attacks** — a diagonal attack is a
  source and a destination like any other move.

### Architecture decisions resolved at plan time (structure only)

- **The board is data, driven by one edition config; one rule engine.** A
  `BoardLayout` value carries grid dimensions, the lake cell pattern, and the
  per-side home-zone row count. An `Edition` value pairs a `BOARD_LAYOUT` and an
  `ARMY_COMPOSITION` (each resolving to a `BoardLayout` and an army roster) and
  carries its edition-id string. The resolved edition is threaded through the
  rule engine and the game-state artifacts (`InitialGameState`, `PlayState`
  already carry a `ruleset`; extend them to carry the resolved edition/layout),
  so no module hardcodes 12×12.
- **The new home is `src/rules/primary/v2/`; `v1` is removed.** Per story
  00000016's one-folder-per-major convention. This plan relocates `v1` → `v2`
  wholesale in Step 1 (a pure move) and refactors within `v2`. There is never a
  live `v1` folder after Step 1, so "no dead major-1 code retained" holds.
- **Engine and encoding are knowingly broken but must still compile.**
  `src/engine/` and `src/encoding/eng-nn-1/` are Battle/12×12/25-piece-only and
  are left non-functional (accepted result of the story). They must keep
  **typechecking** at every step (the build runs `tsc -b`). To preserve this
  while widening the board types, `board.ts` retains a Battle-default constant
  surface (`COLUMNS`, `ROWS`, and the no-argument helpers those modules use) so
  the frozen modules compile untouched; the live rule path uses the new
  layout-parametric API instead. Their now-meaningless **tests** are quarantined
  in Step 9.
- **Transitional record tag.** The record `Ruleset` tag string and the record
  reader/writer flip from `1.2:PRE-RELEASE` to the edition ids in **one step
  (Step 8)**, together with the size-parametric notation. Earlier steps keep the
  Battle position block byte-identical to today and keep the internal
  `RULESET_TAG` string unchanged, so the record round-trip tests stay green.
  Between Step 5 (diagonal attacks land) and Step 8 the live Battle game plays
  the major-2 rules while its developer record dump still carries the old tag
  string; this is harmless (no real `1.2:PRE-RELEASE` records exist to
  mis-tag, and the dump's re-import is only exercised at Step 8) and is called
  out here so a cold reader does not treat it as a bug.

Every step must leave the app **green** (`npm run typecheck`, `npm run lint`,
`npm test`) and a **hot-seat game playable** (Battle until Step 7; Battle or
Skirmish from Step 7 on). Commit per the standard pipeline.

---

## Step 1 — Relocate the rule code from `v1/` to `v2/` and repoint every consumer

Status: committed

Notes: Used `git mv src/rules/primary/v1 src/rules/primary/v2` to preserve
history, then `sed -i 's#primary/v1#primary/v2#g'` across every file under
`src` that referenced the old path (44 consumer files plus the moved
directory's own tests were unaffected since their imports are relative).
`RULESET_TAG` in `gameState.ts` is untouched (`"1.2:PRE-RELEASE"`), and no
comment content was changed beyond the path, per the step's pure-relocation
scope. `npm run typecheck && npm run lint && npm test` all pass with the
identical 29 test files / 489 tests as before the move; `grep -r
"primary/v1" src` and `find src -type d -name v1` both return nothing. No
deviations from the plan.

Move `src/rules/primary/v1/` to `src/rules/primary/v2/` (all modules and their
`*.test.ts`) and update every import path `primary/v1` → `primary/v2` across the
whole `src` tree — including `src/board/*` (boardView, sessions, Board/PlayBoard,
Tray, controls, announcements, warnings, sideNames), `src/review/*`,
`src/encoding/eng-nn-1/*`, `src/engine/*`, `src/art/PieceIcon.tsx`,
`src/App.tsx`, and `src/rules/readRecord.ts`. This is a **pure relocation**: no
behavior, type, tag, or comment-content change beyond the path. The internal
`RULESET_TAG` stays `"1.2:PRE-RELEASE"`. (Comments that name "ruleset 1.2" etc.
may be left as-is here; they are corrected as each module is actually reworked in
later steps.)

Why it comes here: everything else edits code that must live at its final path;
doing the move first means no later step has to re-thread imports. It introduces
no new behavior, so it is the safe first commit.

How to verify (automated): `npm run typecheck && npm run lint && npm test` all
pass with the identical test count as before the move; `git status` shows the
files renamed under `v2/` and no `v1/` directory remaining. `grep -r "primary/v1"
src` returns nothing.

---

## Step 2 — Edition, board-layout, and army-composition configuration model (data only)

Status: pending

Add new configuration modules under `src/rules/primary/v2/` that describe the
editions as **data**, with **no wiring into the board/rules engine yet**:

- A `BoardLayout` shape: number of columns, number of rows, the set of lake
  cells (derivable from a lake-column pattern applied to the lake rows), and the
  per-side home-zone row count / row assignment (which rows are White-home,
  Black-home, buffer, lake). Define the two layouts `standard_144` (the current
  Battle geometry) and `standard_64` (Skirmish, per Grounding facts).
- An army-roster lookup keyed by `ARMY_COMPOSITION` (`standard_battle` = the
  current 25-piece roster; `standard_skirmish` = 16 pieces, ranks 1–4 + 3
  Towers + 1 Flag), giving per-type quantities.
- An `Edition` registry: `2-0:BATTLE` and `2-0:SKIRMISH`, each pairing a
  `BOARD_LAYOUT` and an `ARMY_COMPOSITION`, exposing the resolved `BoardLayout`,
  the resolved army roster, and the **edition-id string** (`"2-0:BATTLE"` /
  `"2-0:SKIRMISH"`). Include a validity check "does this army fit this board's
  home zone" and expose only the playable editions for play.

Do not yet change `board.ts`, `pieces.ts`, or any consumer — this step only adds
the vocabulary later steps thread through.

Why it comes here: the parametric board (Step 3) and per-edition army (Step 4)
both consume this model; defining it first as inert data lets it be unit-tested
in isolation before anything depends on it (no forward dependency).

How to verify (automated): new unit tests assert the two layouts' dimensions,
lake cells, and home-zone rows (Battle 12×12/48-square home/three 2×2 lakes;
Skirmish 8×8/24-square home/no buffer/two 2×2 lakes); the two army rosters' total
counts (25 / 16) and that Skirmish has no rank 5/6; the edition-id strings render
exactly `2-0:BATTLE` / `2-0:SKIRMISH`; and the validity check accepts both
published editions and rejects `standard_battle` on `standard_64`. Run
`npm test`.

---

## Step 3 — Make the board parametric and thread the layout through the rule engine

Status: pending

Rework `board.ts` so board geometry is **read from a `BoardLayout`** (Step 2)
rather than being the fixed 12×12 literal type. Widen `Column`/`Row` from literal
unions to string/number, and turn `allSquares`, `isLake`, `regionOf`,
`isHomeSquareFor`, `homeSquares`, and the column/row lists into functions of a
`BoardLayout`. Thread that layout (carried on the resolved edition) through the
rule-engine consumers that currently assume the fixed board:
`movement.ts` (step/off-board bounds, unencumbered scan), `combat.ts` (formation
bonus neighbor scan), `outcome.ts` (`allSquares`/flag scan, `hasAnyLegalPly`),
`placement.ts` (home squares, Tower-adjacency, auto-fill), and `gameState.ts`
(position-block render/parse sized to the layout). Extend the game-state
artifacts (`InitialGameState`, and `PlayState` via `startPlay`) to carry the
resolved **edition/layout** alongside the existing `ruleset` string.

Keep the **live app hardcoded to the Battle edition** (its call sites pass the
Battle layout), so the running game is byte-for-byte the same as today. Keep the
internal `RULESET_TAG` string `"1.2:PRE-RELEASE"` unchanged and keep Battle's
position block output identical, so the record and readRecord tests stay green
without edits. **Retain Battle-default `COLUMNS`/`ROWS` constants and no-argument
helpers** on `board.ts` so the frozen `src/engine/` and `src/encoding/eng-nn-1/`
modules keep typechecking unchanged.

Do **not** add diagonal attacks here (Step 5), and do **not** change the army
(Step 4) — Battle still fields 25 pieces via the existing roster.

Why it comes here: making the board a parameter is the structural core the story
calls out; every later step (army, diagonal attacks, rendering, picker, records)
needs the layout threaded. It depends on Step 2's `BoardLayout`/edition data and
on Step 1's relocation.

How to verify: **automated** — the existing rule-engine tests (movement, combat,
outcome, placement, gameState) pass after being adapted only to pass the Battle
layout; add unit tests exercising the same functions on the **Skirmish** layout
(8×8 board: correct square set, lake cells at B/C/F/G on the lake rows, 24-square
home zones, no buffer, a legal one- and two-square move near the Skirmish edge,
position-block render/parse round-trip at 8×8). `npm run typecheck && npm run
lint && npm test`. **Manual (Gate C, partial)** — run `npm run dev`, play a
Battle hot-seat game through placement and a few plies; confirm it behaves
exactly as before (this is the "Battle still plays" safety net for the refactor).

---

## Step 4 — Per-edition army (piece inventory driven by `ARMY_COMPOSITION`)

Status: pending

Make the army roster and inventory a function of the resolved edition's
`ARMY_COMPOSITION` rather than the fixed 25-piece catalog. `pieces.ts` keeps the
full 8-type catalog (names, rank codes, symbols — all unchanged), but the
per-side **quantities**, `freshInventory`, `ARMY_SIZE`, and placement
completeness (`isComplete`, `progress`) derive from the chosen army roster:
Battle 25, Skirmish 16 (ranks 1–4, 3 Towers, 1 Flag; zero Foot Soldier / Militia,
so the tray never offers them for Skirmish). Thread the roster through
`placement.ts` (completeness/progress) and `placementSession.ts`/the tray so the
correct army is presented. The live app remains Battle.

Why it comes here: the picker (Step 7) needs both boards **and** both armies
already working per edition; the army must be parametric before Skirmish
placement can be exercised. Depends on Step 2 (rosters) and Step 3 (edition
threaded through placement).

How to verify (automated): unit tests that a fresh Skirmish inventory has 16
pieces with the right per-type counts and no rank 5/6, that Skirmish placement
reports complete at 16 and Battle at 25, and that auto-fill fills exactly the
edition's army on the edition's board while still honoring the Tower-adjacency
rule. `npm test`. (Skirmish is not yet reachable in the UI — that is Step 7 —
so this step's verification is automated.)

---

## Step 5 — Diagonal attacks in the movement rules

Status: pending

Extend `movement.ts` so a mobile (numbered) piece may **attack** an enemy one
square **diagonally**, added to `legalAttacks` (never to `legalDestinations`).
Enforce, per Grounding facts: one square only (no two-square diagonal); the
target must be a **movable/numbered** enemy piece (Tower and Flag are **not**
diagonal targets); **never** a diagonal move onto an empty square; the attacked
square must not be a lake, but a lake at the **corner** does not block (the
skirt) — do not implement the unreachable "squeeze." Encumbrance already scans
all eight surrounding squares, so no change is needed there; combat resolution
(`combat.ts`) is direction-independent and unchanged. `hasAnyLegalPly`
(`outcome.ts`) picks up diagonal attacks automatically since it already consults
`legalAttacks`.

Why it comes here: diagonal attacks are pure movement-rule logic and are
independent of the picker and records; landing them before the UI/records steps
means the rendering step (Step 6) can immediately surface them and the manual
gates can exercise them. Depends on Step 3 (parametric movement).

How to verify (automated): unit tests covering each edge case on a small
constructed board — a numbered enemy one square diagonally **is** offered as an
attack; a Tower and a Flag one square diagonally are **not**; an empty diagonal
square is **never** a destination; a diagonal attack is offered across a lake
corner (Battle A6 → B5 with B6 a lake) but **not** onto a lake square; combat
resolves identically whether the attack came orthogonally or diagonally
(stronger wins, equal trades, one-rank-weaker-with-formation-bonus draws). `npm
test`. Manual confirmation of the live behavior is Gate B, exercised at Step 6.

---

## Step 6 — Parametric board rendering and the diagonal-attack / Skirmish views

Status: pending

Rework the screen-orientation and rendering layer for the parametric board and
the new attack direction:

- `boardView.ts`: derive `visibleRows`, `visibleColumns`, `fullBoardRows`,
  `fullBoardDisplayPosition`, and `movePathSquares` from the resolved layout
  rather than the fixed 12 rows / A–L columns. The **cropped active-player
  placement view** adapts to Skirmish's **no-buffer** layout (home rows plus the
  nearest lake row, with no buffer band). The full-board Phase-2 view renders the
  whole 8×8 or 12×12 board oriented to the side to move, as today.
- `Board.tsx` / `PlayBoard.tsx` / `FullBoard.tsx` and the CSS grid sizing size
  themselves to the layout's column/row counts instead of assuming 12.
- Grid keyboard navigation (`src/board/grid/gridNavigation.ts`) works on the
  variable dimensions.
- Move/attack highlighting distinguishes **diagonal attacks as attacks** (the
  same visual/interaction affordance already used for orthogonal attacks — kept
  distinct from plain moves), so a diagonal target reads as an attack, not a
  move.

Thread the resolved layout/edition from the game state into these components. The
live app is still Battle, but the components are now edition-agnostic.

Why it comes here: the picker (Step 7) makes Skirmish reachable, so the renderer
must already handle both boards and the diagonal-attack affordance. Depends on
Steps 3 (layout), 4 (army/tray), and 5 (diagonal attacks exist to highlight).

How to verify: **manual (Gate B + rendering)** — temporarily default the live
game to Skirmish (or add a throwaway toggle) and run `npm run dev`; confirm the
8×8 board renders with no buffer row in placement, the 16-piece tray, and correct
orientation for both sides; confirm a numbered enemy one square diagonally is
highlighted **as an attack** and taking it resolves combat, while a Tower/Flag on
the diagonal and any empty diagonal square are never offered; confirm the Battle
12×12 board is unchanged. Revert the temporary default before committing.
**Automated** — unit tests for `boardView.ts` on both layouts (visible/full rows
and columns, the Skirmish no-buffer crop, `movePathSquares` at both sizes) plus
`npm run typecheck && npm run lint && npm test`.

---

## Step 7 — Battle/Skirmish picker and threading the chosen edition through a game

Status: pending

Add the per-game **Battle/Skirmish choice** and thread it end to end. Present the
choice at the **start of a hot-seat game**, **before placement**, with
**Skirmish pre-selected** as the recommended first game (name the two games to
the player exactly as the rules do — "Battle" and "Skirmish" — in plain language,
no "edition"/"flag"/"ply" jargon). Structure: a small choice screen owned by
`HotSeatGame.tsx` (shown before its placement state) rather than expanding the
start screen, so `App.tsx`'s screen union is untouched and the choice is scoped
to one game. Feed the chosen edition into `newSession`/placement, into
`startSession`/`startPlay`, and into rendering, so placement, play, the board,
and (already) the game-state artifact all use the chosen board and army.

Announce the choice and the resulting board to assistive tech (the selected game
and its board size), keeping the established focus/keyboard/screen-reader
patterns HotSeatGame already uses.

Why it comes here: it is the first step that makes Skirmish reachable to a
player, and it needs both boards, both armies, and the renderer already working
(Steps 3–6). It does not need the record changes (Step 8).

How to verify: **manual (Gate A + Gate C)** — `npm run dev`, choose "Play a
game": confirm the choice appears with **Skirmish pre-selected**; choose
Skirmish → 8×8 board, no buffer row, 16-piece tray, place onto freely chosen home
squares, and the Tower-adjacency rule (including diagonally) still blocks
finishing with an actionable message; complete both armies and confirm the reveal
shows both 16-piece armies. Then start a new game, choose Battle → the unchanged
12×12 game with its 25-piece army, placement/movement (including the two-square
unencumbered move)/combat as before, now with diagonal attacks available. `npm
run typecheck && npm run lint && npm test` remain green.

---

## Step 8 — Records: edition-id tag, size-parametric position block, reader dispatch

Status: pending

Flip the record layer from `1.2:PRE-RELEASE` to the major-2 editions:

- **Writer** (`play.ts` `renderGameRecord`, and the `RULESET_TAG` source in
  `gameState.ts`): emit the `Ruleset` tag as the resolved **edition id**
  (`2-0:BATTLE` / `2-0:SKIRMISH`) with **no deviating flags**, and a
  **size-correct position block** for the edition that was played (already sized
  by the parametric renderer from Step 3).
- **Notation** (`notation.ts`): widen `SQUARE_PATTERN` so square tokens accept
  any column `A`–`Z` and any row `1`–`99` (up to 26 columns / the parametric
  board), not the fixed `A–L` / `1–12`. Diagonal attacks need no notation change.
- **Reader** (`readRecord.ts` + `recordFile.ts`): dispatch on the **edition id**
  (`2-0:BATTLE` / `2-0:SKIRMISH`), recover board **dimensions** from the position
  block (count lines/cells) and lake layout from the `XXX` cells, and round-trip
  both editions. Remove all knowledge of the `1.2:PRE-RELEASE` tag — a
  `1.2:PRE-RELEASE` file now falls through to the `unknownRuleset` rejection
  (major-1 records are deliberately not reviewable).
- Update `readRecord.test.ts`, `recordFile.test.ts`, `gameState`/position-block
  tests, and any sample-record fixtures to the new edition ids and (for
  Skirmish) the 8×8 block. Note in the step's Notes that verifying the reviewer
  against **real engine-produced** 2.0 records is out of scope (follow-up story);
  these tests use app-produced records.

Why it comes here: it needs the parametric board (Step 3) and the per-edition
army/board actually being played through the UI (Step 7) so a Skirmish record can
be produced and re-read. Flipping the tag and the reader together keeps the round
trip green in a single commit.

How to verify: **automated** — round-trip tests for both editions (render a
completed game to a record string, read it back, and confirm the replayed board
dimensions, lake layout, position, and moves match), and that the `Ruleset` tag
reads exactly `2-0:BATTLE` / `2-0:SKIRMISH` with no flag tokens; a
`1.2:PRE-RELEASE` file is rejected as `unknownRuleset`. `npm test`. **Manual
(Gate D)** — in each edition, play to an ending (Flag capture; a maneuvering
sequence that draws at the 50th quiet move; a draw by agreement), dump the
developer record, confirm the right edition id / a size-correct block / a
plausible result and reason, and **re-import that dump into the reviewer** and
confirm it replays end to end.

---

## Step 9 — Disable computer play; quarantine the engine and encoding tests

Status: pending

Make "Play against the computer" **visibly disabled** and stop the engine/encoding
from failing the suite:

- `StartScreen.tsx`: render the "Play against the computer" choice **disabled**,
  with a short plain-language note that it is temporarily unavailable under the
  new rules (no jargon). The option cannot be activated. `App.tsx` no longer
  routes to the `EngineGame` screen from it (the engine screen and its
  components remain in the tree, unreferenced by any live path). "Review a game"
  and "Play a game" are unaffected.
- Leave `src/engine/` and `src/encoding/eng-nn-1/` **modules** in place,
  non-functional and unreferenced (accepted result of the story — they need a
  new engine spec, out of scope). Their tests now assert 12×12/25-piece behavior
  that no longer holds; **quarantine them** (skip or remove) so `npm test` is
  green and honest without pretending the engine works. Prefer removing the
  test files (they test a knowingly-broken module) or, if kept, mark them
  skipped with a comment pointing at the follow-up engine story.

Why it comes here: it is independent of the rules work and is cleanest once the
live app no longer depends on the engine path. Depends on nothing after Step 1
functionally, but is placed late so the engine's broken tests are not repeatedly
re-touched while the rules change underneath them.

How to verify: **manual (Gate F)** — `npm run dev`: "Play against the computer"
is visible but disabled with the note and cannot be activated; "Review a game"
still opens the import screen; "Play a game" still starts the picker.
**Automated** — `npm run typecheck && npm run lint && npm test` all green with no
skipped-but-failing engine tests and no dangling references to a live engine
path.

---

## Step 10 — Copy, instructions, and accessibility audit

Status: pending

Sweep the app for player-facing text and assistive-tech behavior that still
assumes a single fixed board or a 25-piece army, and correct it for the two
games and diagonal attacks:

- Reword any placement/play instructions, status text, help copy, or
  announcements that hardcode "12×12", "25 pieces", or an orthogonal-only notion
  of attack. Use the rules' names ("Battle", "Skirmish", the piece names) and
  the word "move" (never "ply") in player-facing surfaces; describe diagonal
  attacks in plain words.
- Confirm the live-region announcements keep pace: the Battle/Skirmish choice,
  the resulting board, placement (including recovering from the Tower rule) on
  the Skirmish board, and a diagonal attack are all announced correctly.
- Preserve the established keyboard and screen-reader patterns end to end on both
  boards.

Why it comes here: it depends on every feature already being in place (picker,
both boards, diagonal attacks, records) so the audit covers the final surfaces.

How to verify: **manual (Gate E)** — with the mouse put away, complete the
Battle/Skirmish choice, place on the Skirmish board (including deliberately
triggering and recovering from the Tower-adjacency rule), and play a stretch that
includes a diagonal attack, entirely by keyboard, with a screen reader; confirm
the choice, the new board, placement feedback, and the diagonal attack are all
announced correctly and nothing is announced twice. Re-run all of Gates A–D and F
as a regression sanity check. `npm run typecheck && npm run lint && npm test`
green.

---

## Step 11 — README and documentation check

Status: pending

Review `README.md` (and any player-facing docs it links) against everything this
story changed — the two games (Battle/Skirmish) with Skirmish as the recommended
first game, diagonal attacks, and computer play being temporarily unavailable —
and update it where it is now inaccurate, or confirm no change is needed. The
`/update-readme` command may be used: it reviews the branch diff and updates
`README.md` if warranted. Do not restate the rules here; link to the companion
repository as the source of truth (per project conventions).

Why it comes here: last, so the README reflects the finished behavior.

How to verify (automated + manual): `/update-readme` (or a manual read-through)
produces either a warranted `README.md` edit or a confirmation that none is
needed; `npm run typecheck && npm run lint && npm test` remain green after any
edit.
