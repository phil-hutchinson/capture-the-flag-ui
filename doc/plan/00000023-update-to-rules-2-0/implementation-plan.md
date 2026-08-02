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
on their Battle defaults, since wiring `play.ts` to actually _use_
`state.edition.boardLayout` for rule enforcement is Step 7's job once a
non-Battle edition is reachable through the picker - this step only extends
the artifacts to _carry_ it, per the plan's own wording.

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

Status: committed

Notes: Two independent pieces of work, as the step describes.

**The required layout-threading fix.** `play.ts`: `startPlay` and `applyMove`
each now compute `const layout = state.edition?.boardLayout ?? BATTLE_LAYOUT`
(matching every other consumer's own optional-`edition` fallback, e.g.
`gameState.ts`'s `renderPositionBlock`/`PlayBoard.tsx`) and pass it into every
`legalAttacks`/`legalDestinations`/`resolveCombat`/`computeOutcome` call.
`playSession.ts` gained a private `sessionLayout(session)` helper doing the
same lookup off `session.play.edition`, threaded into `isOwnMovablePiece`
(which gained a required `layout` parameter) and every `allSquares`/
`legalDestinations`/`legalAttacks` call in `actionableSquares`,
`attackTargets`, `activatableSquares`, and `activateSquare`. Battle is
unaffected (its edition resolves to the same `BATTLE_LAYOUT` object the old
default supplied). Regression tests: `play.test.ts` and `playSession.test.ts`
each gained a "threads the edition's board layout" describe block building a
Skirmish `InitialGameState`/`PlayState` and asserting (a) a Skirmish lake
square (B4 - a lake under Skirmish's layout but open ground under Battle's)
is never a legal/actionable destination and `applyMove` throws if attempted,
and (b) a Battle-lake-but-Skirmish-open square (B6 - the reverse: a lake under
Battle, open under Skirmish) is offered and the move applies correctly. Both
tests were verified to fail (4 failures) with the fix reverted via a temporary
`git stash` of just `play.ts`/`playSession.ts`, confirming they actually
exercise the defect, before restoring the fix.

**One deviation, extending the fix's own reach beyond its literal file list:**
`playAnnouncement.ts`'s `describeActivation` also called
`legalDestinations`/`legalAttacks` at the Battle default (to count "N moves
available" for the selection-announcement sentence) - the same defect class,
now live now that Skirmish is reachable (it would under- or over-count a
selected piece's moves on Skirmish). Threaded with
`after.play.edition?.boardLayout ?? BATTLE_LAYOUT`, the same pattern as
everywhere else. Not in the step's own named list (`play.ts`/`playSession.ts`
only) but the same bug in a third live consumer of the same two functions;
left unfixed it would have been a known, undocumented regression the moment
this step made Skirmish reachable, so it is recorded here rather than passed
silently to Step 10's copy/accessibility audit.

**The Battle/Skirmish picker.** New `src/board/GameChoice.tsx` (+ `.css`): a
`role="group"` pair of toggle buttons ("Skirmish"/"Battle", `aria-pressed`
marking the current pick, Skirmish selected by default) plus a plain-language
description of whichever is currently selected and a single "Play &lt;Game&gt;"
button that reports the chosen `Edition` - mirroring `EngineSideChoice.tsx`'s
established "in-progress local choice, reported only once confirmed" shape.
New `src/board/gameNames.ts` centralizes "Battle"/"Skirmish" naming and a
plain-language board-size phrase (`gameName`/`boardSizeDescription`),
mirroring `sideNames.ts`'s single-home-for-a-mapping precedent, reused by both
`GameChoice.tsx` and `HotSeatGame.tsx`.

`HotSeatGame.tsx`: `session` (`PlacementSession`) is now nullable and a new
`edition: Edition | null` state gates a new first branch - while `edition` is
`null`, the component renders only `GameChoice` (with the same title/back
button/`LeaveGameDialog` chrome the other three states share). `handleChooseGame`
sets `edition` and seeds `session` via `newSession(chosenEdition)` in the same
event, and also seeds a new `gameAnnouncement` live-region string ("You chose
Skirmish. Placing on an 8x8 board.") rendered in a visually-hidden
`role="status" aria-live="polite"` paragraph (`.hot-seat-game__game-announcement`,
mirroring `AccessibleGrid.css`'s own sr-only live-region pattern) on the
placement screen - satisfying the step's "announce the choice and the
resulting board" requirement without a new focus-management mechanism (the
existing once-on-mount heading focus is unaffected; this is the same
"pre-filled on first mount" live-region shape `handleConfirm`'s
immediate-ending announcement already uses). `handleConfirm` now passes
`edition` into `buildInitialGameState(next.white, next.black, edition)` so the
built `InitialGameState`/`PlayState`/board/record all carry the game actually
chosen (previously implicit via `buildInitialGameState`'s Battle default).
`gameInProgress` gained an `edition !== null` guard so the picker screen's own
"Back to start" never asks for confirmation (nothing is yet at stake, matching
`EngineGame.tsx`'s identical treatment of its own side-choice phase).

Nullable `session` needed two mechanical follow-ons, both matching
`EngineGame.tsx`'s established precedent for its own nullable `placement`: (1)
every `setSession((current) => updateActivePlacement(current, ...))` call
became `setSession((current) => current ? updateActivePlacement(current, ...) : current)`,
since the updater's `current` parameter is typed `PlacementSession | null`;
(2) a `if (session === null) { return null; }` unreachable-in-practice guard
was added (mirroring the pre-existing `session.active === null` guard
immediately below it), and `handleConfirm` additionally re-checks
`session === null || edition === null` at its own top _despite_ the outer
guards already having narrowed both, because TypeScript does not carry
narrowing of an outer `const` across a nested function declaration's own
boundary - confirmed by `tsc -b` actually failing without it; the same reason
`EngineGame.tsx`'s own `handleConfirm` re-checks `placement`/`humanSide`.

**Deviation: "New game" returns to the picker, not a same-edition replay.**
The plan does not specify this either way. `handleNewGame` now resets `edition`
and `session` to `null` (routing back to `GameChoice`) alongside the existing
resets, rather than silently starting a fresh session for whichever edition
was just played - a fresh game is exactly the moment to reconsider which to
play, and this keeps a single, consistent entry point into a hot-seat game
(the picker) rather than two (initial mount vs. "New game").

`npm run typecheck && npm run lint && npm test` all pass (581 tests, up from
577 - the four new regression tests). `npm run build` succeeds. `npx prettier
--check` is clean on every file this step touched. Manual verification (Gate A

- Gate C) is the owner's to run per the standard pipeline, not run here.

**Owner feedback at the Gate A + Gate C manual check (2026-08-01), addressed
as a scoped follow-up.** `GameChoice` always pre-selected Skirmish, including
after "New game" returned to it. The owner asked instead for: Skirmish
pre-selected only on the first game of a session (nothing played yet); after
that, the picker pre-selects **whichever game was just played** (Battle after
a Battle game, Skirmish after a Skirmish one), still scoped to the component's
lifetime (leaving to the start screen and back starts over at Skirmish).
Implemented via a new `lastPlayedEdition: Edition | null` state in
`HotSeatGame.tsx`, set from `edition` by `handleNewGame` just before `edition`
itself resets to `null`, and passed to a new required `lastPlayed: Edition |
null` prop on `GameChoice`. `GameChoice`'s local `choice` state now lazily
initializes from a new pure helper, `defaultGameId(lastPlayed)` in
`gameNames.ts` (`lastPlayed?.id ?? "2-0:SKIRMISH"`), rather than the literal
`"2-0:SKIRMISH"` default - factored out as a plain function, matching this
codebase's convention of testing UI logic like this without a component-test
harness, since none exists in this project. Added `gameNames.test.ts` (new
file; `gameNames.ts` had no dedicated tests before) covering `defaultGameId`
(null -> Skirmish; Battle -> Battle; Skirmish -> Skirmish) alongside `gameName`
and `boardSizeDescription`, which were previously untested pure functions.
`npm run typecheck && npm run lint && npm test` all pass (588 tests, up from
581 - seven new tests, all in `gameNames.test.ts`). `npx prettier --check` is
clean on every file touched. Files touched: `src/board/gameNames.ts`,
`src/board/GameChoice.tsx`, `src/board/HotSeatGame.tsx`, new
`src/board/gameNames.test.ts`.

Add the per-game **Battle/Skirmish choice** and thread it end to end. Present the
choice at the **start of a hot-seat game**, **before placement**, pre-selecting
**Skirmish** as the recommended first game **when nothing has been played yet
this session**, and otherwise pre-selecting **whichever game was just
played** (Battle after a Battle game, Skirmish after a Skirmish one) — e.g.
after "New game" returns to this choice screen (name the two games to
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
game": confirm the choice appears with **Skirmish pre-selected** (nothing has
been played yet this session); choose
Skirmish → 8×8 board, no buffer row, 16-piece tray, place onto freely chosen home
squares, and the Tower-adjacency rule (including diagonally) still blocks
finishing with an actionable message; complete both armies and confirm the reveal
shows both 16-piece armies. Then start a new game, choose Battle → the unchanged
12×12 game with its 25-piece army, placement/movement (including the two-square
unencumbered move)/combat as before, now with diagonal attacks available. On
the Skirmish board specifically, confirm the Gate B defect is gone: a piece
**cannot** move onto any drawn lake square (rows 4-5 at columns B/C/F/G) and
**can** move onto every open square, including rows 6-7 at those columns.
Finish that Battle game and choose "New game": confirm the picker now
pre-selects **Battle** (the game just played), not Skirmish; finish a Skirmish
game the same way and confirm "New game" pre-selects **Skirmish**.
**Automated** — unit tests driving a Skirmish `PlayState` through
`playSession`/`applyMove` that assert a lake square on the Skirmish layout is
never among the offered destinations and that a Battle-lake-but-Skirmish-open
square is; unit tests for the picker's default-selection rule (nothing played
yet -> Skirmish; last played Battle -> Battle; last played Skirmish ->
Skirmish). `npm run typecheck && npm run lint && npm test` remain green.

---

## Step 8 — Records: edition-id tag, size-parametric position block, reader dispatch

Status: committed

Notes: All four bullets landed as scoped.

**Writer.** `RULESET_TAG` (gameState.ts) is repurposed rather than removed:
it now equals `DEFAULT_EDITION.id` (`"2-0:BATTLE"`) instead of the literal
`"1.2:PRE-RELEASE"` string, so the many pre-existing fixtures elsewhere in
the codebase (`playAnnouncement.test.ts`, `playWarnings*.test.ts`,
`playSession.test.ts`, `play.test.ts`) that import it as a generic "a valid
ruleset tag" placeholder for a Battle-default `InitialGameState`/`PlayState`
keep compiling and stay semantically correct (their fixtures carry no
`edition` field either, defaulting to Battle, so `RULESET_TAG`'s new value
matches). `buildInitialGameState` no longer uses that constant directly,
though: it now tags every artifact with `edition.id` (the _actual_ resolved
edition passed in), so a Skirmish game is correctly tagged `2-0:SKIRMISH`,
not silently defaulted to Battle's tag as it effectively was before (the old
`RULESET_TAG` constant was written unconditionally). `renderGameRecord`
(play.ts) needed no code change at all - it already interpolates
`state.ruleset`, which now correctly carries the edition id through from
`buildInitialGameState`/`startPlay` for whichever edition was actually
played.

**Notation.** `SQUARE_PATTERN` widened from `[A-L](?:1[0-2]|[1-9])` to
`[A-Z](?:[1-9][0-9]?)` (column A-Z, row 1-99, no leading zero) - a
single-character column, matching the rules' own "up to 26 columns" limit
and the Grounding facts' stated row ceiling. No other change to
`notation.ts` was needed (`toSquare`/`renderMoveToken` were already
column/row-generic).

**Reader dispatch.** `readRecord.ts` no longer imports `RULESET_TAG`; it
looks the parsed `Ruleset` tag up in the `EDITIONS` registry
(`edition.ts`) via a new `isKnownEditionId` type guard, and on a hit passes
that edition's `boardLayout` into `recordFile.ts`'s `parseRecordFile`
(which gained an optional `layout: BoardLayout = BATTLE_LAYOUT` parameter,
threaded straight into `parsePositionBlock`). A `1.2:PRE-RELEASE` tag is no
longer a case at all - it falls straight through the same `unknownRuleset`
path as any other unrecognized name, exactly as the step specifies. Since
both published editions are served by the same major-2 rule engine
(parameterized by `BoardLayout`, per this story's core architecture
decision), "dispatch on the edition id" resolves to "look up that edition's
layout and hand it to the one parametric reader" rather than routing to
two different reader modules - there is only ever one major-2 reader.

**Tests updated/added**, per the step's own file list:
`notation.test.ts` (2 of its "malformed tokens" cases - column M, row 13 -
were previously malformed only because of the old fixed A-L/1-12 bounds and
are now legitimately valid squares; replaced with genuinely malformed cases
under the new pattern - a two-letter column, row 100, row 0 - and added a
new "beyond Battle's old bounds" parse case, column Z/row 99); `readRecord.test.ts`
and `recordFile.test.ts` (every literal `1.2:PRE-RELEASE` tag retargeted to
`2-0:BATTLE` where the fixture exercises structural/replay behavior
unrelated to dispatch; the one dispatch test that used to _accept_ a
`1.2:PRE-RELEASE` file now asserts it is rejected as `unknownRuleset`, per
the step; both files gained a new Skirmish (8x8) case -
`recordFile.test.ts` a direct `parseRecordFile(text, layout)` round trip
plus its rejection against the Battle-default layout, `readRecord.test.ts`
a full synthetic extended-notation Skirmish game round-tripping through the
real `readRecord` dispatch); `gameState.test.ts` (its two `(ruleset
1.2:PRE-RELEASE)` describe titles reworded to "ruleset major 2"; a new test
that `buildInitialGameState` tags a Skirmish game `2-0:SKIRMISH` when given
that edition; the pre-existing Skirmish-edition describe block's three
hand-built fixtures, which paired `edition: SKIRMISH_EDITION` with the
now-Battle-valued `ruleset: RULESET_TAG` - stale even before this step, but
made freshly inconsistent by RULESET_TAG's new value - corrected to
`ruleset: SKIRMISH_EDITION.id`).

**Deviation - the writer/reader "round trip" tests do not literally pipe
`renderGameRecord`'s output through `readRecord` when moves are involved.**
`renderGameRecord` still writes the move sequence in the _plain_ form
(`A2A3`, no separator - unchanged, deliberately out of this step's scope),
and `parseMoveToken` deliberately rejects plain-form tokens (a pre-existing,
intentional restriction predating this story - see notation.ts's header).
Switching the writer to the extended form is the standing "emitted record
notation" backburner item this story's story.md lists as out of scope, not
this step's job. So `readRecord.test.ts`'s new round-trip coverage splits
the same way the format itself does: one `it.each` block drives
`renderGameRecord` through `readRecord` for both editions on a freshly
started (zero-move) game, exercising the real writer end to end for
everything this step actually changed (the `Ruleset` tag and the
size-parametric position block); a second, hand-built-extended-notation
block (mirroring the pre-existing 2-0:BATTLE synthetic-record tests)
covers a _played_ Skirmish game's full move-sequence round trip, including
a move that lands on the Skirmish board's near-lake row at a
non-lake-column square - proof the reader is reading _that_ edition's lake
layout, not Battle's. This was not flagged as a place to split the step; it
follows directly from a pre-existing, intentional restriction the plan
did not ask this step to lift.

Note per the step's own instruction: verifying the reviewer against **real
engine-produced** 2.0 records remains out of scope here (the companion
repo's story 00000034 branch has no such fixtures available in this
container); every round-trip test above is entirely app-produced, per the
plan.

**Deliberately not touched**, following Step 1/5's established precedent of
leaving a file's stale header/comment alone unless the step actually
reworks that file: `replay.ts`'s header comment still reads "ruleset
1.2:PRE-RELEASE" (it is rules-blind and version-agnostic in practice, and
was not in this step's file list); `reviewText.ts`'s `wrongRowCount`
player-facing message is still hardcoded to "a full 12x12 board" regardless
of which edition the record claims, which will read wrong for an
undersized Skirmish record - this is exactly the kind of hardcoded-12x12
copy Step 10 ("Copy, instructions, and accessibility audit") is scoped to
sweep for, so it is left for that step rather than fixed here.

**Explicit, justified deviation (recorded 2026-08-02, peer-review comment
#1).** The reader does not recover the board's dimensions by counting the
position block's lines/cells, as the Grounding facts' literal wording
describes; it looks the `Ruleset` tag up in `EDITIONS`, takes that edition's
`BoardLayout`, and **validates** the block against it (right row/cell count,
right lake cells), the same shape `parsePositionBlock` already used before
this step for the home-zone row count it cannot get from the block at all.
This is behaviorally equivalent to counting for both published editions,
since each pins its board layout to its edition id one-to-one — there is no
case today where the tag and the block's actual size could disagree. Counting
independently and reconciling against the edition would be more work for no
observable difference in what the reader accepts or rejects, and would still
need the edition for the home-zone row count regardless. Full block-derived
sizing (so a reader could in principle validate a layout it does not already
know by id) is deferred to the follow-up records story
(`doc/plan/proposed-stories/rules-2-0-edition-experience-and-records.md`).
`recordFile.ts`'s module comment, which previously asserted the opposite
("board dimensions and lake layout are read back out of the block"), is
corrected to describe the block as validated against the edition's layout.

`npm run typecheck && npm run lint && npm test` all pass (596 tests, up
from 588 at the end of Step 7). `npm run build` succeeds. `npx prettier
--write` was run on the two test files it reformatted
(`recordFile.test.ts`, `readRecord.test.ts`); `npx prettier --check` is
clean on every file this step touched.

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
(Gate D) — deferred to Step 8a; do not run it at this step.** In each edition,
play to an ending (Flag capture; a maneuvering sequence that draws at the 50th
quiet move; a draw by agreement), dump the developer record, confirm the right
edition id / a size-correct block / a plausible result and reason, and
**re-import that dump into the reviewer** and confirm it replays end to end.

**Why Gate D is deferred.** Its final clause is unachievable as this step
leaves the code: `renderGameRecord` emits **plain**-form move tokens
(`A2A3`), which `parseMoveToken` classifies as `plainNotation` and the
reviewer deliberately rejects (`reviewText.ts`, "uses the short move notation,
which doesn't record what happened to each piece"). That is **pre-existing**
behaviour inherited from major 1, not a regression introduced here — but it
means the app has never been able to re-read its own dump for a game with
moves. Step 8a fixes it; Gate D runs once, in full, at the end of Step 8a.

---

## Step 8a — Emit the extended notation from the app's record writer

Status: committed

Notes: `applyMove` (`play.ts`) now builds a `RecordedMove` from the combat
outcome it already has and appends `renderMoveToken(...)` to `state.moves`,
so the extended token is recorded **at the point the move is applied** — the
writer is never asked to re-derive outcomes, per this step's constraint. The
removal flags read directly off `resolveCombat`'s three-valued `CombatResult`:
`fromRemoved` unless `attackerWins`, `toRemoved` unless `attackerLoses`, so a
plain move marks neither square, a won attack marks the destination, a lost
attack marks the source, and a mutual loss marks both. `renderGameRecord`
needed no logic change at all — it already interpolates `state.moves`
verbatim, so changing what is stored changed what is written. `notation.ts`,
`readRecord.ts`, `recordFile.ts`, and `reviewText.ts` were **not** touched:
`parseMoveToken` already accepted the extended form, and the `plainNotation`
rejection path and its player-facing message are deliberately intact (a
plain-form file from another producer must still be rejected clearly) — still
covered by the pre-existing tests in `notation.test.ts`, `recordFile.test.ts`,
and `reviewText.test.ts`, all green. `GameRecord.tsx` and several doc comments
in `play.ts` were updated to describe the extended form; those are
comment-only changes.

`readRecord.test.ts` gained a played-game round trip driving the **real**
writer (`startPlay`/`applyMove`/`renderGameRecord`) rather than hand-built
tokens, parameterised over both editions, covering a move that removes one
piece (`A2-A3x`, attacker wins) and one that removes both (`C3x-C2x`, equal
ranks trade), and asserting the re-read final position equals the writer's own
final board. The fixture uses columns A-E and rows 1-3, ordinary ground on
both layouts, so one fixture serves both board sizes.

**Process note:** the implementing agent hit its session limit and was cut off
mid-report, after the code and tests were complete but before it recorded this
Status/Notes. The orchestrator reviewed the full diff, re-ran typecheck, lint,
and the suite (598 tests, up from 596), and confirmed every element of this
step's automated verification was present, then wrote these Notes. No
deviations from the plan's wording were found in the delivered work.

**Scope note for a cold reader.** `story.md`'s **Out of scope** section lists
"switching this app's emitted record to the extended notation" as a standing
backburner item. **The owner brought it into scope on 2026-08-01**, during
Step 8's manual gate, on learning that leaving it out makes Gate D's
"re-import that dump into the reviewer" clause impossible to satisfy — the app
could never re-read a record of its own played game. That decision overrides
the story's out-of-scope entry for this one item and nothing else; the rest of
the backburner pair ("saving a played game to a file") stays out of scope.
Numbered `8a` rather than `9` so the existing Steps 9-11 — referenced by name
throughout this plan and by earlier steps' Notes — keep their numbers.

**Gate D defect fix (2026-08-02, owner report during Gate D manual
verification), added on top of the above.** A `2-0:SKIRMISH` record imported
into "Review a game" replayed correctly but was **rendered on a 12x12 Battle
board**: a blank region of unused board, pieces visually passing through
Battle's lake squares (rows 6-7, columns B/C/F/G/J/K) as they moved, and
Skirmish's real lakes (rows 4-5) drawn as ordinary open squares. Root cause,
confirmed as diagnosed: `ReviewScreen.tsx` rendered `<FullBoard>` with no
`layout` prop, so Step 6's Battle-default silently applied regardless of the
record's own edition — `readRecord.ts` already resolved the record's
`Ruleset` tag to its `Edition` (to size the position block correctly) but
discarded it once parsing was done.

Fix: `ReadRecordResult`'s `"parsed"` case now carries the resolved `Edition`
alongside `record` (`readRecord.ts`), rather than folding it into
`ReplayedRecord`/`ParsedRecord` themselves — `recordFile.ts` and `replay.ts`
stay exactly as they were (still `BoardLayout`-parametric, not
`Edition`-aware; neither's signature nor test file needed to change), since
`readRecord.ts` is the one module that already resolves the full `Edition`
and is a natural, minimal-diff place to attach it to its own result. Threaded
through: `ImportScreen.tsx`'s `onImported` callback now passes
`(record, edition)`; `App.tsx`'s `review` screen-state variant carries both;
`ReviewScreen.tsx` takes a new required `edition: Edition` prop and passes
`layout={edition.boardLayout}` into `<FullBoard>`. This is a deliberate,
noted deviation from the plan's literal suggestion to carry the edition
"through `ReplayedRecord` / the review session" — doing that would have
required `replay.ts`'s `replayRecord` to accept an `Edition` parameter purely
to plumb it through unused (it consults no board geometry at all), which
would have forced every one of `replay.test.ts`'s ~12 call sites to change
for no logic reason; attaching it at the `readRecord.ts` boundary instead
achieves the same "ReviewScreen can get to it" outcome with no such churn.

Also swept, per the task's explicit instruction to check other review-side
12x12 assumptions: `reviewText.ts`'s `describePositionBlockError` had two
messages hardcoded to a fixed board size regardless of edition —
`wrongRowCount` ("isn't a full 12x12 board ... instead of 12") and
`wrongCellCount` ("isn't 12 squares wide") — both flagged as wrong for a
Skirmish record (an 8x8 file failing this check would have been told it
should have been 12x12). Fixed alongside the main defect rather than left for
Step 10, since it is the same class of "review surface assumes Battle's
12x12" bug the task called out by name. `PositionBlockError`'s
`wrongRowCount`/`wrongCellCount` variants (`gameState.ts`) each gained an
`expected...Count` field carrying the `layout`'s own row/column count (set at
both throw sites in `parsePositionBlock`), and `reviewText.ts` now interpolates
that instead of the literal `12`. Updated the pre-existing fixtures in
`gameState.test.ts` (3), `recordFile.test.ts` (1), and `reviewText.test.ts`
(2) to the new required fields, and added two new `reviewText.test.ts` cases
proving the message now names 8x8 for a Skirmish-sized mismatch, not 12x12.

New automated coverage (`readRecord.test.ts`): a
`"readRecord - surfaces the record's own resolved Edition (Gate D defect
fix)"` describe block asserting a `2-0:BATTLE` record's read-back `edition`
has `boardLayout.columnCount`/`rowCount` 12/12 and lake cells at rows 6-7
(B/C/F/G/J/K), and a `2-0:SKIRMISH` record's has 8/8 and lake cells at rows
4-5 (B/C/F/G) — direct proof the reader surfaces the _right_ edition's
geometry, not Battle's, for each ruleset. `npm run typecheck && npm run lint
&& npm test` all pass (604 tests, up from 598). `npm run build` succeeds.
`npx prettier --check` is clean on every file touched. Files touched beyond
the ones already listed above for this step:
`src/rules/readRecord.ts`, `src/rules/readRecord.test.ts`, `src/App.tsx`,
`src/review/ImportScreen.tsx`, `src/review/ReviewScreen.tsx`,
`src/review/reviewText.ts`, `src/review/reviewText.test.ts`,
`src/rules/primary/v2/gameState.ts`, `src/rules/primary/v2/gameState.test.ts`,
`src/rules/primary/v2/recordFile.test.ts`. The manual re-check (Gate D in
full, including re-importing a Skirmish dump and confirming it now renders on
the right board) is the owner's to run, per this task's own instructions.

Change `renderGameRecord` (`play.ts`) to emit each move as an **extended**
token instead of the plain `A2A3` form, so a record the app writes is a record
the app can read. `notation.ts` already provides `renderMoveToken`, written
for exactly this purpose and currently called by nothing — use it rather than
forking the grammar. The extended form carries, per move, the source square,
the destination square, and which of the two pieces were removed, which is
precisely the information the plain form drops and the reviewer needs.

This requires the writer to know each move's **outcome** (which pieces were
removed), not just its source and destination. Establish where that comes
from: `applyMove` already resolves combat and knows the result, so the played
move list the record is rendered from must carry it. If the recorded move
history does not already retain removal information, extend it at the point
the move is applied — do not re-derive it by replaying the game inside the
writer.

Leave the **reader** alone: `parseMoveToken` already accepts the extended form
and this step introduces no new grammar. Keep the `plainNotation` rejection
path and its player-facing message exactly as they are — a plain-notation file
from some other producer must still be rejected with that clear message; it is
simply no longer something this app produces.

Why it comes here: it depends on Step 8's record layer being in place (the
edition tag, the size-parametric position block, and the reader dispatch), and
Gate D depends on it. It must precede Gate D, which now runs at the end of
this step.

How to verify: **automated** — extend Step 8's round-trip tests so a game
**with moves** (not just a zero-move opening record) round-trips in both
editions: render a played game to a record string, read it back, and confirm
the replayed position and every move match, including a move whose combat
removed one piece and one that removed both. Confirm a plain-notation file is
still rejected with the existing message. `npm run typecheck && npm run lint
&& npm test`. **Manual (Gate D, in full)** — run the whole of Step 8's Gate D
as written above, including the re-import clause, which now passes.

---

## Step 9 — Disable computer play; quarantine the engine and encoding tests

Status: committed

Notes: Two independent pieces of work, as the step describes.

**Disabling the choice.** `StartScreen.tsx`: the "Play against the computer"
button now renders `disabled` with a third `<span>` inside it (`aria-describedby`
pointing at it) reading "Not available right now - the rules changed and the
computer player needs to catch up." - plain language, no jargon, matching the
other two choices' own title/detail structure so it reads as one more line of
the same button rather than a bolted-on warning. `onPlayAgainstComputer` was
removed from `StartScreenProps` entirely (not left as an unused/dead prop),
since a disabled button has nothing to call. `App.tsx`: removed the `"engine"`
`Screen` variant, the `EngineGame` import, and the `onPlayAgainstComputer`
prop passed into `<StartScreen>` - there is no longer any code path that can
construct `{ kind: "engine" }`. `EngineGame.tsx` and its own child components
(`EngineSideChoice.tsx`, `src/engine/`, `src/encoding/eng-nn-1/`) are untouched
files, still present and still typechecking (confirmed by `npm run build`),
just reachable by nothing in `App.tsx` any longer - verified by grepping the
whole `src` tree for `EngineGame`/`src/engine`/`eng-nn-1` outside those
modules' own folders: every remaining hit is a comment, not an import or a
route.

**Quarantining the tests.** Read all five test files
(`src/encoding/eng-nn-1/{shared,encoder,decoder}.test.ts`,
`src/engine/{search,searchDriver}.test.ts`) before deciding, since the step
asks for a reasoned judgement, not a mechanical skip. Removed all five,
for two different reasons:

- `decoder.test.ts`, `search.test.ts`, `searchDriver.test.ts` test behavior
  that Step 5's diagonal attacks made **actively wrong**, not merely
  incomplete: `decoder.ts`'s `enumerateLegalPlies` calls the live
  `legalAttacks` (which now returns diagonal targets on the Battle-default
  layout these tests use), but `policyIndexForPly`'s `MOVEMENT_OFFSETS` table
  only covers the eight orthogonal offsets ENG_NN_1 originally specified -
  `expand()` in `search.ts` calls exactly that pairing on every node it
  expands, so the search **throws** the moment a diagonal attack is among a
  position's legal plies. These three files' tests were passing only because
  their hand-picked/`autoFill`-random positions happened not to expose a
  diagonal attack to `expand` - not because the code is correct - a textbook
  case of "passing by accident of which Battle-default paths it happened to
  exercise," which the task's own framing warned to watch for. Keeping them
  green (even skipped-with-a-comment) would misrepresent a module that is
  wrong, not just unused.
- `encoder.test.ts` and `shared.test.ts` test pure tensor/geometry math
  (`toMoverFrame`, `flatIndex`, plane indexing, `encodePosition`) that remains
  numerically correct for the fixed 12x12 board it was written against - nothing
  in Step 5 broke their assertions. They were removed anyway rather than kept:
  they exist only in service of the same non-functional pipeline (nothing in
  the live app can ever reach `encodePosition`'s output, since computer play
  is disabled and the one consumer that would decode its sibling policy tensor
  is the now-broken `decoder.ts`), and a future engine spec (the story's named
  follow-up) will very likely reshape both the tensor's fixed 12x12 size (to
  admit Skirmish) and its eight-offset movement table (to admit diagonal
  attacks) - at which point this coverage needs rewriting regardless of
  whether it was kept passing in the meantime. Removing rather than skipping
  matches the step's own stated preference ("prefer removing the test files -
  they test a knowingly-broken module").

Left the five now-testless modules' (`shared.ts`, `encoder.ts`, `decoder.ts`,
`search.ts`, `searchDriver.ts`) code **unchanged** except for a short header
note on each, added per the step's "if kept [skipped], mark them ... with a
comment pointing at the follow-up engine story" - applied here to the module
headers instead, since there is no longer a skipped test to attach the
comment to; each note names the specific mechanism that is broken (or, for
`shared.ts`/`encoder.ts`, non-representative) and points back to "Computer
play disabled" in `story.md` as the story that accepts this and the follow-up
engine spec as what will fix it. `searchClient.ts`, `searchWorker.ts`,
`inference.ts`, and `difficulty.ts` were left untouched (out of the step's
named scope - "modules ... left as-is") and were not separately re-audited
beyond confirming (via `npm run build`) that they still typecheck.

`npm run typecheck && npm run lint && npm test` all pass (561 tests, down
from 604 - the 43 removed tests: 7 + 18 + 10 in `src/encoding/eng-nn-1/`, 4 +
4 in `src/engine/`). `npm run build` succeeds. `npx prettier --check` is
clean on every file this step touched.

Gate F result (owner): **passed** — "Play against the computer" is visible
but disabled with the plain-language note and cannot be activated; "Review a
game" still opens the import screen; "Play a game" still starts the picker.

No deviations from the plan's substance. One judgement call, made and
recorded per the task's explicit instruction: all five test files were
removed rather than three removed / two kept-and-skipped, for the reasons
above (three are actively wrong, two are dead-code-adjacent and due for a
rewrite regardless).

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

Status: committed

Notes: A read-only sweep, per the step's own framing ("check rather than
assume"). No source file was changed - every player-facing surface already
satisfies the three bullets, and the one real gap found (below) is
pre-existing, unrelated to this story's rules changes, and out of this
step's scope to fix.

**What was checked and found already correct** (grepped the whole `src` tree
for `12`, `12x12`, `25`, `48`, `ply`/`plies`, `orthogonal`, `adjacent`, and
read every player-facing string, `aria-label`, and live-region message
directly):

- `src/board/GameChoice.tsx` / `gameNames.ts` - the Battle/Skirmish
  descriptions ("a 12x12 board with a 25-piece army" / "an 8x8 board with a
  16-piece army") are accurate per-edition facts (`GAME_DETAIL`), not
  hardcoded assumptions about the live game; `boardSizeDescription` reads the
  size straight off `edition.boardLayout`.
- `src/board/PlacementStatus.tsx` - the "N / total placed" readout reads
  `progress.total` (edition-sized), not a literal 25 or 48; the Tower-warning
  sentence names "even diagonally" already.
- `src/board/playAnnouncement.ts` - every sentence (selection count,
  plain-move, attack, deselect, result, draw-offer/decline/accept) is
  direction- and size-agnostic; `describeActivation`'s selection-count call
  already threads `after.play.edition?.boardLayout` (fixed at Step 7), so it
  counts moves correctly on either board; attacks are described identically
  whether diagonal or orthogonal, satisfying "describe diagonal attacks in
  plain words" by not needing to name a direction at all - the sentence
  structure ("X attacked Y at S: ...") never depended on orthogonality.
- `src/board/PlayStatus.tsx`, `DrawOffer.tsx`, `PlayWarnings.tsx`,
  `GameResult.tsx`, `LeaveGameDialog.tsx`, `GameRecord.tsx` (dev-only),
  `FlipBoardToggle.tsx` - no board-size or attack-direction assumptions in
  any player-facing string.
- `src/app/StartScreen.tsx` - "Play against the computer" disabled note reads
  as plain language, already correct from Step 9.
- `src/review/reviewText.ts` - `wrongRowCount`/`wrongCellCount` already
  interpolate `error.expectedRowCount`/`expectedCellCount` (fixed at Step
  8a's Gate D defect fix), not a literal 12; every other message is
  size-agnostic; "Move {ply}" always renders the word "Move", never "ply"
  (the identifier is a variable name, not player-facing text).
- `src/review/reviewSession.ts`, `MoveList.tsx`, `ImportScreen.tsx`,
  `ReviewScreen.tsx` - all size-/direction-agnostic; `ReviewScreen.tsx`
  already renders `layout={edition.boardLayout}` (Step 8a's Gate D fix), so
  a reviewed Skirmish game draws on its own 8x8 board.
- `src/board/FullBoard.tsx`'s `squareLabel` - "attack {color} {piece}" is
  used for every attack target regardless of direction; diagonal attacks
  (Step 5/6) were already wired through the same `attackSquares` prop with
  no separate code path, so they highlight and announce exactly like
  orthogonal ones (confirmed by reading the code, not merely inferred).
- `src/board/HotSeatGame.tsx` - the game-choice announcement
  (`"You chose {game}. Placing on {size}."`) is pushed into its own
  always-mounted, visually-hidden `role="status"` region exactly once per
  choice (`handleChooseGame`), and is never re-fired without a new choice,
  so nothing here is announced twice; the Tower-adjacency recovery message
  (`PlacementStatus`) and the Phase-2 activation/result announcements each
  live in their own single, established live region, matching the
  "never announced twice" requirement.
- Grid keyboard navigation (`src/board/grid/gridNavigation.ts`,
  `AccessibleGrid.tsx`) - confirmed generic over `rowCount`/`columnCount`
  with no board-size assumption (re-confirmed here since Step 6 only
  asserted this by reading, not by new tests; still true).
- No player-facing string anywhere in `src` (outside the dead
  `src/engine/`/`src/encoding/eng-nn-1/` modules, unreachable since Step 9)
  uses the word "ply"; every occurrence of the identifier `ply` is either an
  internal variable/parameter name or a code comment.

**One significant finding, not fixed here (pre-existing, out of this step's
scope).** Phase 1 placement (`src/board/Board.tsx`) has **no keyboard
operability and no accessible names at all** - its interactive squares are
plain `<div onClick>` elements with no `tabIndex`, no `role`, no
`onKeyDown`, and the placed-piece icons are `aria-hidden` with nothing else
naming the square's contents. This is not a regression from this story:
confirmed via `git log --follow -- src/board/Board.tsx` that no commit ever
added keyboard/AT support to this component, and via
`doc/plan/00000001-create-board-layout-tool/peer-review.md` (finding #1) that
this was identified, and deliberately deferred by the owner to a dedicated
follow-up, at that story's review. That follow-up,
`doc/plan/00000002-accessible-placement-board/`, has only ever been stubbed
(`story.md` only, one commit, no implementation plan, no code) - it was never
built. `eslint-plugin-jsx-a11y` (which story 00000002 considered adopting to
catch exactly this class of issue) was also never adopted. Phase 2 play and
the reviewer are unaffected - both already use `AccessibleGrid.tsx`'s
roving-tabindex pattern (confirmed working, per the checks above) - the gap
is isolated to the placement board on **both** editions.

**Why this is not fixed in this step:** building keyboard operability for
`Board.tsx` (a roving-tabindex/composite-widget grid, mirroring
`AccessibleGrid.tsx`, plus accessible names for every square) is exactly the
scope of the still-unbuilt story 00000002 - a substantial behavior change,
not a copy/text fix, and well beyond "preserve the established... patterns"
when no such pattern exists yet for this board. Per this step's own
instruction to report rather than silently fix an out-of-scope defect, this
is recorded here instead.

**Consequence for Gate E:** as literally written, Gate E's placement portion
("place on the Skirmish board... entirely by keyboard") **cannot be
completed** in the app's current state, on either edition, for a reason
unrelated to this story's rules changes. The owner should treat reviving
story 00000002 (or an equivalent) as a prerequisite for that portion of Gate
E, or explicitly re-scope/waive it, before relying on a keyboard-only
placement pass as a sign-off gate. The Phase-2/diagonal-attack and
reviewer portions of Gate E (which run entirely on `AccessibleGrid.tsx`) are
not affected by this and should be checkable as scripted.

Gate E result (owner): **passed, with its placement portion waived** — the
owner ran the testable portions (the Battle/Skirmish choice, a Phase-2
stretch including a diagonal attack on each board, and stepping through a
record in the reviewer, all by keyboard with a screen reader) and confirmed
the choice, the resulting board, the diagonal attack, and the review
navigation are all announced correctly with nothing announced twice, and
re-ran Gates A-D and F as a regression check with no issues. The placement
portion is waived for the reason above (`Board.tsx` has never been
keyboard-operable; that gap predates this story and is story 00000002's to
close), not run as part of this story's sign-off.

`npm run typecheck && npm run lint && npm test` all pass unchanged (561
tests, same as at the end of Step 9) - no source file was edited by this
step, so no new tests were needed. No deviations from the plan's wording
beyond the above (the plan did not anticipate finding a pre-existing gap
this large; it is reported per the plan's own "manual gates" framing rather
than treated as this step's job to close).

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

How to verify: **manual (Gate E — amended by the owner, 2026-08-02).** The
placement portion is **waived**, because the Phase 1 placement board
(`Board.tsx`) has never been keyboard-operable: its squares are plain
`<div onClick>` with no `tabIndex`, `role`, or key handling, and placed pieces
are `aria-hidden` with nothing naming a square's contents. That gap is
**pre-existing and untouched by this story** — it was deferred to story
00000002 (`doc/plan/00000002-accessible-placement-board/`), which contains
only a `story.md` and was never built. It is recorded here as a **known
limitation**, not fixed, per the owner's decision; building it is a composite-
widget keyboard model plus accessible naming, a feature in its own right.

Run the portions that are testable: with the mouse put away, and with a screen
reader, complete the **Battle/Skirmish choice**, then play a Phase-2 stretch on
**each** board that includes a **diagonal attack**, and step through a record
in the **reviewer** — all entirely by keyboard (these surfaces run on
`AccessibleGrid.tsx`'s roving-tabindex pattern, which is board-size-generic).
Confirm the choice, the resulting board, the diagonal attack, and the review
navigation are all announced correctly, and that nothing is announced twice.
Re-run all of Gates A–D and F as a regression sanity check.
`npm run typecheck && npm run lint && npm test` green.

---

## Step 11 — README and documentation check

Status: committed

Notes: `README.md` was materially out of date and was updated; no other
player-facing doc it links needed a change. Four things were wrong for a
player: it described a single fixed "army of 25 pieces" (now two games), it
listed three start-screen choices including computer play (now disabled), it
described attacks as strictly moving onto an enemy (diagonal attacks now
exist), and its status note claimed computer play worked.

Edits, all kept to plain language for a non-technical reader per the project's
intended audience: the intro now names **Skirmish** (sixteen pieces, small
board, "a good place to start") and **Battle** (twenty-five pieces, the full
game); the start-screen sentence drops computer play and says it is
temporarily unavailable; the setup bullet starts with picking a game; the
move/attack bullet describes the diagonal attack in plain words
("strike an enemy standing corner-to-corner with it, though it can only ever
move straight") including that towers and the flag are exempt, so "the flag
must always be taken head-on"; the computer-play bullet is rewritten as
temporarily unavailable; the status note is rewritten to match; and the rules
section now says plainly that recordings made under the earlier rules can no
longer be reviewed — a real, player-visible consequence of this story's
go-forward replacement.

Deliberately **not** changed: the "Review a recorded game" bullet's "a game
you play here can't be saved or reviewed yet". Step 8a made the developer
record dump re-importable, but that dump is a dev-build disclosure, not a
player-facing save; from a player's point of view there is still no way to
save their own game, and "saving a played game to a file" remains out of
scope. The word "ply" appears nowhere in the README, and no rules are
restated — the companion repository is still linked as the single source of
truth, per project conventions.

Verified with `npx prettier --check README.md` (clean) and
`npm run typecheck && npm run lint && npm test` (561 tests, unchanged — the
step touches documentation only).

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
