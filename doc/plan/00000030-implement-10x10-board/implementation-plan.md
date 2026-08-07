# Implementation Plan — Story 00000030: Implement 10x10 board

This plan adds **Clash** — a third playable game, made of a **proposed** board
(`BOARD_LAYOUT=asymmetric_100`, 10 × 10) and a **proposed** army
(`ARMY_COMPOSITION=standard_clash`, 20 pieces) from the companion project's
`proposed-variants.md` sandbox — alongside Battle and Skirmish, for hot-seat
play and review only.

Read `story.md` in this folder in full before starting any step. Its
**Policy (fixed by the owner)**, **In scope / Out of scope**,
**Design decisions & constraints** and **Manual-verification gates** sections
are settled and are not re-litigated here. This plan resolves the story's
**"Open items to resolve at plan time"** — the resolutions are in
"Decisions resolved at plan time" below, and every step is written assuming
them.

Story 00000027 (`doc/plan/00000027-add-diagonal-flags/`) is the closest
precedent for everything about flags, the `RuleConfiguration` model, the
`Ruleset` tag, the new-game screen and the reviewer. Its plan and its peer
review are worth reading before Step 3.

---

## Grounding facts (read once — applies to every step)

The single source of truth for the rules is `doc/ruleset/rules.md` in the
companion [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
repository. **Neither of this story's two values is in `rules.md` Appendix A**:
both live in that repository's `doc/ruleset/proposed-variants.md` sandbox (its
story 00000041, merged 2026-08-07) and neither is implemented there. Fetch the
sources if a step needs to re-check a detail:

- `gh api repos/phil-hutchinson/capture-the-flag/contents/doc/ruleset/proposed-variants.md --jq '.content' | base64 -d`
- `gh api repos/phil-hutchinson/capture-the-flag/contents/doc/ruleset/technical-notes.md --jq '.content' | base64 -d`
- same for `doc/ruleset/rules.md` and `doc/ruleset/changelog.md`.

### The published state (unchanged by this story)

| Flag               | Published values                       | Default           |
| ------------------ | -------------------------------------- | ----------------- |
| `BOARD_LAYOUT`     | `standard_144`, `standard_64`          | `standard_144`    |
| `ARMY_COMPOSITION` | `standard_battle`, `standard_skirmish` | `standard_battle` |
| `TOWER_PLACEMENT`  | `spacing_only`, `spacing_and_lanes`    | `spacing_only`    |

Editions (Appendix B): `2-0:BATTLE` and `2-1:SKIRMISH` active, `2-0:SKIRMISH`
superseded. **This story publishes no edition and supersedes none.**

### `BOARD_LAYOUT=asymmetric_100` (the Clash board)

- 10 columns (A–J) × 10 rows.
- Rows 1–3 White home, row 4 buffer, rows **5–6 lake**, row 7 buffer,
  rows 8–10 Black home. Home zone = 3 × 10 = **30 squares** per side.
- Lake columns, identical on **both** lake rows: **A, D, G, H, I** — 0-based
  indices `0, 3, 6, 7, 8`.
- That is three lake blocks of widths 1 (A), 1 (D) and 3 (G–I), and three
  lanes: B–C (2 wide), E–F (2 wide), and **J (1 wide, at the right edge)**.
  **Column A has no lane at all** — this is the first layout in the app with a
  lake at a board edge, and the first that is not mirror-symmetric.
- 10 lake squares and 10 open squares within the 2 × 10 lake zone (the same
  50:50 ratio both published layouts have, distributed unevenly).

### `ARMY_COMPOSITION=standard_clash` (the Clash army)

| Rank | Piece          | `PieceTypeId`  | Qty    |
| ---- | -------------- | -------------- | ------ |
| 1    | Master-of-Arms | `masterOfArms` | 3      |
| 2    | Champion       | `champion`     | 3      |
| 3    | Knight         | `knight`       | 3      |
| 4    | Halberdier     | `halberdier`   | 3      |
| 5    | Foot Soldier   | `footSoldier`  | 3      |
| 6    | Militia        | `militia`      | **0**  |
| —    | Tower          | `tower`        | 4      |
| —    | Flag           | `flag`         | 1      |
|      | **Total**      |                | **20** |

20 pieces in a 30-square home zone. A type at zero is already an established
case (Skirmish fields zero Foot Soldiers and zero Militia), so the tray, the
catalog and `freshInventory` need no new handling.

### How Clash is recorded (owner-fixed, story.md's Policy)

There is **no published edition for Clash and this app must not invent one.**
A Clash game stamps the Battle edition id plus the two deviating flag values.
Because `RULE_FLAG_IDS` is alphabetically sorted, and this story adds two flag
ids that sort before both existing ones, the full tag is exactly:

```
2-0:BATTLE ARMY_COMPOSITION=standard_clash BOARD_LAYOUT=asymmetric_100
```

(`ARMY_COMPOSITION` < `BOARD_LAYOUT` < `DIAGONAL_ATTACKABLE` <
`DIAGONAL_ATTACK_PATH`.) Battle is the base rather than Skirmish because its
values for both flags are the published defaults **and** its `TOWER_PLACEMENT`
is `spacing_only`, which is what Clash wants.

**Battle and Skirmish records must stay byte-identical to today**:
`2-0:BATTLE`, `2-1:SKIRMISH`, `2-0:SKIRMISH`, bare, with no tokens. Existing
record fixtures and the four files in `doc/samples/` must keep passing
**unedited** — that is the cheapest honest evidence, and no step may edit them.

### This story adds no new way to refuse a record

Story 00000027's Step 10 established, on the companion project's view-only-replay
guarantee, that **no `FLAG=value` token ever rejects a record** — the edition id
is the only part of the `Ruleset` tag that can. **That guarantee stands whole
here** (Decision 9): this story introduces no new `ReadRecordError` case, no new
`RecordFileError` case, and no new rejection of any kind. A `BOARD_LAYOUT` value
this app has never heard of is handled by _deriving_ the board from the record's
own position block (Step 8), not by refusing the record.

### Where the relevant code is today

- `src/rules/primary/v2/boardLayout.ts` — `BoardLayout` (pure geometry:
  `columnCount`, `rowCount`, `homeRowsPerSide`, `hasBuffer`, `lakeRows`,
  `lakeColumnIndices`), the `BoardLayoutId` union, the parametric helpers
  `columnLetter`, `lakeCells`, `rowRegion`, `homeZoneSize`, and the
  `BOARD_LAYOUTS` table.
- `src/rules/primary/v2/armyComposition.ts` — `ArmyRoster`, `ArmyCompositionId`,
  `armySize`, `freshInventory`, the `ARMY_COMPOSITIONS` table, `BATTLE_ARMY`.
- `src/rules/primary/v2/edition.ts` — `Edition` (`id`, `boardLayoutId`,
  `armyCompositionId`, `towerPlacement`, `status`, **plus the resolved
  `boardLayout` and `army`**), `EDITIONS`, `editionById`, `armyFitsBoard`,
  `combinationFits`, `playableEditions`, and the three exported edition
  constants.
- `src/rules/primary/v2/ruleFlags.ts` — `RULE_FLAG_CATALOG` (today only the two
  diagonal flags), with `RuleFlagId`/`RuleFlagValue`/`ResolvedRuleFlags` all
  derived from it, and `RULE_FLAG_IDS` explicitly `.sort()`ed.
