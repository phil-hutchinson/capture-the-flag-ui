# Implementation Plan — Story 00000025: Add tower restriction

This plan adopts the companion project's new Skirmish edition **`2-1:SKIRMISH`**,
which adds exactly one rule: **in Skirmish, no Tower may stand directly in front
of a lane.** Battle (`2-0:BATTLE`) is untouched, and the superseded
`2-0:SKIRMISH` stays readable (records naming it still review) but is never
offered as a game to start.

Read `story.md` in this folder in full before starting any step. Its
**Policy (fixed by the owner)**, **In scope / Out of scope**, and
**Design decisions & constraints** sections are settled and are not
re-litigated here. This plan resolves the story's
**"Open items to resolve at plan time"** — the resolutions are in
"Decisions resolved at plan time" below, and every step is written assuming
them.

---

## Grounding facts (read once — applies to every step)

The single source of truth is `doc/ruleset/rules.md` in the companion
[capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
repository, on `main`. Fetch it if a step needs to re-check a detail:

- `gh api repos/phil-hutchinson/capture-the-flag/contents/doc/ruleset/rules.md --jq '.content' | base64 -d`
- same for `doc/ruleset/changelog.md` (the entry for that repo's story 00000037,
  2026-08-02, records this change).

The rules facts this plan is built on, resolved at plan time against those docs:

- **The rule (rules §3).** "In Skirmish, no tower may stand directly in front of
  a lane." A **lane** (glossary) is a run of columns crossing the middle of the
  board with no lake in it — the only way from one half of the board to the
  other. Skirmish has three lanes (column A, columns D–E, column H); Battle has
  four (column A, columns D–E, columns H–I, column L).
- **The closed set is geometric, not a list (rules Appendix A,
  `TOWER_PLACEMENT`).** "Directly in front of a lane" means **a home square
  orthogonally adjacent to a square that lies in a lake row and is not itself a
  lake.** Applying that definition:
  - `standard_64` (Skirmish, 8×8, home rows 1–3 / lake rows 4–5 / home rows
    6–8, lakes at columns B, C, F, G): closes **A3, D3, E3, H3** for the side
    whose back rank is row 1 and **A6, D6, E6, H6** for the other — four per
    home zone. **B3, C3, F3, G3 stay open** (they sit behind lakes, not lanes).
  - `standard_144` (Battle, 12×12, home rows 1–4 / buffer row 5 / lake rows 6–7
    / buffer row 8 / home rows 9–12): closes **nothing** — the buffer row means
    no home square is orthogonally adjacent to any square in a lake row.

  Those square lists are what the definition must **produce**; they are the
  tests' expected values and must never be hardcoded in the implementation
  (story.md's Policy).

- **The variant (rules Appendix A).** `TOWER_PLACEMENT`, values `spacing_only` |
  `spacing_and_lanes`, **default `spacing_only`**. `spacing_only` = the existing
  "no two Towers next to each other, including diagonally" rule alone;
  `spacing_and_lanes` = that rule **and** no Tower directly in front of a lane.
  Nothing else about Towers changes under either value, and no other piece is
  affected by either. The variant is never invalid on any board — it can simply
  be inert, as `spacing_and_lanes` is on `standard_144`.
- **The editions (rules Appendix B).**

  | Edition        | Variant values                                          | Table                   |
  | -------------- | ------------------------------------------------------- | ----------------------- |
  | `2-0:BATTLE`   | `standard_144`, `standard_battle`, `spacing_only`       | Active                  |
  | `2-1:SKIRMISH` | `standard_64`, `standard_skirmish`, `spacing_and_lanes` | Active                  |
  | `2-0:SKIRMISH` | `standard_64`, `standard_skirmish`, `spacing_only`      | Historical (superseded) |

  `1-2:PRE-RELEASE` also appears in the rules' Historical table (retired), but
  this app deliberately does **not** register it — story 00000023 made major-1
  records unreviewable on purpose. Do not add it.

- **The two minors now differ.** Skirmish is at minor 1, Battle at minor 0.
  They share major 2 because they share the same rules text. **Nothing in this
  app may assume the two active editions carry the same minor**, or derive one
  edition id from the other.
- **The notation is unaffected.** A placement restriction produces no new kind of
  ply. A record stamped `2-1:SKIRMISH` reads exactly as one stamped
  `2-0:SKIRMISH`; only the `Ruleset` tag differs, and the position block is
  unchanged.
- **Placement rules are never checked during replay.** A record carries a
  completed position, and `src/rules/primary/v2/replay.ts` /
  `recordFile.ts` do not (and must not) consult any placement rule. An old
  `2-0:SKIRMISH` record with a Tower on A3 must review without complaint.

### Where the relevant code is today

- `src/rules/primary/v2/edition.ts` — the edition registry. `EditionId` is the
  two-value union `"2-0:BATTLE" | "2-0:SKIRMISH"`; an `Edition` carries an id, a
  `boardLayoutId`/`armyCompositionId`, and the resolved `boardLayout`/`army`.
  Exports `BATTLE_EDITION`, `SKIRMISH_EDITION`, `EDITIONS`, `editionById`,
  `armyFitsBoard`, `combinationFits`, `playableEditions` (which today filters
  only on "does the army fit the board").
- `src/rules/primary/v2/boardLayout.ts` — `BoardLayout` geometry data
  (`columnCount`, `rowCount`, `homeRowsPerSide`, `hasBuffer`, `lakeRows`,
  `lakeColumnIndices`) plus `lakeCells`, `rowRegion`, `homeZoneSize`,
  `columnLetter`. It speaks in column **indices**, not `Square`s.
- `src/rules/primary/v2/board.ts` — `Square`/`Side`/`Column`/`Row` vocabulary
  and the layout-parametric geometry: `allSquares`, `isLake`, `regionOf`,
  `isHomeSquareFor`, `homeSquares`, `columnIndexOf`, `columnsOf`/`rowsOf`,
  `squareKey`, and the `BATTLE_LAYOUT` constant.
- `src/rules/primary/v2/placement.ts` — `PlacementState` (carries `side`,
  `boardLayout`, `army`, `placements`, `remaining`), a three-argument
  `emptyPlacement` (side, board layout, army),
  `place`/`move`/`swap`/`returnToTray`/`clear`,
  `progress`/`isComplete`, `towersLegallyPlaced` (the Tower-spacing check), and
  `autoFill` (which places Towers first via an internal `pickTowerSquares`
  helper, then the rest).
- `src/board/placementSession.ts` — `newSession(edition)` seeds both sides'
  `emptyPlacement` from the edition.
- `src/board/HotSeatGame.tsx` — the hot-seat game: the game choice, then
  placement (click grammar: tray-place, board move, board swap, return-to-tray,
  clear, auto-fill), then play. It computes `placementComplete` /
  `towerRuleOk` and passes them to `PlacementStatus`.
- `src/board/PlacementStatus.tsx` — the placement action row, including the
  always-mounted `role="status" aria-live="polite"` region that shows the
  "two of your Towers are next to each other" explanation when Confirm is
  blocked.
- `src/board/Board.tsx` — the cropped placement board. Squares are plain
  `<div onClick>` cells; class names follow `board-square--<band>`,
  `board-square--lake`, `board-square--selected` (styled in `Board.css`).
- `src/board/GameChoice.tsx` / `src/board/gameNames.ts` — the Battle/Skirmish
  picker; `GAME_ORDER` and `GAME_DETAIL` are keyed by `EditionId`, and
  `gameName`/`defaultGameId` map edition ids to player-facing names and to the
  pre-selected game.
- `src/rules/readRecord.ts` — resolves a record's `Ruleset` tag by looking the
  string up in `EDITIONS`, then parses and replays.
- `src/board/EngineGame.tsx` — the computer-play screen. **Disabled and
  unreachable** since story 00000023 (the start-screen button is disabled), but
  it still uses `emptyPlacement`, `Board`, `Tray`, `PlacementStatus` and
  `towersLegallyPlaced`, so it must keep **typechecking**. It is Battle-only;
  give it `spacing_only` wherever this story forces a change, and change nothing
  else about it.

### Decisions resolved at plan time (these settle story.md's open items)

1. **Both rules are one rule family, surfaced in one voice.** The lane rule is
   enforced **at drop time** — a Tower dropped on a closed square is refused
   immediately, with an explanation, and nothing is placed. The spacing rule
   stays a **confirm-time block**, because it can only be judged once Towers are
   down. Both messages are produced by one small pure module and are shown in
   **one** live region (`PlacementStatus`'s existing one), so a player never
   sees two competing mechanisms. Both sentences follow the same shape: what is
   wrong, why, and what to do — e.g. spacing: "Two of your Towers are next to
   each other — no two Towers may touch, even diagonally. Move one apart to
   finish."; lane: "A Tower can't go on A3 — in this game no Tower may stand in
   front of a lane, the open column running through the middle of the board.
   Choose another square." (exact wording is the implementer's, within that
   shape and reading level).
2. **The confirm-time check covers both rules anyway**, as a backstop: an army
   with a Tower in front of a lane can never be confirmed, no matter how it got
   there. In practice drop-time refusal means the player never reaches that
   state, so the lane message at confirm time is a safety net, not the primary
   path.
3. **Closed squares are shown while a Tower is in hand, and not otherwise.**
   When the current selection is a Tower (from the tray, or an already-placed
   Tower picked up on the board), the closed home squares are drawn with a quiet
   "closed to Towers" treatment (a new `board-square--` modifier alongside the
   existing `--lake`/`--selected` ones). Nothing is drawn when no Tower is in
   hand, and nothing at all is ever drawn on Battle (the closed set is empty by
   geometry). **Non-visual equivalent:** while a Tower is in hand, the same live
   region carries a plain-language sentence naming the closed squares for the
   player's own side (e.g. "Towers can't go on A3, D3, E3 or H3 in this game —
   those squares stand in front of a lane."). This is the accessible equivalent
   available today; the placement board's squares are not focusable (see
   "Known limitation", below).
4. **Live-region precedence**, so only one thing speaks at a time: a refusal
   message (transient, set the moment a placement is refused) wins; otherwise
   the "Towers can't go on …" hint while a Tower is in hand; otherwise the
   confirm-time block explanation; otherwise nothing.
5. **Historical vs. playable is an explicit `status` field on `Edition`**
   (`"active" | "superseded"`), mirroring the rules' Appendix B tables. `EDITIONS`
   holds all three editions and is what `readRecord.ts` resolves against
   (**readable**); `playableEditions()` returns those that are `active` **and**
   whose army fits their board (**playable**). The picker enumerates
   `playableEditions()` and never the raw registry.
6. **`TOWER_PLACEMENT` is threaded via `PlacementState`, not by passing whole
   `Edition`s into the rules.** `PlacementState` already carries `boardLayout`
   and `army`; it gains a third **required** field for the variant value, set
   from the edition by `emptyPlacement`. Required, not defaulted — story
   00000023's peer review (findings #2 and #15) made the other two required for
   exactly this reason, and a silent Battle-ish default is the defect class that
   escaped to a manual gate in that story. The call sites are mechanical (~58,
   almost all in `placement.test.ts` and `gameState.test.ts`, all passing
   `BATTLE_LAYOUT, BATTLE_ARMY`).
7. **The geometry lives in `board.ts`; the rule lives in `placement.ts`.**
   `boardLayout.ts` has no `Square`/`Side` vocabulary, and the closed-square
   definition needs both plus `isLake`/`homeSquares` — so the pure geometric
   query ("which of this side's home squares face a lane on this layout")
   belongs in `board.ts`, and the rule that applies it only when the variant
   says `spacing_and_lanes` belongs in `placement.ts`.
8. **Fixtures.** `SKIRMISH_EDITION` (the exported constant) becomes
   `2-1:SKIRMISH` — a ruleset name means its current edition — so existing
   fixtures that use it move to `2-1:SKIRMISH` automatically, which is correct
   for anything representing a _new_ game. A second exported constant names the
   historical `2-0:SKIRMISH`, used only by tests that deliberately exercise the
   historical path. A **sample `2-0:SKIRMISH` record file whose starting
   position has a Tower on A3** is added to the repository under `doc/samples/`
   and is both read by an automated test and used by the owner at manual Gate D
   — one artifact, so the file can never rot.
9. **Player-facing copy mentions the rule up front**, briefly: the picker's
   Skirmish description gains one clause about Towers and lanes, and the README
   gains one clause in its setup bullet. Neither restates the rules; the
   companion repository stays the source of truth.
10. **Records.** New Skirmish games are tagged `2-1:SKIRMISH` from Step 1
    onward, because the tag is simply the chosen edition's id. Between Step 1
    and Step 5 the lane rule is not yet enforced, so a record dumped in that
    window could name `2-1:SKIRMISH` while containing a Tower in front of a
    lane. This is called out so a cold reader does not treat it as a bug: no
    such record is kept (the app has no save-to-file for players; the record
    dump is a dev-build disclosure), and Step 5 closes the window.

### Known limitation that affects Gate E (read before Step 5)

The Phase-1 placement board (`src/board/Board.tsx`) has **never been
keyboard-operable**: its squares are plain `<div onClick>` elements with no
`tabIndex`, `role`, or key handling, and placed pieces are `aria-hidden` with
nothing naming a square's contents. This predates this story — it was deferred
to story 00000002 (`doc/plan/00000002-accessible-placement-board/`, stubbed and
never built), and at story 00000023's Gate E the owner **waived** the placement
portion for this reason. This story must not silently regress that, and is not
scoped to fix it. Step 5 therefore delivers the best accessible equivalent
available without it — every refusal, hint, and block is spoken through an
established live region — and Gate E's "workable by keyboard alone" clause is
expected to be waived again by the owner.

### Standing requirements for every step

- Every step leaves the app **green**: `npm run typecheck`, `npm run lint`,
  `npm test` all pass, and a hot-seat game of **both** Battle and Skirmish stays
  playable end to end.
- Run `npx prettier --check` on the files the step touched (or
  `npm run format:check`), matching the project's formatting.
- Update the doc comments of any module the step reworks, including the
  edition lists they enumerate — several modules' headers currently name
  "`2-0:BATTLE` / `2-0:SKIRMISH`" as _the_ two editions.
- Commit per the standard pipeline before starting the next step.

---

## Step 1 — The `TOWER_PLACEMENT` variant and a three-edition registry

Status: committed

Notes: Added `TowerPlacement` (`spacing_only` | `spacing_and_lanes`) and
`EditionStatus` (`active` | `superseded`) to `edition.ts`; widened `EditionId`
to the three ids; `SKIRMISH_EDITION` now names `2-1:SKIRMISH`
(`spacing_and_lanes`, active); added `SUPERSEDED_SKIRMISH_EDITION` for
`2-0:SKIRMISH` (`spacing_only`, superseded); `EDITIONS` holds all three;
`playableEditions()` now filters on `status === "active"` as well as the
existing fit check. `gameNames.ts`'s `gameName` is now an explicit
`Record<EditionId, string>` lookup (all three ids) instead of a binary
ternary, and `defaultGameId`'s fallback is `2-1:SKIRMISH`.
`GameChoice.tsx` now builds its button list from `playableEditions()` (sorted
by a small exhaustive `gameOrderRank` helper so Skirmish still shows first),
never from the raw registry, so `2-0:SKIRMISH` can never be offered;
`GAME_DETAIL` stays a `Record<EditionId, string>` covering all three ids for
type-completeness even though the superseded entry is never rendered.
Updated doc comments in `edition.ts`, `readRecord.ts`, and `boardLayout.ts` to
describe the three-edition registry. Extended `edition.test.ts`,
`gameNames.test.ts`, and `readRecord.test.ts` per the step's verification
list (registry contents/statuses/variant values, `playableEditions()`
excludes the superseded edition, `gameName`/`defaultGameId` cover all three
ids, `readRecord` accepts all three tags and still rejects an unknown one).
Fixed one pre-existing test in `gameState.test.ts` that hardcoded
`"2-0:SKIRMISH"` as the expected ruleset tag from `SKIRMISH_EDITION` - this is
exactly the "existing fixtures that use `SKIRMISH_EDITION` move to
`2-1:SKIRMISH` automatically" case the plan's Decision item 8 anticipated, so
it was updated to `"2-1:SKIRMISH"` rather than left broken.

Deviation: did not add a `GameChoice.tsx` test file to automate "every
playable edition has a picker description" / "Skirmish offered first" -
this repo has no component-test harness (noted explicitly for Step 4's own
UI-adjacent pure modules), and none existed for `GameChoice.tsx` before this
step either. Both properties are instead compiler-enforced: `GAME_DETAIL` is
`Record<EditionId, string>` (a missing id fails to compile) and
`gameOrderRank`'s `switch` is exhaustive over `EditionId`. `npm run
typecheck`, `npm run lint`, `npm test` (572 tests), `npm run build`, and
`npx prettier --check` on the touched files all pass.

Add the third variant and the third edition to `src/rules/primary/v2/edition.ts`,
and update everything that enumerates or matches an edition id:

- A `TOWER_PLACEMENT` variant type with values `spacing_only` and
  `spacing_and_lanes`, documented as defaulting to `spacing_only` per rules
  Appendix A. Every `Edition` names its value explicitly — no implicit default
  in the registry.
- An `Edition` **status** (`active` / `superseded`), mirroring rules Appendix
  B's two tables.
- `EditionId` widens to three values: `2-0:BATTLE`, `2-1:SKIRMISH`,
  `2-0:SKIRMISH`. Register all three with the variant values from the Grounding
  facts table. The exported `SKIRMISH_EDITION` constant now names
  `2-1:SKIRMISH`; add a separately named exported constant for the historical
  `2-0:SKIRMISH` so tests can reach it without a map lookup (mirroring the
  existing `BATTLE_EDITION`/`SKIRMISH_EDITION` precedent).
- `playableEditions()` returns editions that are **active** _and_ whose army
  fits their board — the first time the readable set and the playable set
  differ. `EDITIONS` (all three) stays what `readRecord.ts` resolves against;
  no change is needed in `readRecord.ts` itself beyond its doc comment, since it
  already looks tags up in `EDITIONS`.
- `src/board/gameNames.ts`: make `gameName` **deliberate** rather than
  accidental — an explicit per-id mapping covering all three ids (so a fourth id
  fails to compile) rather than "Battle if `2-0:BATTLE`, else Skirmish".
  `defaultGameId`'s "nothing played yet" fallback becomes `2-1:SKIRMISH`; its
  "last played" path is unchanged and must keep working now that a session can
  carry either Skirmish id.
- `src/board/GameChoice.tsx`: build the offered games from `playableEditions()`
  (Skirmish first, per story.md's "recommended first game"), never from the raw
  registry, so `2-0:SKIRMISH` is never offered. Keep the per-game description
  text keyed such that every playable edition is guaranteed to have one.

Do **not** implement the lane rule here — this step is registry and naming only.
Note that from this commit on, a new Skirmish game is chosen, played and tagged
`2-1:SKIRMISH` while the rule itself lands in Steps 2–5; see "Decisions resolved
at plan time", item 10, for why that transitional window is harmless.

Why it comes here: every later step needs the variant value and the three-edition
registry to exist. It introduces no rule behavior, so it is a safe first commit,
and it is the only step that widens `EditionId` (a type change that ripples
through the picker and the tests).

How to verify (automated): extend `edition.test.ts`, `gameNames.test.ts` and
`readRecord.test.ts` to assert — the registry holds exactly the three ids with
the variant values and statuses from the Grounding facts table;
`playableEditions()` returns exactly `2-0:BATTLE` and `2-1:SKIRMISH` (in that
set, with Skirmish offered first by the picker's own ordering) and never
`2-0:SKIRMISH`; every playable edition has a picker description;
`gameName` gives "Battle" for `2-0:BATTLE` and "Skirmish" for **both** Skirmish
ids; `defaultGameId(null)` is `2-1:SKIRMISH` and `defaultGameId(<edition>)`
returns that edition's own id for all three; `readRecord` accepts a record
tagged `2-1:SKIRMISH` and still accepts `2-0:SKIRMISH` and `2-0:BATTLE`, and
still rejects an unknown tag. `npm run typecheck && npm run lint && npm test`.

---

## Step 2 — The closed-square geometry (pure, unwired)

Status: committed

Notes: Added `homeSquaresFacingLane(side, layout = BATTLE_LAYOUT)` to
`board.ts`, computed from a private `orthogonalNeighbours` helper (up to
four in-bounds neighbours, using `columnIndexOf`/`columnLetter` for column
arithmetic and layout bounds for row/column validity) plus `layout.lakeRows`
and `isLake`, filtering `homeSquares(side, layout)` by "has a neighbour whose
row is a lake row and which is not itself a lake" — the rules' verbatim
definition. Nothing is hardcoded; the function derives the closed set purely
from the layout. Order falls out naturally from `homeSquares`'s row-major,
left-to-right order (itself derived from `allSquares`), so no extra sorting
step was needed. Added tests in `board.test.ts`: Battle returns `[]` for
both sides; Skirmish returns exactly `A3, D3, E3, H3` for White and `A6, D6,
E6, H6` for Black (asserted by value via `toEqual`, in the expected order);
and an explicit check that `B3, C3, F3, G3` (and the Black mirror) are
excluded. Updated `board.ts`'s module header to name all three editions
(previously named only the original two), matching `boardLayout.ts`'s
existing three-edition header. No other files were touched — the function is
not consumed anywhere yet, per the step's scope.

`npm run typecheck`, `npm run lint`, `npm test` (576 tests, 28 files) and
`npx prettier --check` on the two touched files all pass. No deviations from
the plan.

Add to `src/rules/primary/v2/board.ts` a pure geometric query that, given a
`Side` and a `BoardLayout`, returns that side's home squares which are
**orthogonally adjacent to a square that lies in a lake row and is not itself a
lake** — the rules' definition of "directly in front of a lane" (Appendix A,
`TOWER_PLACEMENT`), verbatim, expressed in terms of the layout's own
`lakeRows`/lake cells. It knows nothing about Towers, variants, or editions: it
is board geometry, and it lives next to `homeSquares`/`isLake`/`regionOf` for
that reason (see Decisions item 7).

Constraints: it must derive everything from the layout (never a hardcoded square
list), consider all four orthogonal neighbours (not just the one toward the
middle), ignore off-board neighbours, and return the squares in a stable order
so tests can compare directly.

Nothing consumes it yet — this step only adds the vocabulary Step 3 threads
through.

Why it comes here: Step 3 (the rule and auto-fill) and Step 5 (the board
marking) both consume it; defining it first as pure geometry lets it be tested in
isolation with no forward dependency.

How to verify (automated): new tests in `board.test.ts` asserting on
`standard_64` exactly `A3, D3, E3, H3` for white and exactly `A6, D6, E6, H6`
for black — and, explicitly, that `B3, C3, F3, G3` (and their black
counterparts) are **not** in the set, since those sit behind lakes; and on
`standard_144` the **empty** set for both sides. Assert the sets by value, not by
size alone. `npm test`.

---

## Step 3 — Thread the variant into placement state, and make auto-fill respect it

Status: pending

Wire the variant through `src/rules/primary/v2/placement.ts` and make auto-fill
honour it:

- `PlacementState` gains a **required** `TOWER_PLACEMENT` value alongside its
  existing `boardLayout` and `army`; `emptyPlacement` takes it as a required
  fourth argument and `clear` carries it through. Update all call sites: the
  live ones are `src/board/placementSession.ts` (`newSession` passes the
  edition's own value, so the three can never disagree) and
  `src/board/EngineGame.tsx` (Battle-only, disabled: pass `spacing_only`); the
  rest are mechanical updates in `placement.test.ts` and `gameState.test.ts`,
  which all construct Battle states.
- Add a placement-level query for **the squares closed to Towers in this state**:
  the Step 2 geometry when the state's variant is `spacing_and_lanes`, and the
  **empty set** when it is `spacing_only`. This is the single place the rest of
  the app asks "where can't a Tower go here", so the answer is already correct
  for Battle (empty by geometry) and for a historical `2-0:SKIRMISH` placement
  (empty by variant) without any board- or edition-specific branching.
- `autoFill` never places a Tower on a closed square: exclude them from the
  Tower candidate set before the existing spacing-aware selection runs, leaving
  those squares available to non-Tower pieces. Auto-fill must stay reliable on
  Skirmish, where 3 Towers go into a 24-square home zone with 4 squares closed.
- `src/rules/primary/v2/gameState.ts`'s `buildInitialGameState` already checks
  that both placements' board layout matches the edition's; extend that
  invariant check to the variant value too, so a placement built for one
  edition can never be sealed into another's game state.

Do **not** change the confirm-time legality check or any UI here (Steps 4–5) —
this step keeps the app behaving exactly as it does today except that auto-fill
on Skirmish now avoids the four closed squares.

Why it comes here: it depends on Step 1 (the variant exists on an edition) and
Step 2 (the geometry). Auto-fill is made stricter **before** the confirm-time
check starts rejecting lane placements (Step 4), so there is never a commit where
an auto-filled Skirmish army cannot be confirmed.

How to verify (automated): unit tests in `placement.test.ts` — a
`spacing_and_lanes` Skirmish state reports exactly the four closed squares for
its side, while a `spacing_only` Skirmish state and a Battle state report none;
and a loop of **at least 200 auto-fills** of a fresh `spacing_and_lanes` Skirmish
placement (driven by a seeded `RandomSource` for reproducibility, and separately
by `Math.random`) that each time completes the full 16-piece army, places no
Tower on any closed square, and leaves no two Towers touching — plus the same
loop on Battle to prove nothing regressed. Add a `gameState.test.ts` case that
building an initial game state from placements whose variant disagrees with the
edition throws. `npm run typecheck && npm run lint && npm test`.

---

## Step 4 — One legality check for both Tower rules, and the player-facing sentences

Status: pending

Give the rules layer a single answer to "is this side's Tower placement legal,
and if not, why", and give the UI layer the sentences to say — both as pure,
directly testable code, with no UI wiring yet:

- In `placement.ts`, replace the boolean `towersLegallyPlaced` with a check that
  returns a **structured result**: legal, or a violation naming which rule was
  broken (Tower spacing / Tower in front of a lane) and the square(s) involved.
  It must apply the lane rule only when the state's variant is
  `spacing_and_lanes`, and must report the spacing rule exactly as it does
  today. Update the two existing call sites (`HotSeatGame.tsx`,
  `EngineGame.tsx`) to derive their existing boolean from the new result, so
  **behaviour is unchanged in this step** apart from an army with a Tower in
  front of a lane now also being refused at Confirm.
- Add a **would-placing-here-be-refused** query the UI can ask before it acts:
  given a state, a target square and a piece type, is this specifically the lane
  rule refusing it? This is what makes drop-time refusal possible without
  `place`/`move`/`swap` throwing (those keep their current "programming
  invariant" contract, which the UI must never trip).
- Add a small pure module under `src/board/` (alongside `gameNames.ts` /
  `playAnnouncement.ts`, which are the codebase's precedent for testing UI text
  as pure functions — there is no component-test harness in this project) that
  turns a structured reason into the player-facing sentence: the refusal
  sentence, the "Towers can't go on …" hint listing the closed squares for a
  side, and the existing spacing-block sentence, all in the one voice described
  in Decisions item 1. Player-facing wording rules apply: name sides by colour,
  use the rules' piece names, use "move" never "ply", and explain "lane" in
  passing ("the open column running through the middle of the board") rather
  than assuming the word is known.

Why it comes here: it depends on Step 3's state and closed-square query, and it
gives Step 5 everything it needs as already-tested pure functions, so the UI step
is wiring only.

How to verify (automated): unit tests — the legality check returns legal for a
lawful Skirmish army; a spacing violation for two touching Towers (on both
editions); a lane violation for a Tower on A3 under `spacing_and_lanes`; legal
for that same layout under `spacing_only` (the historical edition) and on Battle;
and a sensible single result when both rules are broken at once. Tests for the
"would this be refused" query covering a Tower onto a closed square (yes), a
non-Tower onto a closed square (no), a Tower onto an open square (no), and any
square on Battle (no). Tests for the sentence module asserting each sentence
mentions the square(s) at issue, names Towers, and that the spacing and lane
sentences are **different strings** — the two must be distinguishable, per Gate
A. `npm run typecheck && npm run lint && npm test`.

---

## Step 5 — Placement enforcement in the UI: refusal, marking, and one voice

Status: pending

Wire Step 4's results into the placement screen so a player is refused, told
why, and shown where Towers cannot go:

- `src/board/HotSeatGame.tsx`: before performing a placement action that would
  put a **Tower** on a closed square, refuse it — leave the state untouched,
  keep the current selection so the player can immediately pick another square,
  and set the refusal message. Cover **every** path that can land a Tower there:
  placing from the tray, moving an already-placed Tower, and swapping a Tower
  with a piece on a closed square. Clear the refusal message on the next
  successful placement action and on confirm/hand-off, so it never lingers into
  the next player's turn.
- `src/board/PlacementStatus.tsx`: replace the boolean
  `towerAdjacencyBlocked` prop with the message to show (or none), keeping the
  **existing always-mounted** `role="status" aria-live="polite"` region exactly
  as it is — do not toggle the region itself in and out of the DOM (the comment
  in that file explains why). Apply the precedence in Decisions item 4: refusal,
  then the closed-squares hint while a Tower is in hand, then the confirm-time
  block, then nothing. Confirm stays disabled whenever the legality check is not
  legal.
- `src/board/Board.tsx`: accept an optional set of squares to draw as "closed to
  Towers" and render them with a new quiet modifier class (alongside
  `board-square--lake` / `--selected`) styled in `Board.css`. The marker is
  decorative (`aria-hidden`, like the lake icon) — its non-visual equivalent is
  the hint sentence in the live region. `HotSeatGame` passes the closed squares
  **only while a Tower is in hand** (a Tower selected in the tray, or an
  already-placed Tower picked up on the board) and passes none otherwise.
  `EngineGame.tsx` passes nothing and is otherwise untouched.

Nothing about Battle changes anywhere in this step: its closed set is empty, so
no square is marked, no hint is spoken, and no placement is ever refused.

Why it comes here: it depends on Steps 3 and 4 (state, closed squares, legality,
sentences) and is the first step a player can see. It closes the window opened in
Step 1 (Decisions item 10).

How to verify: **automated** — `npm run typecheck && npm run lint && npm test`
stay green (the new logic is already covered by Step 4's pure tests; add
coverage for any new pure helper this step introduces). **Manual (Gates A, B, C
placement portion, and E)**, with `npm run dev` — note that this container has no
file watching, so **restart the dev server** before observing:

- **Gate A.** Start a Skirmish game. As red (White): a Tower is refused on A3,
  D3, E3 and H3 with a message a player can act on, and nothing is placed; a
  Tower is accepted normally on B3, C3, F3, G3 and on every square of the other
  two home rows; non-Tower pieces are accepted on A3/D3/E3/H3. Confirm and repeat
  as blue (Black) on A6, D6, E6, H6. Place two Towers next to each other and
  confirm the existing "two Towers are touching" block still behaves as before,
  and that the two messages read as clearly different problems. Check that
  moving a placed Tower onto a closed square, and swapping a Tower onto one, are
  refused the same way.
- **Gate B.** Auto-fill a Skirmish army repeatedly (at least ten times, both
  sides): every fill succeeds, no Tower ever lands on a closed square, and no two
  Towers touch. Confirm is never blocked after an auto-fill.
- **Gate C (placement portion).** Start a Battle game: no square is marked, no
  hint appears, no Tower placement is refused anywhere, and placement behaves
  exactly as before.
- **Gate E.** With a screen reader running: the refusal is announced with its
  reason, the closed-squares hint is announced when a Tower is taken in hand,
  the spacing block is still announced, and nothing is announced twice from two
  regions. The keyboard-only clause of Gate E is expected to be **waived** —
  the placement board has never been keyboard-operable (see "Known limitation"
  above); confirm only that this story has not made it worse, and report the
  waiver rather than building keyboard operability here.

---

## Step 6 — Records: the new tag, the historical edition, and a sample record

Status: pending

Prove and pin the record behaviour end to end, and add the historical fixture:

- Confirm (with tests, not by inspection) that a finished **Skirmish** game's
  record carries `Ruleset "2-1:SKIRMISH"`, a **Battle** game's still carries
  `2-0:BATTLE`, and that the position block and every other part of the notation
  are unchanged.
- Add a checked-in sample record under a new `doc/samples/` folder: a small,
  complete `2-0:SKIRMISH` game record whose **starting position has a Tower
  directly in front of a lane** (e.g. on A3) — a position legal under the
  historical edition and refused under `2-1:SKIRMISH`. Build it from the app's
  own developer record dump so it is genuinely well-formed, then hand-edit the
  Tower onto A3 and the `Ruleset` tag as needed. Add a short README-style note
  in that folder saying what each sample is for.
- Add tests that read that file from disk (vitest runs in a `node`
  environment, so `fs` is available) and assert `readRecord` parses **and
  replays it to the end** — the guarantee that placement rules never leak into
  replay validation. Add the mirror-image test too: the same position under a
  `2-1:SKIRMISH` tag also replays without complaint, because replay never checks
  placement.
- Review the existing record/review tests and move those that represent a _new_
  Skirmish game to `2-1:SKIRMISH`, keeping deliberate `2-0:SKIRMISH` coverage
  for the historical path (both readers should stay exercised). Note in the test
  file's comment which is which and why.

Why it comes here: it depends on Step 1 (the registry and the tag) and Step 5
(so a manually produced Skirmish record actually reflects the enforced rule).

How to verify: **automated** — the tests above, plus
`npm run typecheck && npm run lint && npm test`. **Manual (Gate C records
portion + Gate D)**, with a restarted `npm run dev`: play a short Skirmish game
to a result, take the developer record dump, confirm it is tagged
`2-1:SKIRMISH`, save it to a file and import it in the reviewer — it replays end
to end on the 8×8 board. Do the same for Battle and confirm `2-0:BATTLE` and an
unchanged 12×12 review. Then import `doc/samples/`'s `2-0:SKIRMISH` sample —
the one with a Tower in front of a lane — and confirm it imports and replays
without complaint.

---

## Step 7 — Player-facing copy and the README check

Status: pending

Close the story with the copy pass and the README review:

- `src/board/GameChoice.tsx`: add one short clause to the **Skirmish**
  description mentioning that Towers can't be placed in front of the open lanes,
  so a player meets the rule before it refuses them. Leave the Battle
  description alone. Keep it plain and short — no rules restatement, no edition
  ids, no jargon.
- Sweep the placement surfaces for any copy that is now inaccurate or that says
  "Skirmish" where it should name the rule, and for any player-facing string
  that leaked the word "ply" or an edition id (there should be none).
- Review `README.md` against this story: its setup bullet describes placing an
  army, and should gain a brief clause that in Skirmish towers can't stand in
  front of the lanes. The `/update-readme` command may be used — it reviews the
  branch diff and updates `README.md` if warranted. Do not restate the rules;
  the companion repository stays the linked source of truth. If nothing needs
  changing, say so in the step's Notes rather than editing.

Why it comes here: last, so the copy describes the finished behaviour.

How to verify: **automated** — `npm run typecheck && npm run lint && npm test`
stay green, `npm run format:check` is clean, and `gameNames.test.ts` /
`GameChoice`'s description test still passes with the new text. **Manual** —
with a restarted `npm run dev`, open the game picker and read the Skirmish
description as a player would: it names the restriction in one clause, plainly,
without jargon; and re-read `README.md` end to end for accuracy.
