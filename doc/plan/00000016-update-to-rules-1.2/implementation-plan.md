# Implementation Plan — Story 00000016: Update to rules 1.2

This plan replaces the app's ruleset implementation (currently
`src/rules/primary/v1_1/`, ~7,000 lines including tests) with ruleset
**version 1.2** from the companion `capture-the-flag` repository. It is a
**replacement, not an addition**: no 1.1 rule logic is kept and games recorded
under `PRIMARY:1.1` deliberately stop being readable. Read `story.md` in this
folder in full before starting any step — its **Policy** and **Design
decisions** sections are fixed by the owner and are not restated here.

## Grounding facts (read once, applies to every step)

The single source of truth is the companion repo's `doc/ruleset/rules.md`
(version 1.2) and `doc/ruleset/technical-notes.md`. They are not mounted in
this container; fetch the raw text if a step needs to re-check a detail:

- `https://raw.githubusercontent.com/phil-hutchinson/capture-the-flag/main/doc/ruleset/rules.md`
- `https://raw.githubusercontent.com/phil-hutchinson/capture-the-flag/main/doc/ruleset/technical-notes.md`

The rules facts this plan is built on (resolved at plan time from the rules
text — the story listed several of these as "open items to resolve at plan
time", now resolved here):

- **Board is unchanged** — same 12×12 grid, same 4-row home zones (48 squares
  each), same three 2×2 lakes. `board.ts` and `board.test.ts` are **not**
  touched by this story. `notation.ts` (square coordinates A–L / 1–12) is
  likewise unchanged.
- **The army (rules §2.2)** — 25 pieces per side: three each of six ranked
  pieces — Master-of-Arms (rank 1, strongest), Champion (2), Knight (3),
  Halberdier (4), Foot Soldier (5), Militia (6) — plus six Towers and one
  Flag. Ranks are a strict order, 1 strongest → 6 weakest. Position-block
  symbols are `1`–`6` for the ranked pieces, `T` Tower, `F` Flag (no others).
- **Movement (rules §4.2)** — a mobile piece steps **one square orthogonally**
  (never diagonally) into an empty square, or attacks by moving onto an
  enemy-occupied square. A piece is **unencumbered** when there is **no enemy
  piece in any of its eight surrounding squares** (orthogonal or diagonal); an
  unencumbered piece **may** instead move **two squares orthogonally** in a
  straight line, provided the intermediate square is empty and not a lake.
  Resolved edge cases: encumbrance is judged only at the **origin** before the
  move; the far square of a two-square move may be empty (a move) **or** hold
  an enemy (an attack, resolved by combat); the one-square option always
  remains available regardless of encumbrance. Lakes are impassable (no piece
  may end on or pass through one); a friendly-occupied square is never a
  destination. Towers and the Flag never move.
- **Combat (rules §4.3)** — attacking is moving onto an enemy square; resolve
  immediately. Base result of two ranked pieces: the **lower rank number
  (stronger) wins**, the loser is removed; **equal rank is a draw** (both
  removed). **Formation bonus:** a piece has it when a friendly piece of
  **equal rank** stands within one square (orthogonal or diagonal) — judged
  for an **attacker before its move** (from its origin square) and for a
  **defender at the moment it is attacked**. Effect: a piece that is exactly
  **one rank weaker** than its opponent (its rank number is one higher) and
  has the formation bonus **draws (both removed) instead of losing**. (It only
  ever turns a clean win/loss into a mutual loss, only when the rank gap is
  exactly one, only for the weaker side.) **Any** piece attacking a **Tower**
  is a draw — both removed. Capturing the **Flag** (moving onto it) removes it
  and **wins immediately**. All 1.1 special abilities are gone: no charge, no
  rush, no defensive support, no Sapper-only tower destruction, no Assassin
  rules.
- **Endings (rules §5)** — Flag capture wins immediately; a player with **no
  legal move** on their turn loses immediately (sacrificial attacks are always
  legal, so this is rare). A **single shared inactivity counter** starts at 0,
  **rises by 1 on every move that removes no piece**, **resets to 0 whenever
  any piece is removed** (a winning attack, a mutual loss, or a tower trade),
  and makes the game a **draw when it reaches 50**. Draw by agreement is
  unchanged. The 1.1 Unbreachable Flag win, the per-player inactivity **loss**,
  and the separate progress counter are all removed — along with the
  reachability machinery (`reachability.ts`) that existed only to serve the
  Unbreachable Flag win.
- **Record file (technical-notes.md)** — the `Ruleset` tag takes the form
  `VERSION:NAME`; for this story it is exactly `1.2:PRE-RELEASE`. Position
  block: White piece `[R]`, Black piece `*R*`, empty `---`, lake `XXX`, where
  `R` is the symbol above. The record writer/reader stay **rules-blind** (they
  already replay extended notation without applying rules) and mirror each
  other; only the symbol set, the tag value, and the test fixtures change.

**Piece-id decisions (fixed here so every step agrees):** the internal
`PieceTypeId` union becomes `masterOfArms | champion | knight | halberdier |
footSoldier | militia | tower | flag`. `masterOfArms` is the rename of
`lordMarshal` and keeps sprite `p-marshal`; `footSoldier` is the rename of
`infantry` and keeps sprite `p-infantry`. The retired ids (`skirmisher`,
`archer`, `sapper`, `assassin`) are removed. The retired **sprites**
(`p-skirmisher`, `p-archer`, `p-sapper`, `p-assassin`) **stay in
`pieceSprites.svg`, unreferenced** — do not edit the sprite sheet or its test.
Display names use the rules' spelling exactly: "Master-of-Arms", "Champion",
"Knight", "Halberdier", "Foot Soldier", "Militia", "Tower", "Flag".

**Cross-step test constraint (important):** Steps 2–4 rewrite the movement,
combat, and endings tests **while the old 1.1 piece catalog is still in
place** (the roster swap is Step 5). To keep those rewritten tests valid
through Step 5 unchanged, build their board fixtures **only** from pieces
whose id **and rank are identical in both rosters**: `champion` (rank 2),
`knight` (rank 3), `militia` (rank 6), `tower`, and `flag`. Do **not** use
`halberdier` (rank changes 5→4), `lordMarshal`/`infantry` (renamed), or any
retired piece in Steps 2–4 fixtures.

**Every step must leave the app compiling (`npm run typecheck`), lint-clean
(`npm run lint`), and tests green (`npm run test`)**, because each step is
committed before the next begins. Where a step notes it "touches file X only
to keep the build green," that is a required, in-scope edit, not optional.

---

### Step 1 — Rename the rules folder `v1_1` → `v1`

Status: committed

Notes: Purely mechanical rename plus import-path/comment updates across 33
files; no behavior change. Verified: typecheck, lint, and full test suite
green; no `v1_1` reference remains in `src/`.

Rename the directory `src/rules/primary/v1_1/` to `src/rules/primary/v1/`
(move every file, including the `.test.ts` files, unchanged) and update every
import path that referenced the old folder. This is a **purely mechanical**
step: no rule logic, no tag value, and no piece data changes — the ruleset tag
stays `PRIMARY:1.1` for now (it becomes `1.2:PRE-RELEASE` in Step 5).

The importers to update are throughout `src/` — roughly 31 files. Find them
all with a search for `primary/v1_1` across `src` (both the `../rules/primary/v1_1/`
form used by `src/board/`, `src/art/`, `src/review/` and `src/App.tsx`, and the
`./primary/v1_1/` form used by `src/rules/readRecord.ts` and its tests) and
rewrite each to `.../primary/v1/`. Also update the module-header comments that
name the old path (e.g. `readRecord.ts`'s comment references
`src/rules/primary/v1_1/recordFile.ts`) so no stale path remains, and rename
any doc-comment mentions of the ruleset folder that a search surfaces.

Why it comes here: doing the rename first means every later step edits files
at their final path, avoiding a large mechanical churn commit at the end mixed
with behavioral fixtures. It has no dependency on any other step (it changes no
behavior), so it is safe to do first.

Verification (automated): Run `npm run typecheck && npm run lint && npm run
test`. All pass, with no remaining reference to `primary/v1_1` anywhere in
`src` (confirm with a search). No test assertions should change.

---

### Step 2 — Movement: one-square baseline plus the unencumbered two-square move

Status: committed

Notes: Rewrote `movement.ts` to the 1.2 rules (single one-square baseline for
every mobile piece type, plus a two-square orthogonal option gated on
encumbrance judged over all eight surrounding squares at the origin) and
rewrote `movement.test.ts` using only rank-stable fixtures
(champion/knight/militia/tower/flag), per the cross-step constraint.
Deviation from the plan: the plan's "combat, endings, and the session/
announcement layers already consume `legalDestinations`/`legalAttacks` by
shape, so they are unaffected" turned out to be true only for the functions'
*shape*, not for downstream tests with hard-coded exact-destination
assertions — `playSession.test.ts` and `playAnnouncement.test.ts` had several
fixtures (open-field pieces with no adjacent enemy) whose expected destination
counts/sets implicitly assumed the old single-square-only baseline and a
type-specific Skirmisher range. Updated those fixtures/expectations to the
real 1.2 behavior (adding a diagonal (non-orthogonal) enemy where a test
needed to force encumbrance without introducing a spurious attack target, and
correcting expected destination counts/sets and one "2-square away" no-op
fixture to a genuinely-illegal diagonal square) rather than leaving the build
red; no rule-engine behavior outside `movement.ts` changed. `npm run
typecheck`, `npm run lint`, and `npm run test` (468 tests, full suite) are all
green.

Rewrite `src/rules/primary/v1/movement.ts` to the 1.2 movement rules and
rewrite `movement.test.ts` to match:

- **Baseline:** every mobile piece (all types except `tower` and `flag`) may
  step exactly **one square orthogonally** to an empty, on-board, non-lake
  square, and may **attack** an orthogonally adjacent enemy-occupied square.
  Remove the Skirmisher extended range, the Knight charge, and the Halberdier
  anti-charge special cases entirely — `maxRange`/`maxAttackDistance` and the
  charge/anti-charge target logic all go away. `legalDestinations` and
  `legalAttacks` keep their existing shapes (arrays of `Square`, kept disjoint:
  empty squares are destinations, enemy squares are attack targets).
- **Unencumbered two-square move:** add the notion that a piece is
  *unencumbered* when no enemy piece occupies any of its eight surrounding
  squares (orthogonal or diagonal), judged at the piece's current square. An
  unencumbered mobile piece additionally offers, in each of the four
  orthogonal directions, the square **two** away — as a destination if that far
  square is empty, or as an attack target if it holds an enemy — but **only
  when the intermediate (one-away) square is empty and not a lake**. The far
  square must itself be on-board and non-lake, and (for a destination) empty /
  (for an attack) enemy-occupied. The one-square options are always offered
  regardless of encumbrance.
- `hasAnyLegalPly` keeps working unchanged in shape (it already unions
  destinations and attacks).

Reference only the `tower`/`flag` immobile ids and board/adjacency geometry —
do **not** reference any renamed or retired piece id (see the cross-step test
constraint above), so this compiles against the still-1.1 catalog.

Why it comes here: movement is a leaf of the rule graph (it depends only on
`board.ts`, `gameState.ts` types, and the piece catalog's `tower`/`flag`
ids), and the two-square rule is self-contained. Combat (Step 3), endings
(Step 4), and the session/announcement layers already consume
`legalDestinations`/`legalAttacks` by shape, so they are unaffected.

Verification (automated): Run `npm run test src/rules/primary/v1/movement.test.ts`
(plus a full `npm run typecheck && npm run lint && npm run test`). The
rewritten tests must demonstrate, at minimum: a piece with an adjacent enemy
is offered only one-square steps; the same piece with no enemy in any of its
eight neighbours is offered the two-square option, but not through an occupied
or lake intermediate square, not diagonally, and not off-board; a two-square
line ending on an enemy is offered as an attack; lakes and friendly squares
are never destinations.

---

### Step 3 — Combat: rank, equal-rank trade, tower trade, flag capture, formation bonus

Status: committed

Notes: Rewrote `combat.ts` to the 1.2 rules (rank table with equal-rank
mutual loss; a Tower defender is always a mutual loss for any attacker; a
Flag defender always falls; the formation bonus - judged for the attacker
from `from` and the defender from `to`, only at an exact one-rank gap, only
for the weaker side - turns a clean win/loss into a mutual loss) and dropped
`CombatOutcome.archerSupport` (no replacement field; the plan allowed
dropping it). Rewrote `combat.test.ts` with rank-stable fixtures only
(champion/knight/militia/tower/flag), per the cross-step constraint.
`playAnnouncement.ts`'s `describeAttack` no longer reads `archerSupport`; a
mutual-loss attack now simply announces "both fall." Deviations from the
plan text (all mechanical fallout of removing the field/mechanic, needed to
keep the build green, not scope expansion): (1) removed the
`archerSupport: false` assertions from `play.test.ts` (3 places) and
`playSession.test.ts` (1 place), whose `CombatOutcome` fixtures no longer
have that field; (2) fixed one pre-existing `play.test.ts` assertion
("treats a Sapper destroying a Tower as a capture") that hard-coded the old
1.1 "Sapper alone destroys a Tower" result - now correctly `mutualLoss` under
1.2's any-attacker Tower trade (that whole counters-model test file is
rewritten wholesale in Step 4; this is a minimal value fix to keep it green
in the meantime); (3) deleted `playAnnouncement.test.ts`'s "mentions Archer
support" test, since the mechanic it exercised no longer exists. `npm run
typecheck`, `npm run lint`, and `npm run test` (452 tests, full suite) are
all green.

Rewrite `src/rules/primary/v1/combat.ts` to the 1.2 combat rules and rewrite
`combat.test.ts` to match:

- **Base result:** two ranked pieces — lower rank number wins; equal rank is
  mutual loss. A piece attacking the **Flag** wins (the Flag is removed). A
  piece attacking a **Tower** is a **mutual loss** (both removed) — for **any**
  attacker. Remove every 1.1 special case (Assassin, Sapper-vs-Tower, Knight
  charge, Halberdier, and the Archer defensive-support override) and remove the
  `archerSupport` field from `CombatOutcome` (replace it with the formation
  data below, or simply drop it if the announcement no longer needs a flag).
- **Formation bonus:** a piece has the bonus when a friendly piece of **equal
  rank** occupies one of its eight surrounding squares (orthogonal or
  diagonal). Judge the **attacker's** formation from its **origin** square
  (`from`, before it moves) and the **defender's** from its own square (`to`).
  Effect: when the two pieces' ranks differ by exactly one, the weaker piece
  (higher rank number) — if it has the formation bonus — turns its clean loss
  into a **mutual loss**. Concretely: if the attacker is one rank weaker than
  the defender and has formation, the base "attacker loses" becomes "mutual
  loss"; if the defender is one rank weaker than the attacker and has
  formation, the base "attacker wins" becomes "mutual loss". Formation never
  applies to Tower or Flag (no rank), never applies at a rank gap of 0 or ≥2,
  and never turns a mutual loss back into a win.
- Keep `CombatOutcome`'s existing fields the announcement layer relies on
  (`result`, `attacker`, `defender`, `square`, `capture`). `capture` stays
  true for exactly the results that remove a defending piece (attacker wins or
  mutual loss).

`combat.ts` references only `flag`/`tower` ids and catalog rank data, so it
compiles against the still-1.1 catalog.

Also update `src/board/playAnnouncement.ts`'s `describeAttack` **only as far
as needed to keep the build green**: remove the `archerSupport` clause (the
"Archer support turns the attack back." sentence and its `outcome.archerSupport`
read). A mutual-loss attack simply announces "both fall." Do not otherwise
rework announcement wording here (Step 7 does the wording pass).

Why it comes here: combat depends on movement's notion of an attack (Step 2)
and on the catalog's rank data, but not on the roster swap; putting it before
the roster swap keeps it referencing only rank-stable pieces. Endings (Step 4)
consumes `CombatOutcome.capture`, which is preserved.

Verification (automated): Run `npm run test src/rules/primary/v1/combat.test.ts`
(plus full `typecheck`/`lint`/`test`). The rewritten tests must show: stronger
rank beats weaker; equal rank trades; any attacker trades with a Tower;
capturing the Flag is an attacker win; a one-rank-weaker **attacker** with an
adjacent equal-rank ally trades instead of losing, and **without** the ally
loses; a one-rank-weaker **defender** with an adjacent equal-rank ally trades
instead of being captured; a two-rank gap is unaffected by formation.

---

### Step 4 — Endings: single shared inactivity draw, no-legal-move, flag capture

Status: committed

Notes: Rewrote `outcome.ts` (`computeOutcome(board, activeSide,
inactivityCounter)`, three-case precedence, `GameEndReason` now `flagCapture
| noLegalMove | inactivity | agreement`, single `INACTIVITY_LIMIT = 50`) and
deleted `reachability.ts`/`reachability.test.ts`. Rewrote `play.ts`
(`PlayState.inactivityCounter: number` replaces the per-side record and the
progress counter; `applyMove` resets it to 0 exactly when the ply's
`CombatOutcome.capture` is true, else +1; `renderResultReasonValue` drops the
two removed reasons). Collapsed `playWarnings.ts`/`PlayWarnings.tsx` to a
single side-agnostic inactivity warning (kept the 10-move threshold,
proportionally the same fraction of the new 50-move limit as the old
per-player warning was of its own 50-move limit) and rewrote both of its test
files. Updated `playAnnouncement.ts`'s `reasonLabel`/`winReasonClause`/
`drawReasonClause` (inactivity is now a draw-only reason, worded "by
inactivity"; `noLegalMove` is the only win reason left needing a subject
clause) and `reviewText.ts`'s `RESULT_REASON` map to drop `unbreachableFlag`/
`noProgress`. Rewrote `outcome.test.ts` and `play.test.ts` to the new
precedence/counter using only rank-stable fixtures (champion/knight/militia/
tower/flag), per the cross-step constraint. Deviations from the plan text, all
mechanical fallout of the reason/counter shape change needed to keep the build
green, not scope expansion: (1) `playSession.test.ts` (one assertion) and
`playAnnouncement.test.ts` (the `endingSession` fixture plus its
Unbreachable-Flag/Inactivity-win/No-Progress-draw tests) referenced the old
`inactivityCounters`/`progressCounter` fields and the two removed reasons -
updated to the new field and reworded the three ending tests as a No-Legal-Move
win and an Inactivity draw, the closest surviving equivalents; (2)
`reviewText.test.ts`'s two "No Progress" fixtures were changed to "Inactivity"
so `RESULT_REASON` still has a recognized-reason case to exercise. `npm run
typecheck`, `npm run lint`, and `npm run test` (418 tests, full suite) are all
green.

Rewrite the game-end layer to rules §5 and remove the machinery that only
served the deleted conditions:

- **`src/rules/primary/v1/outcome.ts`:** `computeOutcome` now takes the board,
  the side to move, and the **single shared inactivity counter** (drop the
  per-side `inactivityCounters` record and the separate `progressCounter`).
  Evaluate, in order: (1) Flag capture — the side missing its Flag loses; (2)
  no-legal-move for the side to move — that side loses; (3) inactivity counter
  at the limit — draw. Remove the Unbreachable Flag case and the
  `computeUnbreachableFlagInputs` import. `GameEndReason` becomes
  `flagCapture | noLegalMove | inactivity | agreement` (drop `unbreachableFlag`
  and `noProgress`). Replace `INACTIVITY_LIMIT = 50` / `PROGRESS_LIMIT = 80`
  with a single exported limit constant of **50** for the shared inactivity
  draw. **Delete `reachability.ts` and `reachability.test.ts`.**
- **`src/rules/primary/v1/play.ts`:** `PlayState` carries a single
  `inactivityCounter: number` (drop the per-side counters and the progress
  counter). In `applyMove`, increment the counter by 1 on any ply that removes
  **no** piece, and reset it to 0 on any ply that removes at least one piece (a
  winning attack, a mutual loss, or a tower trade — i.e. exactly when the ply's
  outcome removed a piece). `startPlay` initialises it to 0. Update
  `renderResultReasonValue` so it maps only the surviving reasons
  (`flagCapture` → `"Flag Captured"`, `noLegalMove` → `"No Legal Move"`,
  `inactivity` → `"Inactivity"`, `agreement` → `"Agreement"`); remove the
  `"Unbreachable Flag"` and `"No Progress"` strings. The developer record dump
  (`renderGameRecord`) is otherwise unchanged (it still writes the plain `A2A3`
  move form — switching to extended notation is out of scope).
- **`src/board/playWarnings.ts` + tests:** collapse the two countdown warnings
  into a **single** warning tied to the shared inactivity counter — a
  side-agnostic "N moves remain (combined) before the game is a draw by
  inactivity" message, shown to both players once the counter is within a
  fixed threshold of the 50-move limit. Remove the per-player inactivity-loss
  warning entirely (there is no inactivity **loss** in 1.2). Update
  `CountdownWarnings`/the warning interfaces accordingly, and update
  `src/board/PlayWarnings.tsx` (the banner component) and its use in
  `HotSeatGame.tsx` to the new shape. Rewrite `playWarnings.test.ts` and
  `playWarnings.game.test.ts`.
- **Wording enums that reference the removed reasons** — update
  `src/board/playAnnouncement.ts` (`reasonLabel`, `winReasonClause`,
  `drawReasonClause`) and `src/review/reviewText.ts` (the `RESULT_REASON`
  map) so their switches/maps no longer mention `unbreachableFlag` or
  `noProgress` and stay exhaustive over the new `GameEndReason`. Keep the
  wording plain and player-facing (e.g. an inactivity draw reads as a draw
  "by inactivity", not rulebook jargon).
- Rewrite `outcome.test.ts` and `play.test.ts` to the new rule state and the
  new precedence. Use only rank-stable pieces in fixtures (see the cross-step
  constraint).

Why it comes here: endings depend on movement's `hasAnyLegalPly` (Step 2) and
on combat's capture semantics (Step 3), and on nothing from the roster swap.
Doing it now keeps every reason-enum consumer compiling before the roster swap
churns the piece ids.

Verification (automated): Run `npm run typecheck && npm run lint && npm run
test`. The rewritten tests must show: a captured Flag ends the game for the
capturing side; a side with no legal ply loses; the shared counter rises on a
quiet move, resets to 0 on any piece removal, and produces a **draw** at 50;
and no `unbreachableFlag`/`noProgress`/per-player-inactivity-loss outcome is
producible anywhere.

---

### Step 5 — The 1.2 army: new piece catalog, sparse placement, ruleset tag

Status: pending

Swap the roster and everything the roster touches. This is the step where the
`PieceTypeId` union changes, so it necessarily ripples across the codebase.

- **`src/rules/primary/v1/pieces.ts`:** replace the catalog with the 1.2
  roster. `PieceTypeId` = `masterOfArms | champion | knight | halberdier |
  footSoldier | militia | tower | flag`. Ranks: Master-of-Arms 1, Champion 2,
  Knight 3, Halberdier 4, Foot Soldier 5, Militia 6; Tower/Flag rank `null`.
  Symbols: `1`–`6` accordingly, `T`, `F`. `quantityPerSide`: 3 for each ranked
  type, 6 Towers, 1 Flag → `ARMY_SIZE` computes to **25**. Simplify `RankCode`
  to `1 | 2 | 3 | 4 | 5 | 6 | null` (drop `7|8|9|"special"`) and
  `PositionBlockSymbol` to `"1".."6" | "T" | "F"`. Display names exactly as in
  the Grounding facts. Update the module header comment (no longer 48, no
  longer "unchanged since v1.0").
- **`src/rules/primary/v1/gameState.ts`:** the position-block symbol handling
  is catalog-driven and needs no logic change, but update the
  `buildInitialGameState` completeness guard and its error text away from
  "48/48" to the army size, and update `RULESET_TAG` from `"PRIMARY:1.1"` to
  **`"1.2:PRE-RELEASE"`**. (`readRecord.ts` dispatches on this constant, so the
  reader follows automatically.)
- **`src/rules/primary/v1/placement.ts`:** make placement **sparse**. `isComplete`
  becomes "all 25 pieces placed" (`placedCount === ARMY_SIZE`), which now means
  25 of the 48 home squares are filled and the rest are intentionally empty.
  Rewrite `autoFill` so it places the **remaining pieces onto a random subset**
  of the empty home squares (not every empty square) and **respects the Tower
  adjacency rule** — it must never place two of the side's Towers in adjacent
  squares (orthogonally or diagonally). Add a pure predicate (e.g.
  `towersLegallyPlaced`/`canConfirm`) that reports whether the current
  placement violates the Tower rule (no two of this side's Towers in any of the
  eight surrounding squares of another), for the UI to gate confirmation on
  (Step 6). Keep the existing tray operations (`place`/`move`/`swap`/
  `returnToTray`/`clear`) otherwise unchanged — the interaction model is
  already tray-based and needs no redesign.
- **`src/art/PieceIcon.tsx`:** update `SYMBOL_ID_BY_PIECE_TYPE` to the new
  union — `masterOfArms → p-marshal`, `footSoldier → p-infantry`, plus
  `champion/knight/halberdier/militia/tower/flag`. Remove the retired keys. Do
  **not** touch `pieceSprites.svg` or `pieceSprites.test.ts` (retired sprites
  stay).
- **All remaining references to removed/renamed piece ids**, to restore a green
  build: rewrite `placement.test.ts`, `gameState.test.ts`, `recordFile.test.ts`,
  `replay.test.ts`, and the board/review tests that use piece-id literals
  (`placementSession.test.ts`, `playAnnouncement.test.ts`, `playSession.test.ts`,
  `reviewSession.test.ts`, `reviewText.test.ts`) so they use only 1.2 piece ids
  and the new symbols. Update `pieces.test.ts` to assert the 25-piece roster
  (three each of six ranks, six Towers, one Flag; `ARMY_SIZE === 25`; symbol
  set `1`–`6`/`T`/`F`). Refresh any stale doc-comments that name retired pieces
  (e.g. `replay.ts`'s "a Sapper taking a Tower" example → a generic attacker).
- **Retire the 1.1 sample records:** delete the four position-bearing sample
  files under `doc/plan/00000014-game-reviewer/samples/` that are `PRIMARY:1.1`
  records or use the old symbol set (`good-game.txt`, `empty-square-move.txt`,
  `phantom-capture.txt`, `plain-notation.txt`), and remove
  `src/rules/readRecord.samples.test.ts` (it exercises those files and cannot
  survive the symbol change). Small synthetic 1.2 record fixtures are
  reintroduced for the reader in Step 8. This interim loss of reviewer sample
  coverage is explicitly accepted by the story (real 1.2-record verification is
  story 00000017). Leave `unknown-ruleset.txt` if it is a pure tag-only fixture
  used elsewhere; if `readRecord.test.ts` references retired samples or the old
  tag string, update it too.

Why it comes here: the movement, combat, and endings modules (Steps 2–4) are
already free of retired/renamed piece-id literals, so the union change now
breaks only the roster's direct consumers (PieceIcon, tests, fixtures) rather
than the rule algorithms — keeping this step mechanical rather than a second
behavioral rewrite. The placement UI (Step 6) depends on the new sparse model
and Tower predicate introduced here.

Verification (automated): Run `npm run typecheck && npm run lint && npm run
test`. Tests must show the 25-piece roster and its symbols; `autoFill` from an
empty board fills exactly 25 of the 48 home squares, leaves the other 23 empty,
and never places two of a side's Towers adjacently (including diagonally);
`isComplete` is true at 25 placed; the position block renders with only
`1`–`6`/`T`/`F` symbols; and a rendered game record carries
`Ruleset "1.2:PRE-RELEASE"`.

---

### Step 6 — Placement UI: sparse tray and the Tower-adjacency rule

Status: pending

Wire the new sparse placement and the Tower rule into the hot-seat placement
screen so a player can place 25 pieces on any 25 of their 48 home squares and
is prevented from finishing while two of their Towers are adjacent.

- **`src/board/HotSeatGame.tsx`:** change the confirm gate so the Confirm/finish
  control is enabled only when placement is both complete (all 25 placed) **and**
  the Tower rule is satisfied (the predicate added in Step 5). When the army is
  fully placed but two Towers are adjacent, block confirmation and surface a
  plain-language explanation the player can act on (e.g. "Two of your Towers are
  next to each other — no two Towers may touch, even diagonally. Move one
  apart to finish."). Prefer disabling the Confirm control **and** showing the
  message (via `PlacementStatus`), so the reason the player cannot finish is
  visible, not just an inert button.
- **`src/board/PlacementStatus.tsx` / `PlacementControls.tsx` / `Tray.tsx` /
  `Board.tsx`:** ensure the progress readout, tray, and any instructional copy
  read correctly for a 25-piece sparse army (e.g. "N / 25 placed", empty home
  squares are a normal, allowed state, not an error), and carry the Tower-rule
  message. Names shown come from the catalog automatically; verify they read as
  "Master-of-Arms", "Foot Soldier", etc., with the correct corner numerals
  (Halberdier 4, Foot Soldier 5). Keep the existing interaction otherwise
  unchanged — the richer placement experience is story 00000017.
- Review any placement help/instruction text for references to a full-army or
  removed mechanics and reword to the 1.2 model.

Why it comes here: it depends on the sparse placement model and Tower predicate
from Step 5 and on the piece catalog names/symbols. It is the first player-
visible surface of the new rules, so it fronts manual **Gate A**.

Verification (manual — Gate A): Run `npm run dev` and place both armies. Confirm
that: each player places 25 pieces on squares of their choosing and empty home
squares are allowed and evident; placing all 25 with two Towers adjacent
(including diagonally) blocks finishing with an actionable message, and
separating them unblocks it; the reveal shows both sparse armies with the
renamed pieces and the swapped rank numerals correct on their tiles. Also run
`npm run typecheck && npm run lint && npm run test`.

---

### Step 7 — Play-through wording and the removed-mechanics copy sweep

Status: pending

Finish the player-facing wording for 1.2 play and confirm movement and combat
behave correctly in the running app.

- Sweep the play-phase UI and announcement text for any remaining language
  tied to removed mechanics (charge, rush, support, Archer/Sapper/Assassin, the
  Unbreachable Flag, the old dual clocks) and reword to the 1.2 model. Confirm
  `playAnnouncement.ts` describes: selecting a piece and how many moves it has
  (counting one- and two-square options and attacks together), a plain move, a
  two-square move, and each combat result ("advances" / "holds" / "both fall")
  without referencing removed abilities. Describe the two-square move,
  formation-supported trades, and Tower trades in plain words only where they
  actually surface to the player — do not invent rulebook jargon in the UI.
- Confirm no removed ability can fire anywhere in the running game.

Why it comes here: it depends on the completed rule engine (Steps 2–5) and the
placement UI (Step 6) so a full game can be played and observed. It fronts
manual **Gate B**.

Verification (manual — Gate B): Run `npm run dev`, place armies, and play. A
piece with no adjacent enemies is offered two-square moves (excluding blocked
paths and lakes); a piece with an enemy beside it is offered only single steps.
An equal-rank attack trades; a formation-supported piece (equal-rank ally
adjacent) trades against a one-rank-stronger piece where it would otherwise
lose — checked in both the attacking and defending directions; any piece
attacking a Tower removes both; capturing the Flag wins; no removed ability
fires. Screen-reader announcements name the new pieces and outcomes correctly.
Also run `npm run typecheck && npm run lint && npm run test`.

---

### Step 8 — Record layer: synthetic 1.2 reader fixtures and the tag round-trip

Status: pending

Restore the reader's fixture coverage with **small synthetic 1.2 records** (the
story's stated interim: real engine-produced 1.2 records are verified in story
00000017). The writer and reader must stay mirrored and honest.

- Add small synthetic `1.2:PRE-RELEASE` record fixtures (a valid one that
  round-trips, and at least one intentionally malformed one) — either inline in
  a test or as committed files under this story's folder — and a test (a
  replacement for the removed `readRecord.samples.test.ts`, or additions to
  `readRecord.test.ts`) that: accepts a valid synthetic 1.2 record and replays
  it, and **rejects a `PRIMARY:1.1`-tagged record as an unknown ruleset** (the
  truthful answer now that no 1.1 reader exists). Keep the fixtures minimal —
  a few pieces on the board and a handful of moves in the extended notation the
  reader requires — since the goal is round-trip honesty, not realistic games.
- Confirm the developer record dump (`renderGameRecord`, shown via
  `GameRecord.tsx`) of a finished 1.2 game carries `Ruleset "1.2:PRE-RELEASE"`,
  the `1`–`6`/`T`/`F` position-block symbols, and a plausible `Result` /
  `ResultReason`.

Why it comes here: it depends on the new symbols and tag (Step 5) and the new
endings/reasons (Step 4). It fronts manual **Gate C**.

Verification (manual — Gate C): Run `npm run dev` and play a game to two
endings across separate games: a Flag capture (immediate win, correct winner)
and — by maneuvering without captures — an inactivity **draw** at the 50th
quiet move; confirm draw by agreement still works. Inspect the developer record
dump of a finished game and confirm the `Ruleset` tag, the position-block
symbols, and a plausible result/reason. Also run `npm run typecheck && npm run
lint && npm run test` (the counter's reset-on-capture is covered by the Step 4
automated tests; the gate spot-checks the draw itself).

---

### Step 9 — Accessibility pass

Status: pending

With the rule and wording changes in place, verify the keyboard and
screen-reader experience keeps pace with the new names and mechanics, and fix
any regressions (labels, focus order, live-region announcements) introduced by
Steps 6–8. No new interaction patterns are added — the established keyboard and
screen-reader patterns must simply continue to work with the new content.

Why it comes here: it depends on all player-facing surfaces being final
(Steps 6–8).

Verification (manual — Gate D): With the mouse put away, complete placement
(including recovering from the Tower-adjacency restriction) and play a stretch
of a game (including at least one two-square move and one trade) by keyboard
alone, with a screen reader announcing the new piece names and outcomes
correctly. Also run `npm run typecheck && npm run lint && npm run test`.

---

### Step 10 — README accuracy check

Status: pending

Review `README.md` against the changes in this story and update it if anything
it describes is now wrong — in particular any mention of the piece roster
(48 vs 25, retired pieces), the placement model, the rules the app plays, or
the ruleset version/tag. If the README does not describe any of these, confirm
in the step's `Notes` that no change is needed. The `/update-readme` command
can be used: it reviews the current branch diff and updates `README.md` if
warranted.

Why it comes here: last, so it reflects every change the story made.

Verification (automated): Run `npm run typecheck && npm run lint && npm run
test` (in case README examples are checked by any tooling) and re-read the
relevant README sections to confirm they match the shipped 1.2 behavior, or
record that no update was needed.