- `src/rules/primary/v2/configuration.ts` — `RuleConfiguration` (an `Edition`
  plus every flag's resolved value), `configureRules` (the sole constructor),
  `resolvedEditionValue` (currently ignores the edition and returns the catalog
  default, with a comment naming itself the extension point), `deviatingFlags`,
  `isStandardConfiguration`, `renderRulesetTag`, `parseRuleFlagTokens` (never
  fails; unresolvable tokens come back verbatim in `unrecognizedTokens`),
  `STANDARD_BATTLE_CONFIGURATION`, `STANDARD_SKIRMISH_CONFIGURATION`.
- `src/rules/readRecord.ts` — splits the `Ruleset` tag, treats token 0 as the
  edition id (the only thing that can reject a record), hands the rest to
  `parseRuleFlagTokens`, then calls `parseRecordFile(text, edition.boardLayout)`
  and `replayRecord`. Returns `{ record, configuration, unrecognizedRuleTokens }`.
- `src/rules/primary/v2/recordFile.ts` — splits a record file into header /
  position block / move list, hands the block to `parsePositionBlock` together
  with the caller's `BoardLayout`, and parses the move list. The layout is used
  for nothing else here.
- `src/rules/primary/v2/gameState.ts` / `play.ts` — `InitialGameState` and
  `PlayState` carry `configuration` and a rendered `ruleset` string;
  `buildInitialGameState` validates both placements against the edition and
  renders the tag; `renderPositionBlock`/`parsePositionBlock` are layout-
  parametric and already produce structured `PositionBlockError`s that name the
  expected size and misplaced lakes. `parsePositionBlock` reads only the
  layout's `rowCount`, `columnCount` and `isLake` — nothing else.
- `src/rules/primary/v2/replay.ts` — deliberately rule-blind, and takes no
  layout at all.
- `src/board/gameNames.ts` — `gameName(edition)`, `boardSizeDescription(edition)`,
  `defaultGameId(lastPlayed: Edition | null): EditionId`.
- `src/board/GameChoice.tsx` — the new-game screen: `GAME_DETAIL` keyed by
  `EditionId`, `gameOrderRank(EditionId)`, the game list from
  `playableEditions()`, and story 00000027's diagonal rule-choice section.
- `src/board/ruleChoices.ts` — `RULE_CHOICE_COPY` (exhaustive over
  `RuleFlagId` **and** each flag's values — adding a flag to the catalog will
  fail to compile here until it is handled), `RULE_CHOICES`,
  `RULE_CHOICES_HEADING`, `nonStandardRuleSentences`, and
  `unrecognizedRuleSentence` (the established home for review-screen copy about
  a tag token this app cannot resolve).
- `src/review/reviewText.ts` — the one place structured **rejections** become
  sentences; its switches all end in `default: return error satisfies never;`.
- `src/board/placementSession.ts` — `newSession(edition)` seeds both sides'
  `PlacementState` with the edition's layout, army and tower-placement value.
- `src/board/Board.tsx`, `FullBoard.tsx`, `boardView.ts` — already fully
  parametric over a `BoardLayout`; the CSS sizes the grid from `--columns` /
  `--rows` custom properties, so a 10 × 10 board needs no CSS change.
  **`FullBoard` (the review and Phase-2 board) reads only `isLake` plus
  `rowsOf`/`columnsOf`; `visibleRows` — the one function that reads
  `homeRowsPerSide` and `hasBuffer` — is used by the _placement_ board only.**
- `src/review/ReviewScreen.tsx` — renders the record on
  `configuration.edition.boardLayout` and shows `nonStandardRuleSentences` plus
  one `unrecognizedRuleSentence` per unresolved token.
- `src/App.tsx` — holds `lastPlayedConfiguration` in memory (never persisted).

### Out of bounds for every step

- **`src/engine/**` and `src/encoding/eng-nn-1/**` must not be edited.** Nothing
  there reads `Edition`; `decoder.ts` uses `STANDARD_BATTLE_CONFIGURATION` and
  keeps working unchanged. If a step appears to need an edit there, **stop and
  escalate** — it means something else is wrong.
- `src/board/EngineGame.tsx` is not mounted anywhere (computer play is shown as
  unavailable on the start screen) but **must keep compiling**. It builds its
  placements from `BATTLE_LAYOUT`/`BATTLE_ARMY` directly and uses
  `STANDARD_BATTLE_CONFIGURATION`; no change is expected there.
- **No new edition**, and no change to `2-0:BATTLE`, `2-1:SKIRMISH` or
  `2-0:SKIRMISH`.
- **No new ruleset version folder** — everything stays in
  `src/rules/primary/v2/`.
- No change to placement, movement, combat, the formation bonus, the diagonal
  flags, the notation, or the ending conditions.
- No third value for `TOWER_PLACEMENT`, and no general board-editor or
  custom-layout capability.
- **No existing record fixture, sample file, tag string or position block may be
  edited.** If one needs editing, the change is wrong.

### The check every step runs

From the repository root:

```
npm run typecheck && npm run lint && npm test && npm run format:check && npm run build
```

All five must be clean before a step is considered done. `npm run build` is
what proves the frozen `src/engine/` and `src/encoding/` trees still compile.
Steps with a **manual** verification additionally need `npm run dev` — **this
container has no file watching, so the dev server must be restarted** before
observing anything.

---

## Decisions resolved at plan time

These resolve story.md's "Open items to resolve at plan time", in its order.
Every step below assumes them.

1. **The configuration carries the board and the army; the edition stops
   carrying them.** `RuleConfiguration` gains two resolved fields — the
   `BoardLayout` and the `ArmyRoster` the game is actually played on — computed
   by `configureRules` from the configuration's own resolved `BOARD_LAYOUT` and
   `ARMY_COMPOSITION` values. At the same time, `Edition`'s `boardLayout` and
   `army` fields are **removed** (its `boardLayoutId` and `armyCompositionId`
   stay, and become the input to flag resolution).

   Removing the fields rather than leaving them in place is the whole point:
   every one of the ~21 existing `edition.boardLayout` / `edition.army` reads
   across 13 non-test modules becomes a **compile error**, so the compiler
   enumerates the migration exactly and no path can silently keep reading the
   edition's own values. This is the same compiler-driven technique story
   00000027's Decision 3 used, and story.md names this migration as the story's
   main technical risk. Callers derive nothing themselves and never re-resolve:
   there is exactly one place a layout or a roster comes from, and it is the
   configuration.

   Both new fields are plain, JSON-serializable data (the same objects `Edition`
   carried), so `PlayState` still crosses `searchWorker.ts`'s boundary safely.

2. **`TOWER_PLACEMENT` stays an `Edition` field and does not join the flag
   catalog.** Only `BOARD_LAYOUT` and `ARMY_COMPOSITION` become flags (story.md,
   in-scope item 3). Tower placement is read as `configuration.edition.
towerPlacement`, which is correct for every configuration this app can build:
   Clash bases on Battle, whose value (`spacing_only`) is exactly what Clash
   wants, and story.md establishes that Clash's buffer rows make the lane rule
   close nothing anyway. This asymmetry must be documented where the field is
   read; the day a configuration needs a tower rule its edition does not state
   is the day `TOWER_PLACEMENT` becomes a flag too, and that day is not this
   story.

3. **`resolvedEditionValue` starts doing real work.** For `BOARD_LAYOUT` it
   returns the edition's own `boardLayoutId`; for `ARMY_COMPOSITION`, the
   edition's `armyCompositionId`; for any other flag it keeps falling back to
   the catalog default. This is what keeps Battle and Skirmish records
   byte-identical: each edition resolves its own board and army, so neither
   deviates and neither emits a token. It is also what makes Clash's two tokens
   real deviations from `2-0:BATTLE`.

4. **`ruleFlags.ts` stays the single spelling of the flag ids and their value
   strings**, and the id _types_ are derived from it rather than declared twice:
   `BoardLayoutId` becomes `RuleFlagValue<"BOARD_LAYOUT">` and
   `ArmyCompositionId` becomes `RuleFlagValue<"ARMY_COMPOSITION">`, so
   `boardLayout.ts` and `armyComposition.ts` import their id types from the
   catalog. Their tables (`BOARD_LAYOUTS`, `ARMY_COMPOSITIONS`) are then
   exhaustive over those types by construction, and a renamed value in the
   catalog produces a compile error in the table rather than silent drift.
   `ruleFlags.ts` itself imports nothing (no cycles).

5. **Flags come in two kinds, and the split lives in `ruleFlags.ts`.**
   `ARMY_COMPOSITION` and `BOARD_LAYOUT` are **game-defining** flags: a player
   chooses them by choosing a game, never as a toggle. `DIAGONAL_ATTACKABLE`
   and `DIAGONAL_ATTACK_PATH` are **rule choices**: offered as toggles on the
   new-game screen and described to a reviewer sentence by sentence.
   `ruleFlags.ts` gains the game-defining id list and the complementary
   rule-choice id list, both derived from the catalog so a future flag must be
   classified (and fails to compile until it is). `ruleChoices.ts`'s copy table
   is retyped over the rule-choice ids only, and `nonStandardRuleSentences`
   ignores game-defining deviations — otherwise every Clash game would announce
   two nonsense sentences about its own board and army, and the new-game screen
   would sprout board/army toggles beside the diagonal ones.

6. **The picker offers games, not editions**, and the catalog of offered games
   is new rules-layer data: `src/rules/primary/v2/games.ts`, holding a
   `GameId` union (`"battle" | "skirmish" | "clash"`), one entry per game giving
   its base `Edition` and its game-defining flag overrides, a function that
   builds a game's standard `RuleConfiguration`, the list of playable games, and
   `identifyGame(configuration)` — the reverse lookup that answers "which game
   is this configuration?" by its resolved `(BOARD_LAYOUT, ARMY_COMPOSITION)`
   pair, ignoring the diagonal flags (which are orthogonal and apply to all
   three games). Identifying by that pair rather than by edition id means the
   superseded `2-0:SKIRMISH` still identifies as Skirmish, and an unrecognized
   pairing returns "no game" rather than being forced into one.

   Every record in the catalog is exhaustive over `GameId`, preserving the
   property `GAME_DETAIL`/`gameOrderRank` were written for: a fourth game must
   fail to compile until it has a name, a description and a position.

   `playableEditions()` is **removed** — with two games sharing an edition id it
   can only mislead. `EDITIONS`/`editionById` stay (record reading still needs
   them). `combinationFits`/`armyFitsBoard` stay and are applied to the games
   catalog as a floor, not a rule: with three boards and three armies most of
   the nine pairings "fit" (`standard_battle` on `asymmetric_100` is 25 in 30,
   and `standard_clash` fits all three boards), and only the three designed
   pairings are ever offered.

7. **Naming follows the game, not the edition.** `gameNames.ts` gains an
   exhaustive per-`GameId` name lookup for the picker, and a
   `RuleConfiguration`-taking variant that returns the game's name or nothing
   when the configuration matches no catalog game. `boardSizeDescription` takes
   a `RuleConfiguration` and reads its resolved layout (so Clash reads "a 10x10
   board"; check the hand-picked article rule still produces "a", not "an").
   `defaultGameId` takes the last-played `RuleConfiguration` and returns a
   `GameId`, still falling back to Skirmish when nothing has been played this
   session. Session stickiness is unchanged in behaviour: in-memory only, never
   persisted, and it now remembers the _game_ (so finishing a Clash game and
   pressing "New game" pre-selects Clash).

8. **Board precedence when reading a record.** Two cases, and only two:

   - **The tag's `BOARD_LAYOUT` resolves to a board this app knows** (including
     the common case of no token at all, which resolves to the edition's own
     value): **the tag wins.** The position block is parsed and _validated_
     against that geometry, exactly as `readRecord` already does today — a
     wrong row count, a wrong row width, a lake mark on a non-lake square or a
     lake square not marked are all caught by the existing
     `PositionBlockError` machinery, with its existing wording. No new
     precedence code and no new error kinds. Rationale: the notation frame, the
     rendered board and every subsequent ply all depend on the geometry, and the
     tag is the record's own declaration of what it was played under.
   - **The tag names a `BOARD_LAYOUT` value this app has no geometry for**:
     there is nothing to validate against, so the board is **derived from the
     record's own position block** and the record reviews on that (Decision 9
     and Step 8).

