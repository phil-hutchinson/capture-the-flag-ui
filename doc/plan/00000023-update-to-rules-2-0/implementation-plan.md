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

Status: committed

Notes: Added three inert data modules under `src/rules/primary/v2/`, none
wired into `board.ts`, `pieces.ts`, or any consumer:
`boardLayout.ts` (`BoardLayout` shape - column/row counts, `homeRowsPerSide`,
`hasBuffer`, `lakeRows`/`lakeColumnIndices`, plus `lakeCells()`, `rowRegion()`,
and `homeZoneSize()` helpers; `BOARD_LAYOUTS` keyed registry with
`standard_144` and `standard_64` per the Grounding facts), `armyComposition.ts`
(`ArmyRoster` per-type counts keyed by `PieceTypeId`; `standard_battle`'s
roster is derived from `pieces.ts`'s `PIECE_CATALOG` quantities rather than
duplicated, so the two can't drift; `standard_skirmish` is a literal 16-piece
roster; `ARMY_COMPOSITIONS` keyed registry), and `edition.ts` (`Edition`
pairing a resolved `BoardLayout` and `ArmyRoster` with its edition-id string;
`EDITIONS` registry for `2-0:BATTLE`/`2-0:SKIRMISH`; `armyFitsBoard`/
`combinationFits` validity checks taking layout/roster ids directly - not just
already-paired editions - so the rejected `standard_battle`-on-`standard_64`
case can be tested without constructing an invalid `Edition`; `playableEditions()`
filters `EDITIONS` through that check). One deviation from the plan's literal
wording: `rowRegion()` classifies a row into `white-home`/`black-home`/
`buffer`/`lake` without needing to branch on `hasBuffer` (a no-buffer layout
just has no rows left over between home and lake arithmetically); `hasBuffer`
is kept on `BoardLayout` anyway as documentation/data the plan asked for and is
asserted directly in tests. Added `boardLayout.test.ts`, `armyComposition.test.ts`,
and `edition.test.ts` covering exactly the cases the step's verification lists.
`npm run typecheck && npm run lint && npm test` all pass (516 tests, up from
489 before this step - the 27 new tests are entirely in the three new test
files; no existing file changed).

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

Status: committed