9. **No flag token ever rejects a record — including `BOARD_LAYOUT`.**
   _(Owner ruling, 2026-08-07, reversing this plan's original draft, which had
   made an unresolvable `BOARD_LAYOUT` value the one rejectable token on the
   grounds that "geometry blocks review, rosters don't". That distinction was
   considered and **rejected**.)_

   The reasoning that decided it: **the position block is fully self-describing.**
   Its line count gives the row count, its cells-per-line give the column count,
   and its `XXX` cells mark every lake square — the companion project's 2-0
   changelog states this explicitly, and adds that the one property _not_
   recoverable from a block, the home-zone row depth, is something a review-only
   viewer does not need. `parsePositionBlock` already reads all three of those
   things; it simply _validates_ them against a supplied `BoardLayout` today
   rather than _deriving_ one. So the app does not need to recognize a
   `BOARD_LAYOUT` value in order to draw the board — which is precisely the case
   story 00000027's Step 10 guarantee was written to cover.

   Therefore: an unresolvable `BOARD_LAYOUT` value is carried as an unrecognized
   token exactly like any other, alongside an unresolvable `ARMY_COMPOSITION`
   value, an unknown flag id, a malformed token and a repeated token. **The
   edition id remains the only part of the `Ruleset` tag that can refuse a
   record**, and this story adds no new `ReadRecordError` case, no new
   `RecordFileError` case, and no new `reviewText.ts` rejection wording.