Notes: `Column`/`Row` widened to `string`/`number`; `board.ts`'s geometry
functions (`allSquares`, `isLake`, `regionOf`, `isHomeSquareFor`,
`homeSquares`) each gained an optional trailing `layout: BoardLayout`
parameter **defaulting to a new `BATTLE_LAYOUT` constant** (`=
BOARD_LAYOUTS.standard_144`), rather than being split into a Battle-only set
plus a separately-named parametric set - a no-arg call (`isLake(square)`,
`allSquares()`, etc.) still resolves to exactly today's Battle behavior, so
every existing call site (the frozen `src/engine/`/`src/encoding/eng-nn-1/`
modules, and every other file under `src/board/`, `src/review/`) compiles
and behaves unchanged with zero edits. `COLUMNS`/`ROWS` stay as Battle-only
constant arrays, now derived from two new exported helpers `columnsOf(layout)`/
`rowsOf(layout)` rather than hand-written literals. Added `columnIndexOf`
(letter-to-index arithmetic, replacing the old `COLUMNS.indexOf` lookup used
by `movement.ts`/`combat.ts`/`placement.ts`) since a `Record<Column, number>`
built off the Battle-only `COLUMNS` array would have been wrong for Skirmish.
`movement.ts`, `combat.ts`, and `outcome.ts` each gained the same trailing
optional `layout` parameter (default `BATTLE_LAYOUT`), threaded into their
internal `step`/bounds/neighbor-scan helpers. `placement.ts`'s
`PlacementState` gained a required `boardLayout` field (set by
`emptyPlacement(side, boardLayout = BATTLE_LAYOUT)` and carried through
`clear`); home-square lookups and the Tower-adjacency scan read
`state.boardLayout`. The army stayed exactly as the plan specified - Battle's
25-piece `freshInventory()`/`ARMY_SIZE` regardless of layout (Step 4's
concern), which is why the new Skirmish placement tests place a few pieces by
hand rather than running `autoFill` to completion (25 pieces do not fit
Skirmish's 24-square home zone yet).

`gameState.ts`: `InitialGameState` gained an **optional** `edition?: Edition`
field (from the Step 2 `edition.ts` registry) rather than a required one -
required would have forced edits to every hand-built `InitialGameState`/
`PlayState` fixture across `play.test.ts`, `playAnnouncement.test.ts`,
`playSession.test.ts`, `playWarnings*.test.ts`, and `engine/search*.test.ts`
(all outside this step's named scope and, for the engine ones, explicitly
deferred to Step 9's quarantine). `renderPositionBlock` reads
`gameState.edition?.boardLayout ?? BATTLE_LAYOUT`; `parsePositionBlock` takes
`layout: BoardLayout = BATTLE_LAYOUT` directly. `buildInitialGameState` gained
an `edition: Edition = EDITIONS["2-0:BATTLE"]` parameter and now also
validates both placement states' `boardLayout.id` matches `edition.boardLayoutId`
(a new invariant check, additional to the existing side checks). `play.ts`
needed a small, unavoidable follow-on edit (not one of the step's named
consumers, but a direct consequence of extending `PlayState`): `PlayState`
gained the same optional `edition?: Edition`, populated in `startPlay` from
`initial.edition` and passed through in `renderGameRecord`'s reconstructed
`InitialGameState` literal; `applyMove`'s internal calls to
`legalAttacks`/`legalDestinations`/`resolveCombat`/`computeOutcome` were left
on their Battle defaults, since wiring `play.ts` to actually *use*
`state.edition.boardLayout` for rule enforcement is Step 7's job once a
non-Battle edition is reachable through the picker - this step only extends
the artifacts to *carry* it, per the plan's own wording.

Added a Skirmish-layout `describe` block to each of `board.test.ts`,
`movement.test.ts`, `combat.test.ts`, `outcome.test.ts`, `placement.test.ts`,
and `gameState.test.ts` (34 new tests total, 516 → 550), several of which
assert a square that is on-board for Battle's 12×12 grid but off-board for
Skirmish's 8×8 (e.g. column I, row 9) is never picked up when a Skirmish
layout is passed - direct evidence the bounds are read from the layout
argument, not hardcoded. No existing test file needed edits beyond these
additions: every pre-existing call site already worked unchanged through the
default-parameter fallback. `npm run typecheck && npm run lint && npm test`
all pass (550 tests, up from 516). `npm run format:check` is clean for every
file this step touched (the three markdown files it still flags predate this
step and are out of scope). Manual Gate C smoke test (`npm run dev`) is the
orchestrator's to arrange per the standard pipeline, not run here.

One deviation from the plan's literal wording: the plan says to "turn
`allSquares`, `isLake`, `regionOf`, `isHomeSquareFor`, `homeSquares` ... into
functions of a `BoardLayout`" separately from "retain Battle-default
`COLUMNS`/`ROWS` constants and no-argument helpers" - read most literally
this could suggest two parallel APIs (Battle-only no-arg functions plus
separately-named parametric ones). Implemented instead as **one function per
name with an optional, defaulted `layout` parameter** (true default
parameters, not overloads), since that is simultaneously "a function of a
`BoardLayout`" and a "no-argument helper" for every existing caller - it
needed no `.filter(isLake)`-by-reference call sites to change except one in
`board.test.ts` itself (a bare function reference passed to `Array.filter`
picks up `filter`'s `index` argument as the second parameter; TypeScript
correctly rejects this against `isLake`'s `layout: BoardLayout` second
parameter type, so that one call was rewritten as `.filter((s) =>
isLake(s))`). This is a smaller footprint than a two-API design and was not
flagged as a place to split the step - it was the natural reading once
`src/engine`/`src/encoding` call sites were inventoried and found to always
call these functions at the old arity.

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

Status: committed

Notes: `pieces.ts` kept its full 8-type catalog (names, rank codes, symbols)
unchanged, including `quantityPerSide` (Battle's own per-type count, which
`armyComposition.ts`'s `standard_battle` roster still derives from, per Step
2's design - the two must not drift); only its Battle-fixed `ARMY_SIZE`
constant and no-argument `freshInventory()` moved out, since a single
constant/no-arg function couldn't represent two armies. They landed in
`armyComposition.ts` as roster-parametric `armySize(roster)` (already existed)
and new `freshInventory(roster)`, plus a `BATTLE_ARMY` constant (mirrors
`board.ts`'s `BATTLE_LAYOUT`) as the shared default. `PlacementState` gained an
`army: ArmyRoster` field alongside `boardLayout`; `emptyPlacement` takes it as
a third parameter defaulting to `BATTLE_ARMY`, and `progress`/`isComplete` now
read `armySize(state.army)` instead of the old fixed constant. `clear` passes
`state.army` through. `placementSession.ts`'s `newSession` gained an
`Edition = EDITIONS["2-0:BATTLE"]` parameter and seeds both sides'
`emptyPlacement` calls from `edition.boardLayout`/`edition.army`, so Step 7's
picker only needs to pass the chosen edition. `Tray.tsx` gained a required
`army: ArmyRoster` prop and now filters `pieceCatalogEntries()` to
`army[entry.id] > 0` before rendering, so a zero-roster type (Skirmish's Foot
Soldier/Militia) is never shown at all - not just shown-disabled-at-zero,
which remains the treatment for a type the roster fields but whose remaining
count has hit zero. Both `<Tray>` call sites (`HotSeatGame.tsx`,
`EngineGame.tsx`) now pass `army={placement.army}`; `EngineGame.tsx` is a live
UI consumer of the placement/tray API (not one of the frozen
`src/engine/`/`src/encoding/eng-nn-1/` modules), so it needed this one-line
update to keep typechecking, matching Step 3's precedent for such consumers.
`gameState.ts`'s `buildInitialGameState` error message now reads
`armySize(edition.army)` instead of the removed `ARMY_SIZE` constant (also
fixed a stale "48-piece army" wording bug in its doc comment while touching
that paragraph - should have said 25, since 48 is the home-zone size, not the
army size). Added unit tests per the step's verification: `armyComposition.test.ts`
gained `BATTLE_ARMY` and `freshInventory` coverage (including the literal
16-piece Skirmish case: 3/3/3/3/3/1/0/0); `placement.test.ts` gained a new
"PlacementState with the Skirmish army (16 pieces)" describe block covering a
fresh Skirmish inventory, `progress`/`isComplete` at 16 (contrasted with an
equally-sized Battle subset, which is not complete since Battle's roster is
25), and `autoFill` filling exactly 16 pieces onto the Skirmish board while
honoring the Tower-adjacency rule (3 Towers placed, none adjacent). Moved the
old Battle-only `ARMY_SIZE`/`freshInventory` tests out of `pieces.test.ts`
(now covered by `armyComposition.test.ts`); `placement.test.ts` and
`gameState.test.ts` each define a local `const ARMY_SIZE = armySize(BATTLE_ARMY)`
so their many existing Battle-25 assertions read unchanged. No deviations from
the plan's substance; `npm run typecheck && npm run lint && npm test` all pass
(556 tests, up from 550 - net of the 2 tests moved out of `pieces.test.ts` and
the new ones added elsewhere) - run from a same-content scratch copy of the
repo on the container's own filesystem after the mounted workspace volume
started intermittently throwing `EIO` under vitest/eslint's concurrent file
reads (confirmed environment-only: the errors hit random `node_modules`
internals unrelated to this diff, and cleared up entirely once the exact same
files were read from a fast local copy); `prettier --write` was run on every
file this step touched to match the project's formatting.

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

Status: committed

Notes: Added a `DIAGONAL_DIRECTIONS` constant (the four diagonal deltas) and a
second loop in `legalAttacks` (`movement.ts`) that, for each diagonal
neighbor, offers it as an attack when it is on-board, not a lake, holds an
enemy piece, and that enemy piece is movable (`!isImmobile`, the same
Tower/Flag check already used elsewhere in the file) - never subject to the
unencumbered bonus, so there is no "two squares diagonal" path at all (the
loop only ever computes `step(origin, dc, dr, 1, layout)`). `legalDestinations`
was untouched, since the diagonal is exclusively an attacking direction.
`combat.ts` and `outcome.ts` needed no change, exactly as the plan predicted
(`hasAnyLegalPly` already consults `legalAttacks`). Updated the module-level
doc comments (file header and `legalAttacks`'s docstring) to describe the new
diagonal-attack behavior and re-dated the stale "ruleset 1.2" reference in
`movement.ts`'s header to "ruleset major 2" while touching that exact
paragraph (left `combat.ts`/`outcome.ts`/other files' stale "1.2" headers
alone, per Step 1's precedent, since this step does not rework them).

Added a `describe("legalAttacks: diagonal attacks ...")` block to
`movement.test.ts` covering every edge case the step's verification lists:
all four diagonal directions offered against a movable enemy; a Tower and a
Flag diagonally are never offered; an empty diagonal square is never a
`legalDestinations` result; no two-square diagonal even when unencumbered; a
diagonal attack onto a lake square is withheld (including with a fixture
occupant placed there, to prove the exclusion is the geometric `isLake` check
and not merely "no occupant"); the lake-corner skirt is attackable (Battle A6
-> B5, B6 a lake); and a diagonal target is offered as an ordinary attack
alongside an orthogonal one (combat resolution itself is unchanged/
direction-independent in `combat.ts`, so this test only confirms both are
offered on equal footing, per the plan's own framing). Also rewrote the
pre-existing `legalAttacks` test "never returns a diagonal attack target"
(now genuinely false under major 2) into "offers a movable enemy one square
diagonally as an attack", since its militia fixtures are movable pieces that
must now be offered.

Two pre-existing tests outside `movement.ts` broke as a direct, correct
consequence of `legalAttacks` now including diagonal attacks (both already
call `legalAttacks`/`legalDestinations` at their Battle-default layout, with
no layout-threading changes needed): `playAnnouncement.test.ts`'s "uses
singular wording for exactly one available move" had a diagonally-adjacent
enemy militia that is now a legal attack, changing its expected count from 1
to 2; reworked its fixture (enemy orthogonal instead of diagonal, so the
diagonal squares stay empty) so the test still exercises the singular-count
wording it was written to check, rather than weakening the assertion. This
is not a deviation from the plan - the plan's own Grounding facts / Step 3
notes establish that any live consumer calling these functions picks up
parametric/rule changes automatically - but is called out since it is a file
outside `movement.ts` that needed an edit to keep `npm test` green.

`npm run typecheck && npm run lint && npm test` all pass (564 tests, up from
556 net of the one rewritten test). `npx prettier --check` is clean on every
file this step touched. Manual confirmation of the live behavior (Gate B) is
explicitly deferred to Step 6 per the plan, since diagonal attacks are not
yet rendered/highlighted in the UI.

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

Status: committed

Notes: `boardView.ts`'s five functions each gained the same optional trailing
`layout: BoardLayout = BATTLE_LAYOUT` parameter Step 3 established for
`board.ts` - every pre-existing call site keeps its old two/one-argument
call and behaves unchanged. `visibleRows` was rewritten as one formula
(nearest lake row from `Math.min`/`Math.max` over `layout.lakeRows`; a
buffer row only pushed when `layout.hasBuffer`; home rows counted from
`layout.homeRowsPerSide`/`layout.rowCount`) rather than two side-keyed
literal arrays, so it produces Skirmish's no-buffer 4-row crop (lake row +
3 home rows) from the same code path as Battle's existing 6-row one, with no
`if (layout === skirmish)` branch anywhere. `movePathSquares` needed no
`layout` parameter at all: its column arithmetic was switched from the
Battle-only `COLUMNS.indexOf`/`COLUMNS[...]` to `columnIndexOf`/
`columnLetter` (letter-offset arithmetic already added to `board.ts` in Step
3), which is board-width-independent by construction - a deviation from the
plan's literal "derive `movePathSquares` ... from the resolved layout"
wording, recorded because the function turned out not to need the argument
the plan implied it would take; a test proves it still works past Battle's
12-column width (an H1→F1 Skirmish-sized two-square move). `Board.tsx`,
`FullBoard.tsx`, and `PlayBoard.tsx` each gained an optional `layout`
prop (`Board`/`FullBoard` default to `BATTLE_LAYOUT`; `PlayBoard` instead
derives it from `session.play.edition?.boardLayout ?? BATTLE_LAYOUT`, since
the session already carries the resolved edition per Step 3 and threading a
second, independent prop would let it disagree with the board actually being
played), threaded into their `visibleRows`/`visibleColumns`/`fullBoardRows`/
`fullBoardDisplayPosition`/`isLake` calls. Grid sizing is now driven by
`--columns`/`--rows` CSS custom properties set inline from the layout (or,
for `Board`/`FullBoard`, the actual rendered row/column array lengths) rather
than the CSS files' old hardcoded `repeat(12, ...)`/`repeat(6, ...)`;
`FullBoard.tsx` sets these on `.full-board__stage` (a sibling ancestor of the
grid, mirroring how `--square`/`--board-border` already reach it) rather than
on `.full-board` itself, since `AccessibleGrid` does not expose a `style`
prop and CSS custom properties inherit down through its wrapper regardless.
`HotSeatGame.tsx`'s `<Board>` call now passes `layout={placement.boardLayout}`
(its `<PlayBoard>` call needed no change - `PlayBoard` derives its own layout
from the session). `EngineGame.tsx` and `ReviewScreen.tsx` were **not**
touched: both are out of this step's named scope (`Board.tsx`/`PlayBoard.tsx`/
`FullBoard.tsx`), both build only Battle placements/sessions today, and both
already compile and behave unchanged through the new props' Battle defaults -
matching Step 3/4's precedent of leaving unnamed live consumers alone when a
default parameter covers them.

Diagonal-attack highlighting needed **no new code**: `playSession.ts`'s
`attackTargets`/`actionableSquares` already call `legalAttacks` directly with
no filtering, and Step 5 already made `legalAttacks` return diagonal targets
alongside orthogonal ones, so `FullBoard.tsx`'s existing `attackSquares`
rendering (the `--attack` fill/border, `squareLabel`'s "attack {piece}"
wording) already treats a diagonal target exactly like an orthogonal one -
this step's Notes record that fact rather than a change, since the plan
listed it as a thing to "confirm" via Gate B. Grid keyboard navigation
(`gridNavigation.ts`/`AccessibleGrid.tsx`) likewise needed no change: both
were already generic over `rowCount`/`columnCount` derived from the caller's
own row/column arrays, with no board-size assumption baked in anywhere -
confirmed by reading both files, not by adding new tests, since there was no
board-specific behavior to add coverage for.

Added the Skirmish-layout `describe` blocks `boardView.test.ts`'s
verification calls for (`visibleRows` proving no `"buffer"` band ever
appears; `visibleColumns`/`fullBoardRows`/`fullBoardDisplayPosition` at 8×8;
`movePathSquares`'s two board-size-independence cases above), 13 new tests
(564 → 577, Step 5's baseline). No existing test needed edits: every pre-existing
`boardView.ts`/`Board.tsx`/`PlayBoard.tsx`/`FullBoard.tsx` call site keeps
working unchanged through the new optional parameters' defaults.
`npm run typecheck && npm run lint && npm test` all pass (577 tests);
`npm run build` succeeds; `npx prettier --write` was run on every file this
step touched (four files needed re-wrapping; the three flagged markdown files
predate this step and are out of scope, per Step 3/4's precedent). The live
app was **not** temporarily defaulted to Skirmish - no such throwaway edit
was made or needs reverting; the plan's manual Gate B/rendering verification
is the owner's to run once Step 7's picker exists, and in the meantime can be
reached by temporarily editing `HotSeatGame.tsx`'s
`newSession()`/`buildInitialGameState(next.white, next.black)` calls to pass
`EDITIONS["2-0:SKIRMISH"]` (both must agree, or `buildInitialGameState`'s own
board-layout-mismatch check throws) - not applied here, since Step 6's own
scope is the rendering layer, not a way to reach it before the picker lands.

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

Gate B result (owner, at Step 6): the rendering items above all pass — 8×8
board, no buffer row in placement, 16-piece tray, correct orientation, and
diagonal attacks highlighted as attacks with Tower/Flag/empty diagonals
correctly never offered. The owner also observed, on the temporary Skirmish
default, that **pieces could move onto drawn lake squares and were blocked
from ordinary moves elsewhere**. This is **not a Step 6 defect**: the
renderer draws Skirmish's lakes correctly (rows 4-5), but the play-phase rule
calls still run on the `BATTLE_LAYOUT` default, so the engine reads lakes at
Battle's rows 6-7. That wiring was deliberately deferred by Step 3's Notes and
is **Step 7's** job; see Step 7's explicit call-out below.

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

**Thread the layout into the play-phase rule calls (required — observed
failing at Gate B).** Step 3 deliberately left every ply-generation call on its
Battle default, so on a non-Battle board the engine reads Battle's lake
pattern and bounds while the renderer draws the real ones. Confirmed live at
Step 6's Gate B: on Skirmish, pieces could move onto drawn lake squares
(rows 4-5, which Battle's layout says are open) and were refused ordinary
moves onto open squares (rows 6-7 at columns B/C/F/G, which Battle's layout
says are lakes). Pass the resolved `state.edition.boardLayout` into:

- `play.ts` — `applyMove`'s `legalAttacks`/`legalDestinations`/`resolveCombat`
  calls, and the `computeOutcome` calls in `startPlay` and `applyMove`.
- `playSession.ts` — every `legalDestinations`/`legalAttacks` call (the
  selectable-piece test, the highlight sets, and the ply-application path),
  reading the layout from `session.play.edition`.

Battle keeps its current behavior because the Battle edition resolves to the
same layout the default supplied.

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
unencumbered move)/combat as before, now with diagonal attacks available. On
the Skirmish board specifically, confirm the Gate B defect is gone: a piece
**cannot** move onto any drawn lake square (rows 4-5 at columns B/C/F/G) and
**can** move onto every open square, including rows 6-7 at those columns.
**Automated** — unit tests driving a Skirmish `PlayState` through
`playSession`/`applyMove` that assert a lake square on the Skirmish layout is
never among the offered destinations and that a Battle-lake-but-Skirmish-open
square is. `npm run typecheck && npm run lint && npm test` remain green.

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