10. **Player-facing wording for Clash.** The picker's description says what a
    player cannot infer from a size — the uneven lakes and the missing lane at
    one edge — in plain language, with no "experimental"/"proposed"/"variant"
    framing of any kind (story.md's Policy). The placement announcement keeps
    its existing shape ("You chose Clash. Placing on a 10x10 board."), so a
    screen-reader user is not made to sit through a paragraph before placing.
    Draft copy is given in the steps; **the owner may revise it at that step's
    manual gate**, exactly as story 00000027's copy was settled at its gates.

11. **A Clash record is identified to a reviewer by naming the game, not by
    listing deviations.** _(Confirmed by the owner, 2026-08-07: stands as
    written, and remains revisitable at Step 10's manual gate.)_
    `ruleChoices.ts`'s "what was non-standard" surface is the _wrong_ home for it
    (Decision 5: it deliberately ignores game-defining flags, and "Battle with
    two unusual settings" is precisely what story.md forbids). Instead the review
    screen gains one short line naming the game and its board — shown for
    **every** record, not only Clash. Naming it only for Clash would leave Battle
    and Skirmish records silently un-named and make the line read as a warning;
    naming it always is honest now that an edition id no longer identifies a
    game. The same name is added to the developer-facing `GameRecord.tsx` hint
    beside the `Ruleset` tag it already prints. This is an addition to the review
    screen, not a change to any existing record, tag or play behaviour — but it
    is the one place Gate A's "unchanged wording" is deliberately widened, so it
    is called out here.

    **The line is omitted whenever the record's `Ruleset` tag carried any token
    this app could not resolve.** This is not a nicety: with an unresolvable
    `BOARD_LAYOUT` token the configuration's own resolved board falls back to the
    edition's (Battle's), so `identifyGame` would happily answer "Battle" for a
    record being rendered on a derived, quite different board — the line would
    state something false. The same reasoning applies to an unresolvable
    `ARMY_COMPOSITION` token. One uniform rule covers both: name the game only
    when the tag was fully understood **and** the configuration matches a catalog
    game.

12. **Test fixtures.** A geometry suite for `asymmetric_100` (Step 1) and a
    roster suite for `standard_clash` (Step 2); a canonicalization suite proving
    every existing edition's stamp is byte-identical and Clash's is exactly the
    expected three-token string (Step 3); Clash play coverage exercising the
    1-wide J lane and the 3-wide G–I lake block (Step 6); a full record
    round-trip plus a new checked-in sample under `doc/samples/` (Step 7); and
    reading coverage for the geometry-precedence and derived-board cases
    (Step 8). No existing fixture is edited anywhere.

13. **README needs updating** (Step 11). It currently says "There are two games
    to choose from", describes Skirmish and Battle by name and size, and its
    "Set up a game with a friend" and "Status" passages both name the two games.

---

## Step 1 — The Clash board geometry (`asymmetric_100`)

Status: committed

Notes: Added `asymmetric_100` to `BoardLayoutId`, `BOARD_LAYOUTS` and a
documented `ASYMMETRIC_100` constant (10x10, 3 home rows/side, buffer,
`lakeRows: [5, 6]`, `lakeColumnIndices: [0, 3, 6, 7, 8]`) in `boardLayout.ts`,
with no changes to the existing parametric functions (`rowRegion`,
`lakeCells`, `homeZoneSize`, `columnLetter`) and no other consumer touched.
Extended `boardLayout.test.ts` with a matching `describe` block covering all
the assertions the step calls for. Deviation: the step's verification text
says `lakeCells` "returns exactly 20 cells" for this layout; the correct count
is 10 (5 lake columns × 2 lake rows), consistent with story.md's own stated
"10 lake and 10 open squares within the 2 × 10 lake zone" — the plan's "20"
appears to be an arithmetic slip. Implemented and tested the correct value
(10) rather than the plan's stated number; **confirmed by the orchestrator,
and the step's verification text above corrected to 10.** All five repository checks (typecheck, lint, test, format:check,
build) are clean.

Add `asymmetric_100` to `src/rules/primary/v2/boardLayout.ts` as a third
`BoardLayout`, per the Grounding facts' table: 10 columns, 10 rows, 3 home rows
per side, a buffer row on each side, lake rows 5 and 6, and lake column indices
`0, 3, 6, 7, 8` (A, D, G, H, I). Extend the `BoardLayoutId` union and the
`BOARD_LAYOUTS` table; document the layout the way the two existing ones are
documented, including that it is a proposed value from the companion project's
`proposed-variants.md` and not published in Appendix A.

**Nothing else in this step.** No consumer, no edition, no flag. The geometry
must fall out of the existing parametric functions — `rowRegion`, `lakeCells`,
`homeZoneSize`, `columnLetter` — with **no special casing anywhere** for the
asymmetry, the 1-wide lane or the 3-wide lake block. If any existing function
needs a change to handle this layout, that is a finding worth recording in the
step's Notes, not a licence to special-case.

Why it comes here: every later step needs the geometry to exist, and it touches
no existing behaviour, so it is a safe first commit.

Verification (**automated**): extend `boardLayout.test.ts` — the layout reports
10 × 10 with 3 home rows and a buffer; `rowRegion` classifies rows 1–3 as
`white-home`, 4 as `buffer`, 5–6 as `lake`, 7 as `buffer` and 8–10 as
`black-home`; `lakeCells` returns exactly 10 cells, being columns A/D/G/H/I on
each of rows 5 and 6, and **no** lake on any other row; `homeZoneSize` is 30;
column J is the tenth letter and is **open** on both lake rows while column A is
**lake** on both; the lane columns are exactly B, C, E, F, J; and both existing
layouts' assertions still pass unchanged. Run the five repository checks.

---

## Step 2 — The Clash army roster (`standard_clash`)

Status: pending

Add `standard_clash` to `src/rules/primary/v2/armyComposition.ts` as a third
roster, per the Grounding facts' table: 3 each of `masterOfArms`, `champion`,
`knight`, `halberdier` and `footSoldier`, 4 `tower`, 1 `flag`, and **0
`militia`**. Extend the `ArmyCompositionId` union and the `ARMY_COMPOSITIONS`
table, documenting it the same way `STANDARD_SKIRMISH_ROSTER` is documented
(including that it is a proposed, unpublished value).

**Nothing else in this step.** No edition, no flag, no consumer. `armySize` and
`freshInventory` must derive from the roster with no change: a type at zero is
already an established case.

Depends on: nothing (independent of Step 1, but sequenced after it so the two
data additions land as separate, individually verifiable commits).

Verification (**automated**): extend `armyComposition.test.ts` — `armySize` is
20; every one of the eight `PIECE_TYPES` appears in the roster with the
quantities above, with `militia` at 0; `freshInventory` returns a full,
independent copy (mutating it does not touch the roster); and Battle's and
Skirmish's existing assertions still pass unchanged. Add an assertion that 20
fits a 30-square home zone using `armyFitsBoard` with Step 1's layout. Run the
five repository checks.

---

## Step 3 — `BOARD_LAYOUT` and `ARMY_COMPOSITION` become known flags

Status: pending

This is the step that makes `resolvedEditionValue` do real work for the first
time. Per Decisions 3, 4 and 5:

- **`ruleFlags.ts`**: add `ARMY_COMPOSITION` (values `standard_battle`,
  `standard_skirmish`, `standard_clash`; default `standard_battle`) and
  `BOARD_LAYOUT` (values `standard_144`, `standard_64`, `asymmetric_100`;
  default `standard_144`) to `RULE_FLAG_CATALOG`, with the published defaults
  from the Grounding facts. Add the game-defining / rule-choice classification
  (Decision 5) as two derived id lists plus their types, so that every flag in
  the catalog belongs to exactly one kind and a future flag must be classified.
  `RULE_FLAG_IDS` keeps its explicit `.sort()`; confirm it now yields
  `ARMY_COMPOSITION, BOARD_LAYOUT, DIAGONAL_ATTACKABLE, DIAGONAL_ATTACK_PATH`.
- **`boardLayout.ts` / `armyComposition.ts`**: derive `BoardLayoutId` and
  `ArmyCompositionId` from the catalog (Decision 4) instead of declaring the
  unions by hand. The two tables stay exhaustive over the derived types.
  `ruleFlags.ts` must not import either module.
- **`configuration.ts`**: `resolvedEditionValue` returns the edition's own
  `boardLayoutId` for `BOARD_LAYOUT` and its `armyCompositionId` for
  `ARMY_COMPOSITION`, and keeps falling back to the catalog default for every
  other flag. Replace its "no edition states a value today" comment with what
  is now true. `configureRules`, `deviatingFlags`, `renderRulesetTag` and
  `parseRuleFlagTokens` need no logic change.
- **`ruleChoices.ts`**: retype `RULE_CHOICE_COPY` and `RULE_CHOICES` over the
  rule-choice ids only, and make `nonStandardRuleSentences` skip game-defining
  deviations. This is required for the build to stay green (the copy table is
  exhaustive over `RuleFlagId` and would otherwise demand player-facing copy for
  two flags that are never offered as toggles), and it is the correct behaviour
  per Decision 5 — a Clash game must not announce sentences about its own board.

`Edition` still carries `boardLayout`/`army` after this step and nothing reads
the two new flags yet: this step is vocabulary and resolution only, and must
change no observable behaviour.

Depends on: Steps 1 and 2 (the catalog names values that must exist).

Verification (**automated**): extend `configuration.test.ts` and
`ruleChoices.test.ts` —

- `RULE_FLAG_IDS` equals a sorted copy of itself and is the four ids above in
  that order; the catalog holds exactly those four ids with exactly the value
  sets and defaults in the Grounding facts.
- Every flag id is classified as exactly one of game-defining / rule-choice, and
  the two lists partition `RULE_FLAG_IDS`.
- Each of the three registered editions' standard configuration resolves
  `BOARD_LAYOUT` and `ARMY_COMPOSITION` to that edition's own ids (Battle
  `standard_144`/`standard_battle`; both Skirmish editions
  `standard_64`/`standard_skirmish`), reports **no** deviations, and renders
  **byte-identically** to its bare edition id.
- A configuration built on Battle with both game-defining flags overridden to
  the Clash values reports exactly those two deviations and renders exactly
  `2-0:BATTLE ARMY_COMPOSITION=standard_clash BOARD_LAYOUT=asymmetric_100`;
  adding a diagonal deviation appends its token **after** both.
- Overriding `BOARD_LAYOUT` on Skirmish to `standard_64` (its own resolved
  value) produces no deviation and re-renders as the bare id (canonicalization
  now covers the new flags too).
- `parseRuleFlagTokens` round-trips the Clash tag's tokens, and an unknown value
  for either new flag is still carried in `unrecognizedTokens` (it is **not** a
  rejection — Decision 9).
- `nonStandardRuleSentences` returns nothing for a Clash configuration (whose
  only deviations are game-defining) and still returns the diagonal sentences
  when a diagonal flag deviates; `RULE_CHOICES` still holds exactly the two
  diagonal choices.

Run the five repository checks. Existing record fixtures and the four
`doc/samples/` files must pass **unedited** — that is this step's central claim.

---

## Step 4 — The configuration carries the board and the army

Status: pending

The one large, mechanical, compiler-driven refactor of this story (Decision 1).
**No behaviour changes**: every configuration the app can build today still
resolves to its edition's own board and army, so every game plays, renders and
records exactly as before.

- **`configuration.ts`**: `RuleConfiguration` gains a resolved `BoardLayout` and
  a resolved `ArmyRoster`, both computed by `configureRules` by looking the
  resolved `BOARD_LAYOUT` / `ARMY_COMPOSITION` values up in `BOARD_LAYOUTS` /
  `ARMY_COMPOSITIONS`. Both are plain data — no functions, no `Map`s — so
  `PlayState` still serializes across `searchWorker.ts`'s boundary.
- **`edition.ts`**: **remove** the `boardLayout` and `army` fields from
  `Edition` and from all three edition constants. Keep `boardLayoutId`,
  `armyCompositionId`, `towerPlacement`, `status`, `EDITIONS`, `editionById`,
  `armyFitsBoard` and `combinationFits`. Leave `playableEditions()` alone for
  now (Step 5 removes it) — it reads only ids.
- **Migrate every compile error** to read the configuration instead. The
  affected non-test modules are: `movement.ts`, `outcome.ts`, `play.ts`,
  `gameState.ts` (both placement-validation checks, the army-size message, and
  `renderPositionBlock`), `readRecord.ts` (the `parseRecordFile` call — see
  Decision 8), `placementSession.ts`, `playSession.ts`, `playAnnouncement.ts`,
  `PlayBoard.tsx`, `ReviewScreen.tsx`, `gameNames.ts`, `HotSeatGame.tsx`.
  Update the doc comments that describe these fields as living on the edition.
- **`placementSession.ts`**: `newSession` takes a `RuleConfiguration` instead of
  an `Edition`, seeding both sides' `PlacementState` from the configuration's
  layout and army and from `configuration.edition.towerPlacement`. Document the
  tower-placement asymmetry there per Decision 2. `HotSeatGame.tsx`'s single
  call site passes the configuration it already holds.
- **`gameState.ts`**: `buildInitialGameState` validates both placements against
  `configuration`'s resolved layout id and roster (and still against
  `configuration.edition.towerPlacement`). Its error messages should name the
  board and the size the _configuration_ expects, not the edition's.
- Tests and fixtures throughout follow mechanically. **Do not change any
  expected record text, tag string or position block** — if one needs changing,
  the refactor is wrong. `edition.test.ts`'s assertions about the removed fields
  move to `configuration.test.ts` (asserting each standard configuration
  resolves its edition's board and army).

Do not touch `src/engine/**` or `src/encoding/eng-nn-1/**`; nothing there reads
these fields.

Depends on: Step 3 (the configuration must be able to resolve the two flags
before anything can read a board off it).

Verification: **automated** — the five repository checks, all clean, with **no
edit to any expected record output, tag string, position block, existing fixture
or `doc/samples/` file** anywhere in the suite (verify with `git diff --stat`
that no sample file is touched, and that `src/engine/` and `src/encoding/` are
untouched). Add a test asserting that no `Edition` object carries a resolved
board or roster any more and that a `RuleConfiguration` survives a JSON
round-trip with its layout and roster intact.

**Manual (Gate A)**, with a **restarted** `npm run dev`: play a short Battle
game and a short Skirmish game from the new-game screen through placement to a
real ending (capture a flag in one, agree a draw in the other). Confirm
placement, the tray, the board's size and lakes, movement, orthogonal and
diagonal attacks, the countdown warnings and the end-of-game panel all behave
exactly as before, and that the developer record dump reads `[Ruleset
"2-0:BATTLE"]` and `[Ruleset "2-1:SKIRMISH"]` respectively, with no extra
tokens. Import each file in `doc/samples/` and confirm each still reviews end to
end on the right board.

---

## Step 5 — The games catalog

Status: pending

Add `src/rules/primary/v2/games.ts`, per Decision 6. It holds:

- a `GameId` union — `"battle"`, `"skirmish"`, `"clash"`;
- one catalog entry per game naming its base `Edition` and its game-defining
  flag overrides (Battle and Skirmish override nothing; Clash is
  `BATTLE_EDITION` plus `BOARD_LAYOUT=asymmetric_100` and
  `ARMY_COMPOSITION=standard_clash`);
- a function building a game's standard `RuleConfiguration` from its entry, plus
  optional rule-choice overrides so the picker can layer the diagonal choices on
  top;
- the list of playable games, filtered by `combinationFits` as a floor (Decision 6) — the three designed pairings all pass it;
- `identifyGame(configuration): GameId | null`, matching on the resolved
  `(BOARD_LAYOUT, ARMY_COMPOSITION)` pair only.

Also **remove `playableEditions()`** from `edition.ts` and switch
`GameChoice.tsx`'s game list to the new catalog **only as far as needed to keep
it compiling** — the screen's copy, ordering and naming are Step 9's job, so a
minimal mechanical switch here (or keeping `playableEditions` until Step 9 if
that is genuinely cleaner) is acceptable; state which was done in the Notes.
Prefer removing it here: two games sharing an edition id make it actively
misleading.

Nothing about the player-visible screen changes in this step: whatever the
picker currently shows, it must still show, in the same order, with the same
words. Clash is reachable from code but not yet offered.

Depends on: Steps 3 and 4 (the catalog builds configurations, and a
configuration must resolve a board and an army).

Verification (**automated**): a new `games.test.ts` —

- each of the three games' standard configuration resolves the expected board
  and army (Battle 12 × 12 / 25, Skirmish 8 × 8 / 16, Clash 10 × 10 / 20) and
  the expected edition id;
- Battle's and Skirmish's configurations render bare edition tags; Clash's
  renders exactly `2-0:BATTLE ARMY_COMPOSITION=standard_clash
BOARD_LAYOUT=asymmetric_100`;
- `identifyGame` returns the right `GameId` for all three, returns `"skirmish"`
  for a configuration built on the superseded `2-0:SKIRMISH` edition, is
  unaffected by a deviating diagonal flag, and returns nothing for a
  hand-built configuration pairing `standard_battle` with `asymmetric_100`;
- that same pairing **passes** `combinationFits` (25 ≤ 30) yet is **not** in the
  playable list — the "fit test is the floor, not the rule" property;
- the playable list holds exactly the three games.

Run the five repository checks.

---

## Step 6 — Clash plays by the rules, on the new geometry

Status: pending

No production code is expected to change in this step: Steps 1–5 should already
make a Clash configuration fully playable through the existing parametric rule
engine. This step **proves** that by automated test, on exactly the features
that are new to this board, and fixes whatever it uncovers. If something needs a
production change, that change — and why — belongs in the step's Notes.

Cover, using a Clash configuration from `games.ts`:

- **Placement** (`placement.ts`): a fresh Clash `PlacementState` starts with 20
  pieces to place across 30 home squares; `isComplete` only at 20; a piece
  cannot be placed on a lake, off-board, or outside the side's own home rows
  (1–3 for White, 8–10 for Black); the buffer rows 4 and 7 are not placeable.
- **Tower placement**: `spacing_only` applies — two Towers may not touch, even
  diagonally — and **nothing more**: `homeSquaresFacingLane` returns nothing on
  this layout (the buffer rows guarantee it), so `squaresClosedToTowers` is
  empty and a Tower in row 3 or row 8 directly in front of the B–C, E–F or J
  lane is **legal**, unlike on Skirmish.
- **Auto-fill**: succeeds for a Clash roster (4 Towers in 30 squares) and
  produces a complete, Tower-legal army.
- **Movement and attacks** (`movement.ts`), on hand-built positions:
  - a piece cannot move onto or through a lake square in column A, D, G, H or I
    on rows 5–6;
  - the **1-wide J lane** behaves like any other lane — a piece may move through
    it from row 4 to row 7 in two plies and may make a two-square move along it;
  - the **3-wide G–I lake block** blocks a two-square move that would cross it
    and does not block anything a lane would not;
  - column A's edge-adjacent lake and column J's edge both refuse off-board
    moves, and the board's left edge (a lake at A5/A6) does not produce an
    off-by-one into column "@" or similar;
  - diagonal attacks work as on the other boards, including the story's
    inherited conclusion that the "diagonal squeeze" is unreachable here:
    because both lake rows share the identical column pattern, any diagonal
    whose two flanks are both lakes has a lake as its own source or destination,
    so it is refused before the flank question arises. Add a test pinning that
    conclusion on at least one such position (e.g. around the D and G blocks).
- **Outcome and a full game** (`outcome.ts`, `play.ts`): a flag capture on the
  Clash board ends the game with the right winner and reason, and `applyMove`
  accepts a legal sequence and rejects an illegal one on this geometry.

Depends on: Step 5 (a Clash configuration to test with).

Verification (**automated**): the new cases above live in the existing suites
(`placement.test.ts`, `movement.test.ts`, `outcome.test.ts`, `play.test.ts`),
each explicitly built on the Clash configuration; every pre-existing Battle and
Skirmish case must pass **unedited**. Run the five repository checks.

---

## Step 7 — Writing and reading a Clash record

Status: pending

Close the record loop for Clash end to end, through the real writer and the real
reader.

- Confirm (and test) that `buildInitialGameState` under a Clash configuration
  stamps `ruleset` as exactly the three-token tag, and that
  `renderPositionBlock` produces ten rows of ten cells with `XXX` at A/D/G/H/I
  on rows 5 and 6 and nowhere else.
- Confirm (and test) that `readRecord` on that record's text resolves a
  configuration whose resolved board is `asymmetric_100` and whose resolved army
  is `standard_clash`, reports no unrecognized tokens, and replays the whole
  move list.
- Add one hand-built checked-in sample record under `doc/samples/`, on the Clash
  board, containing at least one capture, and describe it in
  `doc/samples/README.md` — including, in one line, why its tag names Battle.
  Follow `2-1-skirmish-diagonal-attackable-all.txt`'s precedent for format.
  Note in the file's description that it was hand-built to match the writer's
  exact output (the picker cannot yet start a Clash game until Step 9).
- Add the **canonicalization** cases that pin story.md's byte-identical
  requirement from the reader's side: `2-0:BATTLE BOARD_LAYOUT=standard_144
ARMY_COMPOSITION=standard_battle` reads as the plain standard Battle
  configuration reporting no deviations, and the bare `2-0:BATTLE`,
  `2-1:SKIRMISH` and `2-0:SKIRMISH` tags read exactly as they do today.
- Add a case combining Clash with a deviating diagonal flag, proving token order
  and that the two kinds of flag compose.

This step covers only boards this app knows. Step 8 covers the board it does
not.

Depends on: Steps 4 and 6 (the reader must resolve the board from the
configuration, and the position block must be right).

Verification (**automated**): the cases above in `gameState.test.ts` and
`readRecord.test.ts`, plus a test that reads the new sample file **from disk**
and replays it. Every existing sample and fixture passes unedited. Run the five
repository checks.

---

## Step 8 — Reading a record on a board this app doesn't know

Status: pending

Implement Decisions 8 and 9: a record whose `Ruleset` tag names a `BOARD_LAYOUT`
value this app has no geometry for must **review normally**, on a board derived
from its own position block. **This step adds no rejection of any kind** — no new
`ReadRecordError` case, no new `RecordFileError` case, no new `PositionBlockError`
case, and no new wording in `reviewText.ts` (which words rejections only, and
gains none here). Confirm as part of the step that `readRecord.ts`'s existing
`unknownRuleset` handling is untouched and still the only refusal.

**Precedence (make it explicit in the code's comments):**

- Known `BOARD_LAYOUT` (including an absent token, which resolves to the
  edition's own value) → **the tag wins**: parse and validate the position block
  against that geometry, exactly as today. A disagreeing block is caught by the
  existing `PositionBlockError` machinery with its existing wording. Check that
  wording reads correctly for a 10 × 10 board and fix it if it does not (note
  that the "wrong row count" sentence currently builds its size phrase from the
  row count twice — harmless while every board is square, but worth a comment).
- Unresolvable `BOARD_LAYOUT` token → **derive from the block**, because there is
  no known geometry to validate against.

**The derivation.** Put it in `src/rules/primary/v2/gameState.ts`, beside
`parsePositionBlock` — it is position-block knowledge, and that module already
owns the block's format. It takes the block's text and returns a `BoardLayout`:

- `rowCount` = the number of non-blank lines in the block;
- `columnCount` = the number of cells on the first line;
- `lakeRows` = every row (in the block's own bottom-up row numbering, matching
  `renderPositionBlock`'s top-is-highest-row convention) carrying at least one
  `XXX` cell;
- `lakeColumnIndices` = every column index carrying at least one `XXX` cell.

Make the derivation **total** — it never fails and returns no error. Ragged
rows, an empty block, an unrecognized cell and every other malformed case are
then caught by the ordinary `parsePositionBlock` pass that immediately follows,
using the derived layout as its expectation. "Derive, then validate as usual" is
the whole design: no second validation path, no new error kinds.

**`homeRowsPerSide` and `hasBuffer` on a derived layout: `0` and `false`.**
Neither is recoverable from a position block (the companion project's changelog
says so, and adds that a review-only viewer does not need the home depth), and
**no code path a review exercises reads either field**. Verified against the
code, not assumed:

| Review-path code                      | What it reads from the layout                                             |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `readRecord.ts` → `parseRecordFile`   | passes the layout straight through                                        |
| `parsePositionBlock` (`gameState.ts`) | `rowCount`, `columnCount`, `isLake`                                       |
| `notation.ts` move parsing            | nothing — it is layout-free                                               |
| `replay.ts`                           | nothing — it takes no layout at all                                       |
| `ReviewScreen.tsx` → `FullBoard.tsx`  | `fullBoardRows`/`visibleColumns` (`rowCount`, `columnCount`) and `isLake` |
| `reviewText.ts` / `MoveList.tsx`      | nothing                                                                   |

The only readers of `homeRowsPerSide`/`hasBuffer` anywhere in `src/` are
`boardView.visibleRows` (the **placement** board only), `boardLayout.rowRegion`,
`boardLayout.homeZoneSize` and `board.regionOf` — none reachable from a review.
`0`/`false` are chosen deliberately over plausible-looking guesses: they make
`homeZoneSize` zero and `homeSquares` empty, so any future code that wrongly
reaches for them on a derived layout produces an obviously empty answer rather
than a quietly wrong one. Document this at the derivation, and pin it with the
tests below.

**The derived layout's `id`.** `BoardLayout.id` is typed as the catalog's
`BoardLayoutId`, which a derived layout by definition is not. Widen the field's
type with one extra, clearly-named literal (e.g. `"derived_from_record"`) that
is **not** a `BoardLayoutId` and therefore can never be confused with a catalog
value or a flag value. `BOARD_LAYOUTS` stays exhaustive over `BoardLayoutId`.
Before doing this, confirm nothing switches exhaustively on `layout.id` (today's
only uses are equality comparisons in `gameState.ts`'s placement validation and
in tests, neither on the review path).

**Threading the derived layout to the screen.** `configureRules` remains the
only constructor of a `RuleConfiguration` and its resolved board still comes from
the flag (Decision 1) — a derived layout must never be smuggled into it. Instead,
`readRecord`'s parsed result gains an explicit field carrying **the geometry the
record was actually read on and must be rendered on**: the configuration's own
layout for every tag this app understands, and the derived layout otherwise.
Thread it through `ImportScreen.tsx` → `App.tsx` → `ReviewScreen.tsx`, which
renders `FullBoard` from that field instead of from the configuration. Because
`parseRecordFile` owns the chunking that isolates the position block, it is the
natural place to perform the derivation on the caller's instruction and report
back which layout it used; the exact shape of that is the implementer's call.

**What the reviewer is told.** This is a note, not a warning, and must not read
as an error. Add one sentence for this case beside `unrecognizedRuleSentence` in
`src/board/ruleChoices.ts` — the established home for review-screen copy about a
token this app cannot resolve — quoting the token verbatim as that function
already does. Draft copy (**revisable at Step 10's manual gate**):

> This game was played on a board this app doesn't know ("BOARD_LAYOUT=huge_400"),
> so the board below is drawn from the record's own starting position.

It replaces, rather than adds to, the generic unrecognized-token sentence for
that same token, so a reviewer is not told twice. Per Decision 11, the
game-name line is **omitted** for any record carrying an unresolved token, so
such a record is never mislabelled "Battle".

_(Note on placement: the coordinator's brief named `reviewText.ts` as this
sentence's home. `reviewText.ts` words structured **rejections**, and this story
adds none; the review screen's copy about unresolved tag tokens already lives in
`ruleChoices.ts`. Putting it there keeps one voice and one home. Flagged for the
owner rather than decided silently.)_

Depends on: Step 7 (the reading path must already work for a valid Clash
record).

Verification (**automated**): extend `readRecord.test.ts`, `gameState.test.ts`
and `ruleChoices.test.ts` —

- **The headline case:** a record tagged `2-0:BATTLE BOARD_LAYOUT=huge_400`
  whose position block is a board this app has never seen (use a size and lake
  pattern matching none of the three catalog layouts — e.g. 14 × 14 with lakes in
  novel columns) **parses and replays end to end**, is not rejected, reports that
  token as unrecognized, and comes back with a derived layout whose row count,
  column count and lake squares match the block exactly.
- The derived layout carries `homeRowsPerSide === 0` and `hasBuffer === false`,
  and the record still replays completely — pinning that no review path reads
  either field.
- A derived layout with no `XXX` cells at all yields a lakeless board and still
  replays.
- Derivation is total: a ragged or empty block is still reported through the
  ordinary `PositionBlockError` path, with no new error kind.
- For **every** record whose tag this app fully understands — including all four
  existing `doc/samples/` files and Step 7's Clash sample — the layout reported
  by `readRecord` is **identical** to `configuration.boardLayout`. This is the
  regression guard against the derived path ever leaking into the normal one.
- A record tagged with the Clash board but carrying a 12 × 12 position block is
  still rejected by the position-block error naming the expected size, and the
  same for a right-sized block whose lakes sit in Battle's positions (the tag
  wins for a **known** board — Decision 8).
- A record tagged `2-0:BATTLE ARMY_COMPOSITION=something_else` reviews end to end
  and reports that token as unrecognized; an unknown flag id, a malformed token
  and a repeated token all still review.
- An unknown **edition id** still rejects exactly as today, message unchanged,
  and no new `ReadRecordError` / `RecordFileError` case exists (assert the error
  unions are unchanged, or note it in the Notes if a type-level assertion is
  impractical).
- The new sentence quotes its token verbatim and does not read as a refusal (no
  "can't be reviewed" phrasing).

Run the five repository checks.

---

## Step 9 — The new-game screen offers three games

Status: pending

Make Clash reachable and correctly named, per Decisions 6, 7 and 10.

- **`src/board/gameNames.ts`**: an exhaustive per-`GameId` name record
  ("Battle", "Skirmish", "Clash"); a `RuleConfiguration`-taking name lookup
  returning the game's name or nothing when it matches no catalog game;
  `boardSizeDescription` taking a `RuleConfiguration` and reading its resolved
  layout; `defaultGameId` taking the last-played `RuleConfiguration` and
  returning a `GameId`, still defaulting to Skirmish when nothing has been
  played. Update `gameNames.test.ts` accordingly.
- **`src/board/GameChoice.tsx`**: `GAME_DETAIL` becomes an exhaustive
  `Record<GameId, string>`; `gameOrderRank` becomes a `GameId` switch ordering
  **Skirmish (0), Clash (1), Battle (2)** — by size, per story.md's Policy; the
  button list comes from the games catalog's playable list; the confirmed
  configuration is built by combining the selected game's entry with the
  player's diagonal rule-choice overrides. The two diagonal choices are offered
  identically for all three games and are unaffected by which is selected. No
  form controls, no "experimental"/"proposed"/"pre-release" framing anywhere.
- **`src/board/HotSeatGame.tsx`**: the "You chose …" live-region announcement
  uses the new name and size functions. Its shape is unchanged.
- Draft copy for Clash's description (**the owner may revise this at this step's
  manual gate**):

  > A mid-size game: a 10x10 board with a 20-piece army. Its lakes are uneven —
  > one sits hard against the left edge, with no lane beside it, and the widest
  > blocks three columns — so the two halves of the board don't mirror each
  > other.

  Skirmish's and Battle's descriptions are unchanged.

Depends on: Steps 5, 6 and 7 (the catalog, a game that actually plays, and a
record that actually writes).

Verification: **automated** — the five repository checks, plus `gameNames.test.ts`
covering the name lookup for all three games and for a superseded-Skirmish
configuration, `boardSizeDescription` for all three boards (confirm Clash reads
"a 10x10 board", with the correct article), and `defaultGameId` returning the
game just played and Skirmish for `null`. This repo has no component-test
harness, so the screen itself is covered by the gates below.

**Manual (Gates B, C and G)**, with a **restarted** `npm run dev`:

- **Gate G.** The new-game screen offers exactly three games, in the order
  Skirmish, Clash, Battle, each described in plain language with no
  experimental framing and no flag identifier or value token anywhere on screen.
  The two diagonal-attack choices are offered for Clash exactly as for the other
  two. Play (or abandon) a Clash game, press "New game", and confirm Clash is
  pre-selected along with the diagonal values just used; reload the page and
  confirm the screen returns to Skirmish and the standard diagonal values.
- **Gate B.** Starting Clash shows a 10 × 10 board with columns A–J and rows
  1–10; lakes at A, D, G, H and I on rows 5 and 6 **only**; empty buffer rows at
  4 and 7; home zones of rows 1–3 and 8–10. The left edge is lake; the right
  edge (column J) is a 1-wide lane. Check both players' turns and the
  flip-board toggle: the asymmetry must flip with the board, and column labels
  must stay correct in both orientations.
- **Gate C.** The tray holds 20 pieces — three each of ranks 1–5, four Towers,
  one Flag, **no Militia** — and Confirm becomes available only when all 20 are
  down, in 20 of the 30 home squares.

---

## Step 10 — The reviewer says which game it was

Status: pending

Per Decision 11:

- **`src/review/ReviewScreen.tsx`**: add one short line to the existing
  `.review-status` block naming the record's game and its board — draft copy
  (**revisable at this step's manual gate**): `This is a Clash game, on a 10x10
board.` Shown for every record whose `Ruleset` tag was **fully understood**
  (no unresolved tokens) **and** whose configuration matches a catalog game;
  omitted otherwise. It sits above the existing rules and result lines. The
  existing diagonal-flag sentences, the unrecognized-token sentences and Step
  8's derived-board sentence are unchanged and still appear where they do today.
- **`src/board/GameRecord.tsx`**: add the same game name to the developer hint
  line, immediately beside the `Ruleset` tag it already prints (peer review #9
  of story 00000027 established that the tag and its plain-language meaning
  belong together). A live `PlayState` is always built from a catalog game, so
  the "omitted" case cannot arise there.

Do not put any of this in `ruleChoices.ts`'s deviation summary — Decision 5 keeps
game-defining flags out of it deliberately, and "Battle with two unusual
settings" is exactly what story.md forbids.

Depends on: Steps 8 and 9 (a Clash record must read correctly, and the game
naming must exist).

Verification: **automated** — the five repository checks stay clean; add a test
for whatever pure helper decides whether the game line is shown, covering all
three games, a superseded-Skirmish record, and a record carrying an unresolved
token (line omitted).

**Manual (Gate F)**, with a **restarted** `npm run dev`: play a Clash game
through to a real ending, copy the developer record dump into a file, and
confirm its `Ruleset` tag reads exactly `2-0:BATTLE
ARMY_COMPOSITION=standard_clash BOARD_LAYOUT=asymmetric_100`. Import that file
in the reviewer: it replays end to end on the 10 × 10 board with the right
lakes, and is identified as **Clash** in plain language. Import the new
`doc/samples/` Clash file and confirm the same. Import an existing Battle and an
existing Skirmish sample and confirm each is identified as Battle / Skirmish and
that nothing else about those reviews changed. Then:

- hand-edit a copy of the Clash sample's tag to name an unknown board
  (`BOARD_LAYOUT=huge_400`, leaving its position block alone) and confirm it
  **still reviews end to end**, drawn on the board from its own position block,
  with the plain note saying the app doesn't know that board — **not** an error,
  and with **no** game-name line;
- hand-edit another copy to name an unknown army (`ARMY_COMPOSITION=huge_army`)
  and confirm it **still reviews**, saying the app doesn't recognize that
  setting, again with no game-name line;
- hand-edit a third copy to name an unknown **edition id** and confirm it is
  still refused, with today's unchanged message.

---

## Step 11 — A full Clash game, accessibility, and README

Status: pending

The finishing pass, last so the copy describes finished behaviour and the
accessibility work exercises the whole feature.

- **`README.md`**: it currently says "There are two games to choose from" and
  describes only Skirmish and Battle by name and size; its "Set up a game with a
  friend" bullet names the two games; and its "Status" note says "pick Skirmish
  or Battle". Update all three for three games, in the same plain, non-technical
  voice, without restating the rules and without naming any flag identifier or
  value. Clash is a proposed combination, so — following story 00000027's
  precedent — the README (unlike the UI) may say plainly that Clash's board and
  army aren't official rules yet and link to the companion repository's
  `proposed-variants.md`. The `/update-readme` command may be used.
- **Copy sweep**: check every surface this story touched (`GameChoice.tsx`,
  `HotSeatGame.tsx`, `ReviewScreen.tsx`, `GameRecord.tsx`, `gameNames.ts`,
  `ruleChoices.ts`, `reviewText.ts`) for player-facing strings leaking a flag
  id, a value token, an edition id, "edition", or the word "ply". Step 8's
  derived-board sentence deliberately quotes a token verbatim, exactly as
  `unrecognizedRuleSentence` already does; that is the one sanctioned exception.
- **Accessibility pass**: review the Clash path for keyboard and screen-reader
  equivalence, paying particular attention to what the asymmetry makes newly
  relevant — square announcements naming a lake at a board edge, the 1-wide J
  lane, orientation announcements under the flip-board toggle, and the grid's
  arrow-key navigation across a row that begins with a lake. Fix what is broken;
  if nothing is, record that as a reviewed finding in the Notes rather than
  silently skipping it.

Depends on: Steps 9 and 10 (the finished screens).

Verification: **automated** — the five repository checks, all clean.

**Manual (Gates D, E and H, plus re-checks of A and G)**, with a **restarted**
`npm run dev` and a screen reader running:

- **Gate D.** On Clash, the ordinary Tower spacing rule applies and nothing
  more: two Towers may not touch (diagonals included), and a Tower placed in row
  3 or row 8 directly in front of the B–C, E–F **or J** lane is **accepted** —
  unlike on Skirmish. Auto-fill also produces a legal 20-piece army.
- **Gate E.** Play a full Clash game end to end and confirm the rules behave as
  written on the new geometry: movement blocked by lakes and by both edges,
  orthogonal and diagonal attacks, the formation bonus, and a win by Flag
  capture. Specifically exercise the 1-wide J lane and the 3-wide G–I lake block
  and confirm they behave like any other lane and lake. Confirm a draw is
  reachable too (offer and accept one in a second short game).
- **Gate H.** With the mouse put away, choose Clash, place a full 20-piece army,
  and play through to a Flag capture by keyboard alone. Every square, lake and
  board edge is announced correctly, the board's asymmetry is not misdescribed,
  nothing is announced twice from two live regions, and focus never lands on
  `<body>`.
- **Gate A re-check.** A Battle game and a Skirmish game still place, play and
  end exactly as before, with bare `2-0:BATTLE` and `2-1:SKIRMISH` tags.
- **Gate G re-check.** Re-read the three game descriptions and the README's
  changed passages end to end for accuracy and tone.
