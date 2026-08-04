# Implementation Plan — Story 00000027: Add diagonal flags

This plan makes the app the testing ground for two **proposed** rule flags from
the companion project — `DIAGONAL_ATTACKABLE` and `DIAGONAL_ATTACK_PATH` — as
player-selectable options on the hot-seat new-game screen, for Battle and
Skirmish alike, recorded in the `Ruleset` tag and honoured on replay.

Read `story.md` in this folder in full before starting any step. Its
**Policy (fixed by the owner)**, **In scope / Out of scope** and
**Design decisions & constraints** sections are settled and are not
re-litigated here. This plan resolves the story's
**"Open items to resolve at plan time"** — the resolutions are in
"Decisions resolved at plan time" below, and every step is written assuming
them.

---

## Grounding facts (read once — applies to every step)

The single source of truth for the rules is `doc/ruleset/rules.md` in the
companion [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
repository. The two flags in this story are **not** in `rules.md` Appendix A:
they live in that repository's `doc/ruleset/proposed-variants.md` sandbox, and
neither is implemented there. Fetch the sources if a step needs to re-check a
detail:

- `gh api repos/phil-hutchinson/capture-the-flag/contents/doc/ruleset/proposed-variants.md --jq '.content' | base64 -d`
- `gh api repos/phil-hutchinson/capture-the-flag/contents/doc/ruleset/technical-notes.md --jq '.content' | base64 -d`
- same for `doc/ruleset/rules.md`.

### The two flags

| Flag id                | Values                  | Default        | What it governs                                           |
| ---------------------- | ----------------------- | -------------- | --------------------------------------------------------- |
| `DIAGONAL_ATTACKABLE`  | `movable_only` \| `all` | `movable_only` | Which enemy pieces are legal targets of a diagonal attack |
| `DIAGONAL_ATTACK_PATH` | `always` \| `open_path` | `always`       | Whether a diagonal attack needs a free flanking square    |

- **`DIAGONAL_ATTACKABLE=all`** makes a Tower or the Flag a legal diagonal
  target. Combat resolution is reached unchanged: a Tower defending is always a
  mutual loss (a partial sacrifice, from any direction), a Flag defending always
  falls, rank/equal-rank/formation-bonus rules are untouched. `combat.ts`
  already handles Tower and Flag defenders with no notion of direction, and
  `outcome.ts` already detects a Flag capture by the Flag's absence from the
  board — so **no change is needed in either module**.
- **`DIAGONAL_ATTACK_PATH=open_path`** additionally requires that **at least
  one** of the two flanking squares be unoccupied by a piece of either side
  **and** not a lake. For an attack from `(c, r)` to `(c±1, r±1)` the flanks are
  `(c±1, r)` and `(c, r±1)` — derived geometrically, never enumerated per board.
  Note both flanks are **always on-board** whenever origin and target are (each
  flank reuses one coordinate from each), so no off-board case can arise.
  `movement.ts`'s existing private `isEmpty` helper is exactly the "unoccupied
  and not a lake" predicate this needs.
- The existing check that the **target square itself** is not a lake must
  survive unchanged. That is what keeps the "skirt" (a diagonal past a single
  lake corner, one flank a lake and the other open) legal under `open_path`; the
  "squeeze" (both flanks lakes) is unreachable on both published boards.
- The two flags **compose** and neither reads the other: `all` widens the target
  set, `open_path` narrows the legal paths.
- **Both flags default to today's behaviour**, so a game on the standard values
  plays and records exactly as it does today. Existing record fixtures must keep
  passing unchanged — that is the cheapest honest evidence for the claim.

### How a configuration is stamped (companion `technical-notes.md`)

- A configuration is an **edition id plus the flags that deviate from it**.
- The `Ruleset` tag is the edition id followed by one `FLAG=value` token per
  **deviating** flag, space separated, ordered **alphabetically by flag id**
  (`DIAGONAL_ATTACKABLE` before `DIAGONAL_ATTACK_PATH`).
- A flag at its resolved value is **omitted**. An absent flag means the
  edition's value, falling back to the flag's own default for an edition
  published before the flag existed — which is the case for both flags and all
  three registered editions here.
- A configuration is **canonicalized when read**: a stamp naming a flag at the
  value it would resolve to anyway means the same as one omitting it.
- On the standard values the tag is **byte-identical** to what the app writes
  today (`2-0:BATTLE`, `2-1:SKIRMISH`, `2-0:SKIRMISH`).

### Where the relevant code is today

- `src/rules/primary/v2/edition.ts` — the edition registry. `EditionId` is the
  three-value union `2-0:BATTLE` | `2-1:SKIRMISH` | `2-0:SKIRMISH`; an `Edition`
  carries fixed `boardLayoutId`/`armyCompositionId`/`towerPlacement`/`status`
  plus the resolved `boardLayout`/`army`. There is **no notion of a deviation**.
  Exports `BATTLE_EDITION`, `SKIRMISH_EDITION`, `SUPERSEDED_SKIRMISH_EDITION`,
  `EDITIONS`, `editionById`, `playableEditions`.
- `src/rules/primary/v2/movement.ts` — `legalDestinations`, `legalAttacks`,
  `hasAnyLegalPly`, each taking `layout: BoardLayout = BATTLE_LAYOUT`. **The
  diagonal loop at the end of `legalAttacks` (currently ~lines 256–269) is the
  single site both flags act on.** Its condition today is: target on-board, not
  a lake, occupied, enemy-owned, and `!isImmobile(targetOccupant.pieceType)`.
- `src/rules/primary/v2/outcome.ts` — `computeOutcome(board, activeSide,
inactivityCounter, layout = BATTLE_LAYOUT)`, which calls `hasAnyLegalPly` for
  the §5.2 "no legal move" ending.
- `src/rules/primary/v2/gameState.ts` — `InitialGameState { ruleset, edition,
board }`, `buildInitialGameState(white, black, edition)`,
  `renderPositionBlock`, `parsePositionBlock`, and the `RULESET_TAG` constant.
- `src/rules/primary/v2/play.ts` — `PlayState { ruleset, edition, ... }`,
  `startPlay`, `applyMove`, `renderGameRecord` (writes `[Ruleset "…"]` from
  `state.ruleset`).
- `src/rules/primary/v2/recordFile.ts` — header/position/move parsing and the
  `RecordFileError` union. It carries `tags.ruleset` through as a **raw string**
  and never validates it, so it needs no change.
- `src/rules/primary/v2/replay.ts` — deliberately rule-blind; it applies
  recorded moves without consulting any rule. It needs no change.
- `src/rules/readRecord.ts` — version dispatch. Matches the **whole** `Ruleset`
  tag value against `EditionId` (line ~116), so any tag carrying a flag token is
  rejected as `unknownRuleset` today. Returns `{ record, edition }`.
- `src/review/reviewText.ts` — the one place structured rejections become
  sentences; every switch ends in `default: return error satisfies never;`, so a
  new error kind fails to compile until it is worded.
- `src/board/playSession.ts`, `src/board/playAnnouncement.ts` — the live callers
  of `legalAttacks`/`legalDestinations`, both threading
  `play.edition.boardLayout`.
- `src/board/GameChoice.tsx` — the new-game screen: game buttons with
  `aria-pressed`, a description paragraph for the selected game, one
  "Play <Game>" confirm button. `src/board/gameNames.ts` holds its wording and
  `defaultGameId(lastPlayed)`.
- `src/board/HotSeatGame.tsx` — holds the chosen `Edition`, seeds placement,
  builds the initial game state, reports the choice via `onGameStarted`.
  `src/App.tsx` holds `lastPlayedEdition` (in memory, never persisted) and
  passes it back as `lastPlayed`.
- `src/board/GameRecord.tsx` — the developer-facing `<details>` record dump on
  the hot-seat screen; prints `play.ruleset` in its hint line.
- `src/review/ImportScreen.tsx` → `src/App.tsx` → `src/review/ReviewScreen.tsx`
  — the `edition` from `readRecord` is threaded through to drive the review
  board's layout.
- `doc/samples/2-0-skirmish-tower-in-lane.txt` — the precedent for a checked-in
  sample record.

### Out of bounds for every step

- `src/engine/**` and `src/encoding/eng-nn-1/**` must **not** be edited, with
  **one exception fixed by the owner at the plan gate**: `decoder.ts:145` calls
  `legalAttacks(board, origin)` and gains an explicit third argument (the
  standard Battle configuration). That is the only permitted edit under these
  paths, it is one line, and it must not change that call's behaviour. Computer
  play stays disabled and everything else there is untouched.
- No new edition, and no change to `2-0:BATTLE`, `2-1:SKIRMISH` or
  `2-0:SKIRMISH`.
- No change to placement, movement (`legalDestinations`), orthogonal attacks,
  combat resolution, the formation bonus, or the notation.
- No new ruleset version folder — everything stays in `src/rules/primary/v2/`.
- `src/board/EngineGame.tsx` is not mounted anywhere but must keep compiling; a
  mechanical constant swap there is expected and allowed.

---

## Decisions resolved at plan time

1. **The configuration model.** Two new modules in `src/rules/primary/v2/`:
   - **`ruleFlags.ts`** — the flag catalog and the **only** place the two flag
     identifiers and their value strings are spelled (story.md: a rename must be
     a small edit). It defines the flag-id union, each flag's permitted values
     and default, a resolved-values type covering both flags, and a standard
     (all-defaults) value set.
   - **`configuration.ts`** — `RuleConfiguration`: an `Edition` plus a
     **fully resolved** value for every flag. It is constructed only through
     this module's constructors, which resolve every flag before storing it, so
     a non-canonical configuration is unrepresentable. **Deviations are
     derived**, not stored: a query returns the flag ids whose resolved value
     differs from the edition's own resolved value, alphabetically ordered.
     This satisfies both directions story.md's "deviating flags are what the
     model stores" bullet cares about — the stamp is written from the derived
     deviation list (so a flag at its resolved value is omitted), and a stamp
     that redundantly names a resolved value is absorbed at construction (so
     canonicalization is free). Exports standard configurations for Battle and
     Skirmish so fixtures have one spelling.
2. **Flag resolution keeps `Edition` unchanged.** Neither published edition
   states a value for either flag, so resolution is "the edition's value if it
   has one, otherwise the flag's default" — which, today, always yields the
   default. Do **not** add flag fields to the three registered editions and do
   not model these flags the way `towerPlacement` is modelled (that is a fixed,
   per-edition field of a graduated Appendix A variant). Put the resolution rule
   in one documented function in `configuration.ts`, with a comment naming the
   extension point for the day an edition does state a value.
3. **How the configuration reaches `legalAttacks`.** The third parameter's
   **type** changes from `BoardLayout` to `RuleConfiguration` on `legalAttacks`
   and `hasAnyLegalPly`, and likewise `computeOutcome`'s fourth parameter.
   Changing the type (rather than adding a parameter) is deliberate: every
   existing call site that passes a layout becomes a **compile error**, so the
   compiler enumerates exactly the paths that must be threaded, which is the
   drift story.md warns about. `hasAnyLegalPly` and `computeOutcome` take the
   parameter as **required** (their only callers are live rule code).
   `legalAttacks` takes the parameter as **required** too — **owner decision at
   the plan gate**: rather than keeping a default for the sake of the single
   two-argument caller, `decoder.ts:145` gains an explicit standard-Battle
   argument and the default parameter disappears entirely. story.md names the
   default-parameter pattern as precisely how a flag comes to be read in one
   path and ignored in another, and one line in `decoder.ts` closes it. No rule
   function that reads a flag may have a defaulted configuration parameter.
   `legalDestinations`, `resolveCombat` and everything in
   `placement.ts` keep taking a `BoardLayout`: neither flag touches them.
4. **Game-state artifacts carry the configuration in place of the edition.**
   `InitialGameState` and `PlayState` replace their `edition: Edition` field
   with `configuration: RuleConfiguration` (the edition is reachable as
   `configuration.edition`). Both stay plain and JSON-serializable — `PlayState`
   crosses a worker boundary in `src/engine/searchWorker.ts`, so no functions or
   `Map`s may be introduced. `ruleset` remains a `string` and becomes the
   rendered stamp.
5. **Tag rendering and parsing.** Rendering lives in `configuration.ts` and is
   used by `buildInitialGameState` to set `ruleset` (so `renderGameRecord` needs
   no change). Parsing is split by layer: `readRecord.ts` — the version-dispatch
   entry point — splits the tag value on whitespace and treats the **first**
   token as the edition id (an unrecognized one keeps today's `unknownRuleset`
   rejection, message unchanged), then hands the remaining tokens to
   `configuration.ts` to build a canonical configuration or return a structured
   error. Flag vocabulary therefore stays inside the major-2 folder while
   dispatch stays in `readRecord.ts`, matching its "a future ruleset version adds
   a case here" contract.
6. **New rejection cases, each naming the offending token.** A flag token that
   is not `NAME=value`, an unknown flag id, an unknown value for a known flag,
   and the same flag id given twice are all rejections, each carrying the
   verbatim token text. They surface as one new `ReadRecordError` case wrapping
   a structured configuration error, worded in `reviewText.ts` (whose exhaustive
   switches will refuse to compile until they are). Token matching is
   **case-sensitive** and exact — the writer only ever emits the canonical
   spelling, and a near-miss is more useful reported than silently accepted.
7. **Player-facing wording.** A new `src/board/ruleChoices.ts` is the single
   home for the two choices' plain-language copy: a short heading per choice, a
   short label per value, a one-sentence description per value, and a summary
   helper that turns a `RuleConfiguration` into the sentences describing what is
   non-standard about it (or nothing, when it is standard). Flag ids and value
   tokens never appear in it. ~~**Each choice names its standard value as the
   standard one** (e.g. a "(standard)" suffix on that option's label), so a
   player can tell what deviates from the official game without jargon.~~
   **Superseded by an owner decision at Step 8's manual gate: no value is
   marked as the standard one.** Both flags are pre-release proposals, and
   neither value is to be presented as preferred over the other. `isStandard`
   survives as structure (it orders the options and derives the deviation
   sentences) but never reaches a player as a recommendation.
   **Owner decision at the plan gate: the word is "diagonal", not
   "corner-to-corner".** `rules.md` §4.3 and its glossary are themselves written
   for players and say "diagonal", so a player who follows the link to the
   rulebook meets the same word. This makes README.md's two existing
   "corner-to-corner" mentions (lines 29 and 69) inconsistent with the app, so
   Step 11 changes them to "diagonal" as well — that widening is intended, not
   scope creep. Proposed copy (the owner may adjust it at the Step 8 manual
   gate). **The owner revised this copy at that gate; the wording below is
   what shipped**, and `src/board/ruleChoices.ts` is its single home:
   - Section heading: **Diagonal attacks**
   - Choice 1 — _What can be attacked diagonally_: **"Ranked pieces only"** —
     "Ranked (numbered) pieces can be attacked diagonally. Towers and the flag
     cannot." / **"Any piece, flag/towers included"** — "A piece can strike any
     enemy standing diagonally next to it, towers and the flag included — so
     the flag can be captured from a diagonal."
   - Choice 2 — _Diagonal attack requires open square_: **"No open square
     required"** — "A piece can always attack an eligible enemy diagonally." /
     **"Open square required"** — "A diagonal attack can only be made if there
     is a common open square (no friendly or hostile piece, no lake) adjacent
     to both pieces."
8. **How the new-game screen accommodates the choices.** Keep its current
   shape — game buttons, the selected game's description, one "Play <Game>"
   confirm button — and add **one** section between the description and the
   confirm button holding both choices, each rendered as the same
   `aria-pressed` two-button group the game choice already uses, with the
   selected option's one-sentence description beneath it. No form controls, no
   "settings" framing, no per-game variation: both choices are offered
   identically for Battle and Skirmish, and switching game never changes them.
9. **Session stickiness.** `App.tsx`'s in-memory `lastPlayedEdition` becomes the
   last `RuleConfiguration` played, and `GameChoice` pre-selects both the game
   and the two flag values from it, exactly as it pre-selects the game today.
   Nothing is persisted — a reload starts on the standard values. Keep
   `gameNames.ts`'s `defaultGameId` behaviour (Skirmish when nothing has been
   played) intact.
10. **How a reviewed record's flags are surfaced.** `ReviewScreen.tsx` shows a
    short plain-language line naming the non-standard rules the record was
    played under, from the same `ruleChoices.ts` summary, and shows **nothing**
    when the record is standard (so today's screen is unchanged for every
    existing record). The developer-facing `GameRecord.tsx` hint line gets the
    same summary alongside the `Ruleset` tag it already prints — one call, and
    it keeps the two record surfaces consistent. The hot-seat _play_ screen gets
    no new player-facing rules banner (out of scope; the player chose the rules
    two screens earlier, and the choice is announced then).
11. **Test fixtures.** Per-flag and combination coverage in `movement.test.ts`;
    a "no legal move" case in `outcome.test.ts` proving the configuration
    reaches `hasAnyLegalPly`; an `applyMove` case in `play.test.ts` for a
    diagonal Flag capture ending the game; round-trip and rejection coverage in
    `readRecord.test.ts` including a **canonicalization** case (a stamp naming a
    flag at its resolved value must read as the standard configuration); and
    three new hand-built sample records in `doc/samples/` — one per non-standard
    configuration (`all`, `open_path`, both). Existing record fixtures must not
    be edited: their continuing to pass is the evidence the default path is
    untouched.
12. **README.** It needs updating. Its "Move, attack, and capture" bullet
    currently states flatly that "towers and the flag can't be attacked that
    way, so the flag must always be taken head-on" — true only on the standard
    value now — and its "Set up a game with a friend" bullet describes the
    new-game screen, which now offers two more choices.

---

## Step 1 — The flag catalog and the rule configuration model

Status: committed

Notes: Added `src/rules/primary/v2/ruleFlags.ts` (the `RULE_FLAG_CATALOG`
table, `RuleFlagId`/`RuleFlagValue`/`ResolvedRuleFlags` types all derived from
it, and `RULE_FLAG_IDS` in alphabetical order) and
`src/rules/primary/v2/configuration.ts` (`RuleConfiguration`, the
`resolvedEditionValue` resolution rule with its extension-point comment for
Decision 2, the sole constructor `configureRules`, the derived
`deviatingFlags`/`isStandardConfiguration` queries, and the exported
`STANDARD_BATTLE_CONFIGURATION`/`STANDARD_SKIRMISH_CONFIGURATION`
constants), plus `configuration.test.ts` covering the catalog and every
scenario the step's verification lists (including a JSON round-trip case).
No deviation from the plan: neither module is consumed elsewhere yet, and no
existing file was touched. `npm run typecheck`, `npm run lint`, `npm test`
(638 tests, all passing) and `npm run format:check` are all clean.

Add `src/rules/primary/v2/ruleFlags.ts` and
`src/rules/primary/v2/configuration.ts`, per Decisions 1 and 2. Nothing consumes
them yet — this step introduces vocabulary only.

`ruleFlags.ts` holds the two flag identifiers, each flag's permitted values and
its default, and the resolved-values shape covering both flags, in one table
that is the **only** place those strings appear. Structure it so a third flag is
a table entry, not a new shape.

`configuration.ts` holds `RuleConfiguration` (an `Edition` plus a fully resolved
value for every flag), the resolution rule (the edition's value where it has
one — none do today — otherwise the flag's default), constructors that build a
configuration from an edition plus zero or more chosen values, a derived
"which flags deviate" query returning flag ids in alphabetical order, and
exported standard configurations for Battle and Skirmish for fixtures to use.
Do not add tag rendering or parsing here yet (Step 2).

Why it comes here: every later step needs the configuration type to exist. It
touches no existing module, so it is a safe first commit.

How to verify (automated): a new `configuration.test.ts` asserting — each flag's
default is `movable_only` / `always`; a standard configuration for each of the
three registered editions resolves both flags to their defaults and reports **no**
deviations; choosing a non-default value produces exactly that deviation and
leaves the other flag alone; choosing a value that equals the resolved value
produces **no** deviation (the canonicalization property, at the model level);
the deviation list is alphabetical when both flags deviate; and a configuration
is a plain JSON-round-trippable object. Also add a test asserting the flag
catalog covers exactly the two ids with exactly the value sets in the Grounding
facts table. `npm run typecheck && npm run lint && npm test`.

---

## Step 2 — Rendering and parsing the `Ruleset` stamp

Status: committed

Notes: Added `renderRulesetTag` and `parseRuleFlagTokens` (plus the
`RuleFlagTokenError`/`ParseRuleFlagTokensResult` types and two small private
predicates, `isPermittedValue`/`isKnownFlagId`) to
`src/rules/primary/v2/configuration.ts`, matching `recordFile.ts`'s
`{kind: "parsed"|"error"}` result-object style. `renderRulesetTag` joins the
edition id with `deviatingFlags`' tokens; `parseRuleFlagTokens` takes an
already-resolved `Edition` and the tag's remaining tokens (the edition id
itself is left for `readRecord.ts`, Step 6), checking each token in
malformed → unknown-flag-id → unknown-value → repeated-flag-id order (all
four cases are mutually exclusive for the test fixtures exercised; this
step's tests don't probe the one theoretical overlap - a repeated flag id
whose second occurrence also has an invalid value - so this ordering is an
implementation choice, not a spec requirement, and is safe to revisit).
Extended `configuration.test.ts` with `renderRulesetTag` and
`parseRuleFlagTokens` describe blocks covering every case the step's
verification lists, including the byte-identical bare-edition-id checks, the
alphabetical two-token render, the four-combination round-trip on both
active editions, canonicalization, and all four rejection cases (plus a
case-sensitivity check). No deviation from the plan: still unwired (nothing
outside `configuration.ts`/its test imports these two functions yet), and no
existing file besides `configuration.ts`/`configuration.test.ts` was
touched. `npm run typecheck`, `npm run lint`, `npm test` (653 tests, all
passing, up from 638) and `npm run format:check` are all clean.

Extend `src/rules/primary/v2/configuration.ts` with the two pure halves of the
stamp, per the Grounding facts' stamping rules and Decisions 5 and 6. Still
unwired — no existing module changes in this step.

- **Render**: a configuration to its tag string — the edition id, then one
  `FLAG=value` token per deviating flag, alphabetically by flag id, space
  separated. A standard configuration renders exactly the bare edition id.
- **Parse**: given an already-resolved `Edition` and the tag's remaining tokens
  (the caller has already consumed the edition id — see Step 6), produce either
  a canonical `RuleConfiguration` or a structured error. Error cases, each
  carrying the verbatim offending token: malformed token (not exactly one
  `NAME=value` pair), unknown flag id, unknown value for a known flag, repeated
  flag id. Matching is exact and case-sensitive.

Why it comes here: Step 3 writes stamps and Step 6 reads them; both need these
functions, and testing them in isolation is cheaper than through either.

How to verify (automated): extend `configuration.test.ts` — a standard Battle /
Skirmish / superseded-Skirmish configuration renders byte-identically to its
bare edition id; each single deviation renders one token; both deviations render
in alphabetical order (`DIAGONAL_ATTACKABLE` first); render→parse round-trips
for all four value combinations on at least two editions; parsing no tokens
gives the standard configuration; parsing a token naming a flag at its resolved
value gives a configuration that reports **no** deviation and re-renders without
that token (canonicalization); and each of the four error cases is returned with
the offending token text. `npm run typecheck && npm run lint && npm test`.

---

## Step 3 — Thread the configuration through the rules, the app and the record (no behaviour change)

Status: committed

Notes: Mechanical refactor completed as planned. `legalAttacks`/`hasAnyLegalPly`
(movement.ts) and `computeOutcome` (outcome.ts) now take a required
`RuleConfiguration` in place of their `BoardLayout` parameter, with no default
— `decoder.ts:145` (now ~line 146 after its added import) gained the one
permitted explicit `STANDARD_BATTLE_CONFIGURATION` argument, unchanged in
behaviour. `InitialGameState.edition`/`PlayState.edition` became
`configuration: RuleConfiguration` (gameState.ts/play.ts), with
`buildInitialGameState` now rendering `ruleset` via `renderRulesetTag` and
`RULESET_TAG` derived from `renderRulesetTag(STANDARD_BATTLE_CONFIGURATION)`.
`playSession.ts`'s `sessionLayout` helper was renamed `sessionConfiguration`
(returning the `RuleConfiguration`, per the plan) and every
`legalAttacks`/`isOwnMovablePiece` call now threads the configuration while
`legalDestinations`/`allSquares` keep taking the derived layout;
`playAnnouncement.ts` follows the same pattern. `readRecord.ts` returns
`configuration` (a standard configuration, since no tag can carry tokens
until Step 6) instead of `edition`, threaded through
`ImportScreen.tsx` → `App.tsx` → `ReviewScreen.tsx`. `HotSeatGame.tsx` builds
`configureRules(edition)` at the point it calls `buildInitialGameState`;
`EngineGame.tsx` swaps `BATTLE_EDITION` for `STANDARD_BATTLE_CONFIGURATION`
(the plan's permitted mechanical constant swap). All 24 files the plan
anticipated were touched, plus the corresponding test fixtures (`edition:`
struct fields and bare `legalAttacks`/`hasAnyLegalPly`/`computeOutcome` calls
across `movement.test.ts`, `outcome.test.ts`, `gameState.test.ts`,
`play.test.ts`, `recordFile.test.ts`, `readRecord.test.ts`,
`playAnnouncement.test.ts`, `playSession.test.ts`, `playWarnings.test.ts`,
`playWarnings.game.test.ts`) were updated to pass the corresponding standard
configuration constant or `configureRules(edition)`. No expected record
text, tag string or position block was edited anywhere — all 653 tests pass
unchanged in count from Step 2, and `src/engine/**` was not touched at all
(confirmed via `git diff --stat`); `decoder.ts`'s only edits are the one
import line and the one call-site line, which is a minor, unavoidable
deviation from the plan's literal "one line" — the plan's own goal ("the
call must behave exactly as it does today") is met, and the import is
mechanically required for that one line to compile. `npm run typecheck`,
`npm run lint`, `npm test` (653 tests, all passing), `npm run format:check`,
and `npm run build` are all clean.

The one large, mechanical, compiler-driven refactor of this story: replace the
bare `Edition` with a `RuleConfiguration` everywhere a game is set up, played,
recorded, reviewed or judged. **No rule behaviour changes in this step** — the
hot-seat game always builds a _standard_ configuration, so every game plays and
records exactly as before.

- `movement.ts`: `legalAttacks` and `hasAnyLegalPly` take a `RuleConfiguration`
  in place of the `BoardLayout` third parameter (Decision 3), reading the layout
  from `configuration.edition.boardLayout`. Both parameters are **required** —
  no default (Decision 3), so `src/encoding/eng-nn-1/decoder.ts:145` gains an
  explicit standard-Battle argument in this step. That one line is the only
  edit permitted under `src/encoding/`, and the call must behave exactly as it
  does today. The diagonal loop's logic is unchanged in this step.
- `outcome.ts`: `computeOutcome`'s fourth parameter becomes a required
  `RuleConfiguration`, threaded into both the Flag scan (via its layout) and
  `hasAnyLegalPly`.
- `gameState.ts`: `InitialGameState.edition` becomes `configuration`;
  `buildInitialGameState` takes a configuration, validates placement against
  `configuration.edition` exactly as it validates today, and sets `ruleset` from
  Step 2's renderer. Update the exported `RULESET_TAG` constant accordingly.
- `play.ts`: `PlayState.edition` becomes `configuration`; `startPlay` and
  `applyMove` pass it to `legalAttacks`/`legalDestinations`/`resolveCombat`/
  `computeOutcome` (the latter two still receive a layout).
  `renderGameRecord` is unchanged — it writes `state.ruleset`.
- `playSession.ts` and `playAnnouncement.ts`: derive everything from
  `play.configuration` (rename the existing `sessionLayout` helper accordingly);
  every `legalAttacks` call passes the configuration, every `legalDestinations`
  / `allSquares` call passes its layout.
- `readRecord.ts`: return the resolved **configuration** (standard, since no tag
  can carry tokens yet) instead of the edition. Thread the rename through
  `ImportScreen.tsx` → `App.tsx` → `ReviewScreen.tsx`, which reads the board
  layout from `configuration.edition.boardLayout`.
- `HotSeatGame.tsx`: build a standard configuration for the chosen edition and
  pass it to `buildInitialGameState`. Placement is untouched by both flags, so
  `placementSession.newSession(edition)` keeps taking an `Edition`.
- `EngineGame.tsx`: swap `BATTLE_EDITION` for the exported standard Battle
  configuration at its `buildInitialGameState` call. Nothing else there changes.
- Tests and fixtures throughout: replace `edition: BATTLE_EDITION` /
  `SKIRMISH_EDITION` with the corresponding standard configuration constants,
  and pass configurations where a layout used to be passed to
  `legalAttacks`/`hasAnyLegalPly`/`computeOutcome`. Do **not** change any
  expected record text, tag string or position block — if one needs changing,
  the refactor is wrong.

Why it comes here: Steps 4–9 all assume the configuration is available at the
point the rule is judged. Doing the threading before any flag reads a value
keeps this commit's risk purely mechanical, and makes "the default path is
untouched" checkable on its own.

How to verify: **automated** — `npm run typecheck && npm run lint && npm test`
all green with **no edits to any expected record output** anywhere in the suite;
`npm run build` succeeds (proving the frozen `src/engine/` and
`src/encoding/eng-nn-1/` still compile untouched). **Manual (Gate A)**, with
`npm run dev` — this container has no file watching, so **restart the dev
server** before observing: play a short Battle game and a short Skirmish game
from the new-game screen through placement to a real ending (capture a flag in
one, agree a draw in the other); confirm placement, movement, orthogonal and
diagonal attacks, warnings and the end-of-game panel all behave exactly as
before, and that the developer record dump reads `[Ruleset "2-0:BATTLE"]` and
`[Ruleset "2-1:SKIRMISH"]` respectively, with no extra tokens. Import an
existing record from `doc/samples/` and confirm it still reviews.

---

## Step 4 — `DIAGONAL_ATTACKABLE` in the rules

Status: committed

Notes: In `legalAttacks`' diagonal loop (`movement.ts`), the target-legality
condition became `diagonalAttackable === "all" || !isImmobile(targetOccupant.pieceType)`,
reading `configuration.flags.DIAGONAL_ATTACKABLE`; everything else in the
loop (on-board, target-square-not-a-lake, occupied, enemy-owned) is
untouched, and `combat.ts`/`outcome.ts` were not touched, confirming the
Grounding facts' claim. Updated the module header and `legalAttacks`' doc
comment to describe both values instead of stating flatly that a Tower or
Flag can never be attacked diagonally. Added a new `movement.test.ts` describe
block (`DIAGONAL_ATTACKABLE=all`, built via `configureRules(BATTLE_EDITION, {
DIAGONAL_ATTACKABLE: "all" })`) covering: an enemy Tower and enemy Flag are
now offered diagonally; a friendly Tower/Flag is still never offered; an
empty diagonal square is still never offered; the target-square lake check
still blocks a diagonal attack; and a movable enemy is still offered
(unaffected by the widened set) — every existing diagonal test (all on
`STANDARD_BATTLE_CONFIGURATION`, i.e. `movable_only`) passes unedited. Added
a `play.test.ts` describe block exercising `applyMove` under the same `all`
configuration: a diagonal attack on an enemy Tower resolves as a mutual loss
(both squares empty afterwards), a diagonal attack on the enemy Flag ends the
game as a `flagCapture` win for the attacker, and the same two attacks throw
under the standard configuration (not a legal target). No deviation from the
plan. `npm run typecheck`, `npm run lint`, `npm test` (662 tests, up from
653, all passing), `npm run format:check` and `npm run build` are all clean.

In `legalAttacks`' diagonal loop only, drop the "target is not immobile"
condition when the configuration's resolved `DIAGONAL_ATTACKABLE` is `all`, and
keep it under `movable_only`. Nothing else changes: the target must still be
on-board, not a lake, occupied and enemy-owned; a diagonal is still never a move
onto an empty square, never two squares, and never subject to the unencumbered
bonus. Do not touch `combat.ts` or `outcome.ts` — both already handle a Tower or
Flag defender from any direction (see Grounding facts). Update `movement.ts`'s
module header and `legalAttacks`' doc comment, which currently state flatly that
a Tower or the Flag can never be attacked diagonally.

Why it comes here: it is the smaller of the two rule changes and is independent
of Step 5; it needs Step 3's threading and nothing else.

How to verify (automated): new cases in `movement.test.ts` — under
`movable_only` (i.e. every standard configuration), a numbered piece diagonally
adjacent to an enemy Tower or enemy Flag offers neither as an attack, and every
existing diagonal test still passes unchanged; under `all`, both are offered,
while a **friendly** Tower or Flag is still never offered, an empty diagonal
square is still never offered, and a lake on the target square still blocks it.
Add a `play.test.ts` case: with `all`, `applyMove` accepts a diagonal attack on
an enemy Tower and resolves it as a mutual loss (both squares empty afterwards),
and a diagonal attack on the enemy Flag ends the game as a `flagCapture` win for
the attacker; with the standard value, the same `applyMove` call throws (the
square is not a legal attack target). `npm run typecheck && npm run lint && npm
test`.

---

## Step 5 — `DIAGONAL_ATTACK_PATH` in the rules, and the two flags composed

Status: committed

Notes: In `legalAttacks`' diagonal loop (`movement.ts`), restructured the
existing target-legality check into an early `continue` and added, only when
`configuration.flags.DIAGONAL_ATTACK_PATH === "open_path"`, a check that at
least one of the two flanks - derived geometrically via the existing `step`
helper as `step(origin, dc, 0, 1, layout)` and `step(origin, 0, dr, 1,
layout)` - passes the existing private `isEmpty` predicate; under `always`
the check is skipped entirely, and the target-square lake check above it is
untouched. Updated the module header and `legalAttacks`' doc comment to
describe both `DIAGONAL_ATTACK_PATH` values and note the two flags compose
independently. Added four `movement.test.ts` describe blocks: `open_path`
(both-friendly, both-enemy, one-of-each and lake-plus-piece flank blockers
all refuse the attack; the skirt - one flank a lake, the other empty - stays
legal; clearing either flank of a two-blocker position restores legality;
an already-open pair is unaffected), an explicit `always` block pinning the
same blocked-flank and lake-plus-piece positions as still legal, and a
composition block asserting all four flag combinations on one fixed
Tower-target position (`movable_only`+`always` and `open_path` alone both
refuse it regardless of flanks since the Tower fails `DIAGONAL_ATTACKABLE`;
`all` alone offers it regardless of flanks; both together offer it only once
a flank clears). Added an `outcome.test.ts` case: a White champion boxed
into corner A1 by its own two Towers (at A2/B1) with a Black militia
diagonally at B2 - whose flanks are exactly A2 and B1 - is `ongoing` under
the standard configuration (the diagonal attack is champion's only, but
legal, ply) and a `noLegalMove` win for Black under `open_path` (both flanks
are the boxing Towers), confirming the flag reaches `hasAnyLegalPly` and
`computeOutcome` per the plan's explicit note not to design further around
this corner case. No deviation from the plan. `npm run typecheck`, `npm run
lint`, `npm test` (677 tests, up from 662), `npm run format:check` (after
running `prettier --write` on the two touched test files to satisfy the
project's formatting convention, matching prior steps' practice) and `npm
run build` are all clean.

In the same diagonal loop, when the configuration's resolved
`DIAGONAL_ATTACK_PATH` is `open_path`, additionally require that at least one of
the two flanking squares — `(c±1, r)` and `(c, r±1)` for an attack from `(c, r)`
to `(c±1, r±1)` — be unoccupied by a piece of either side and not a lake
(`movement.ts`'s existing `isEmpty` predicate is exactly this). Derive the
flanks from the direction deltas; never enumerate them per board. Under
`always`, make no such check. Leave the target-square lake check exactly as it
is, so the "skirt" stays legal. Update the doc comments.

The flag reaches `hasAnyLegalPly` for free through `legalAttacks` (Step 3), and
therefore `computeOutcome`'s "no legal move" ending. Confirm that with the test
below; per story.md, do **not** design around the stranded-side corner case or
spend further effort on it.

Why it comes here: it is the second and last rule change, and composing it with
Step 4 is what makes all four combinations real.

How to verify (automated): new cases in `movement.test.ts` — under `open_path`,
a diagonal attack is refused when both flanks hold pieces (test both a friendly
and an enemy blocker, and one of each), refused when one flank is a lake and the
other holds a piece, and legal again the moment either flank is cleared; the
skirt (one flank a lake, the other empty) stays legal; an attack with both
flanks empty is unaffected. Under `always`, every one of those positions offers
the attack. Add composition cases: with `all` **and** `open_path`, a diagonal
attack on an enemy Tower or Flag is offered only when a flank is open, and each
flag's behaviour is unchanged by the other's value (all four combinations
asserted on one fixed position). Add an `outcome.test.ts` case: a hand-built
position where the side to move has exactly one legal ply — a diagonal attack
whose flanks are both blocked — is `ongoing` under a standard configuration and
a `noLegalMove` win for the opponent under `open_path`, proving the
configuration reaches `hasAnyLegalPly`. `npm run typecheck && npm run lint &&
npm test`.

---

## Step 6 — Reading a stamped record

Status: committed

Notes: `readRecord.ts` now splits the tag value on whitespace, treats the
first token as the edition id (unknown → `unknownRuleset` carrying just that
token, matching the plan; an empty tag still falls through the same path
since `tokens[0] ?? ""` is never a known edition id), and hands the remaining
tokens to `configuration.ts`'s `parseRuleFlagTokens` together with the
resolved edition, returning its canonical configuration on success or a new
`ruleFlags` `ReadRecordError` case (wrapping `RuleFlagTokenError`) on
failure — worded in `reviewText.ts`'s `describeRuleFlagTokenError`, one
sentence per case naming the verbatim token in the established "…, so it
can't be reviewed." voice. Added three hand-built sample records under
`doc/samples/` (`2-1-skirmish-diagonal-attackable-all.txt`,
`2-1-skirmish-diagonal-attack-path-open.txt`,
`2-1-skirmish-diagonal-both-flags.txt`, all on the 8x8 Skirmish board, each a
White Champion at D3 diagonally attacking Black at E4) and described them in
`doc/samples/README.md`. Extended `readRecord.test.ts` with all of this
step's listed coverage (round-trips per non-standard configuration built via
the real writer, canonicalization, out-of-order/whitespace tokens, all four
rejection cases, and a read-from-disk test per new sample file) and
`reviewText.test.ts` with a `RuleFlagTokenError` fixture set plus a test that
every rejection sentence contains its offending token. One deviation from
the plan: because Step 6 lands before the new-game screen offers either flag
(Steps 7–9), the three sample records could not be produced by actually
playing a game through the app as `2-0-skirmish-tower-in-lane.txt` was —
they were hand-built to match the real writer's exact format instead
(header tags, position block, extended-notation move), which
`doc/samples/README.md` now calls out explicitly; the automated test suite
still proves each one parses and replays correctly. `npm run typecheck`,
`npm run lint`, `npm test` (690 tests, up from 677), `npm run format:check`
and `npm run build` are all clean.

Teach `src/rules/readRecord.ts` to read a `Ruleset` tag that carries flag tokens,
per Decisions 5 and 6:

- Split the (already PGN-unescaped) tag value on whitespace. The **first** token
  is the edition id: if it is not a registered edition, keep today's
  `unknownRuleset` rejection carrying that token (its wording in `reviewText.ts`
  is unchanged). An empty tag stays a rejection.
- Hand the remaining tokens to Step 2's parser together with the resolved
  edition. On success, resolve the position block against the edition's layout
  exactly as today and return the canonical **configuration**. On failure,
  return a new `ReadRecordError` case wrapping the structured error.
- Word the new rejections in `src/review/reviewText.ts`: one sentence per case,
  plain, naming the token that was not understood verbatim, in the established
  "…, so it can't be reviewed." voice. The exhaustive switches will not compile
  until every case is worded — that is the intended forcing function.
- Add three hand-built sample records under `doc/samples/` (following
  `2-0-skirmish-tower-in-lane.txt`'s precedent), one per non-standard
  configuration: `DIAGONAL_ATTACKABLE=all` (containing a diagonal capture of a
  Tower or the Flag), `DIAGONAL_ATTACK_PATH=open_path`, and both. Update
  `doc/samples/README.md` to describe them.

Note `recordFile.ts` needs no change (it carries the tag through as a raw
string) and `replay.ts` needs none either (it is deliberately rule-blind).

Why it comes here: it depends on Steps 2 and 3 and closes the loop opened in
Step 3, where a stamp with tokens could be written (in principle) but not read.

How to verify (automated): extend `readRecord.test.ts` — a record tagged with
each of the three non-standard configurations parses, replays end to end, and
returns a configuration whose deviations match the tag; a record tagged
`2-0:BATTLE DIAGONAL_ATTACKABLE=movable_only` (a flag at its resolved value)
reads as the **standard** Battle configuration and reports no deviations
(canonicalization); flag tokens in the wrong order and with extra internal
whitespace still read; the three existing bare-edition tags still read exactly
as before; and each rejection — unknown flag id, unknown value for a known flag,
malformed token, repeated flag id — is returned with the offending token, with
a `reviewText.ts` test asserting each sentence contains that token. Add a test
that reads each new `doc/samples/` file from disk and replays it.
`npm run typecheck && npm run lint && npm test`.

---

## Step 7 — Player-facing wording for the two choices

Status: committed

Notes: Added `src/board/ruleChoices.ts` and `src/board/ruleChoices.test.ts`.
The module holds `RULE_CHOICE_COPY` (an exhaustive, mapped-type-enforced
per-flag/per-value copy table mirroring `gameNames.ts`'s precedent — a third
flag id or value fails to compile until it has copy), the derived
`RULE_CHOICES` array (both choices ready to render, standard option listed
first per Decision 7), an exported `RULE_CHOICES_HEADING` constant ("Diagonal
attacks", the plan's section heading — not explicitly required by the step
text but kept in the same single home as the rest of the copy per Decision
7's "single home for the two choices' plain-language copy"), and
`nonStandardRuleSentences(configuration)`, which returns the deviating
flags' own one-sentence descriptions (alphabetical flag order, empty for a
standard configuration) for Steps 8-9 to consume. Used the plan's Decision 7
draft copy verbatim (see report). `ruleChoices.test.ts` covers every item the
step's verification lists, including a jargon guard that checks for the
flag ids, the unambiguous snake_case value tokens (`movable_only`,
`open_path`), "edition"/"Edition", the three edition ids, and the word "ply"
(word-boundary, case-insensitive) — deliberately excluding the value tokens
"all" and "always" from the substring check, since both are ordinary English
words the approved copy legitimately uses and a bare-substring check on them
would be nonsensical (documented inline in the test). No deviation from the
plan otherwise: nothing outside this module and its test imports it yet, and
no existing file was touched (confirmed via `git status`). `npm run
typecheck`, `npm run lint`, `npm test` (703 tests, up from 690), `npm run
format:check` (after `prettier --write` on both new files) and `npm run
build` are all clean.

Add `src/board/ruleChoices.ts` — the single home for the two choices' copy and
the "what is non-standard here" summary, per Decision 7. It provides, for each
flag: a short heading; for each value: a short option label (with the standard
value marked as standard) and a one-sentence description; and a function
turning a `RuleConfiguration` into the sentence(s) describing what is
non-standard about it, or nothing when it is standard. Follow `gameNames.ts`'s
precedent: exhaustive per-id records, so a third flag or value fails to compile
until it has copy. No React here — it is pure text, unit-testable in this
project's `node` Vitest environment.

Nothing consumes it yet: Step 8 (the new-game screen) and Step 9 (the reviewer
and the record dump) both do.

Why it comes here: both remaining feature steps need the same copy, and defining
it once, tested, prevents two divergent voices for the same rule.

How to verify (automated): a new `ruleChoices.test.ts` — every flag and every
value has a heading/label/description; the summary is empty for a standard
configuration of each registered edition, names exactly one rule for each single
deviation, and both (in alphabetical flag order) when both deviate; and — the
guard for story.md's "flag identifiers and value labels are never shown to a
player" — no string in the module contains a flag id, a value token,
"edition", an edition id, or the word "ply". `npm run typecheck && npm run lint
&& npm test`.

---

## Step 8 — The new-game screen offers both choices

Status: committed

Notes: `GameChoice.tsx` now renders `ruleChoices.ts`'s `RULE_CHOICES` in one
new `.game-choice__rules` section between the game description and the "Play
<Game>" button - each choice is a visible `<h4>` heading wired via
`aria-labelledby` to a `role="group"` pair of `aria-pressed` buttons (reusing
the game choice's own `.game-choice__option(s)`/`.game-choice__detail`
classes, so both look and behave identically), with the selected option's
sentence shown beneath it. `onChoose` now reports a full `RuleConfiguration`
built by `configureRules(selectedEdition, flagOverrides)`; `lastPlayed`
widened to `RuleConfiguration | null`, pre-selecting the edition (via
`defaultGameId(lastPlayed?.edition ?? null)`, unchanged) and seeding
`flagOverrides` from `lastPlayed.flags` when there is one - any flag never
touched this session falls back to `configureRules`'s own standard-value
resolution, exactly like the record model's own canonicalization. Reported
values are read generically off `RuleChoiceDescriptor.options[].value`
(plain `string`s, since a rendered button can't carry each flag's own
literal-value type), so one cast to `RuleFlagOverrides` at the "Play <Game>"
click is needed, mirroring the casts `ruleChoices.ts` already uses for the
same reason. `HotSeatGame.tsx`'s `edition` state became `configuration:
RuleConfiguration | null` throughout (placement still seeds from
`configuration.edition` via `newSession`, unaffected by either flag per the
plan); `handleConfirm` now passes `configuration` straight to
`buildInitialGameState` instead of calling `configureRules(edition)` itself,
since `GameChoice` already resolved it. The "You chose …" live-region
announcement is extended with `ruleChoices.ts`'s
`nonStandardRuleSentences(chosenConfiguration)`, appended as additional
sentences only when non-empty, so a standard game's announcement is
byte-identical to before. `App.tsx`'s `lastPlayedEdition` state became
`lastPlayedConfiguration: RuleConfiguration | null`, still in-memory only,
passed straight through to `HotSeatGame`. `GameChoice.css` gained matching
rules for the new section (`.game-choice__rules(-heading)`,
`.game-choice__rule(-heading)`), reusing the existing option/detail classes
rather than duplicating their chrome. No deviation from the plan: no form
controls, no "experimental"/"variant" framing were added, both choices are
offered identically for both games, and the only new cast is the one the
plan's Step 7 notes already anticipated this component would need.
`npm run typecheck`, `npm run lint`, `npm test` (703 tests, unchanged count -
this step is UI-only and the plan calls for no automated test harness at the
component level), `npm run format:check` (after `prettier --write` on
`GameChoice.tsx`) and `npm run build` are all clean; `npm run dev` was
restarted and confirmed to serve the app (HTTP 200) as a basic smoke check,
but Gates B, C, D and F themselves are left for the orchestrator's manual
verification pass with the owner, as instructed.

Make the two flags selectable, per Decisions 8 and 9.

- `src/board/GameChoice.tsx`: add one section between the selected game's
  description and the "Play <Game>" button, holding both choices. Each is a
  labelled `role="group"` of two buttons using the same `aria-pressed` toggle
  pattern the game buttons already use, with the selected option's sentence
  shown beneath it. Both choices are offered for every game and are unaffected
  by which game is selected. `onChoose` now reports a full
  `RuleConfiguration`; initial selection comes from the `lastPlayed`
  configuration, falling back to the standard values (and Skirmish, via the
  existing `defaultGameId`) when there is none.
- `src/board/HotSeatGame.tsx`: hold the chosen configuration instead of the
  chosen edition (placement still seeds from `configuration.edition`), pass it
  to `buildInitialGameState`, and report it through `onGameStarted`. Extend the
  existing "You chose …" live-region announcement so a screen-reader user hears
  the non-standard rules in force (use Step 7's summary; say nothing extra when
  the choice is standard).
- `src/App.tsx`: `lastPlayedEdition` becomes the last played
  `RuleConfiguration`, still held in memory only and never persisted.

Nothing about the rest of the screen's shape changes — no form controls, no
"experimental" or "variant" framing, no warning banner.

Why it comes here: it is the first step a player can see, and it needs Steps 3–5
(so a chosen flag actually changes play) and Step 7 (the copy).

How to verify: **automated** — `npm run typecheck && npm run lint && npm test`
stay green (this repo has no component-test harness, so the screen itself is
covered by the manual gates below; add tests for any new pure helper).
**Manual (Gates B, C, D and F)**, with a **restarted** `npm run dev`:

- **Gate F.** Read both choices as a player: they are understandable without
  knowing any flag identifier, name which value is standard, and no identifier
  or value token appears anywhere. Play a game with non-standard values, use
  "New game", and confirm the screen pre-selects both the game and the two
  values just played; reload the page and confirm it returns to the standard
  values (and to the last-played game rule only as far as it does today —
  nothing is persisted).
- **Gate B.** With `DIAGONAL_ATTACKABLE` on the alternative: a numbered piece
  diagonally adjacent to an enemy Tower can attack it and the attack resolves as
  a partial sacrifice; a piece diagonally adjacent to the enemy Flag can capture
  it and the game ends as a Flag capture with the right winner and reason. On
  the standard value, both squares are refused, as today.
- **Gate C.** With `DIAGONAL_ATTACK_PATH` on the alternative: a diagonal attack
  with both flanking squares occupied is not offered; freeing either one makes
  it legal again; a diagonal past a single lake corner is still legal. On the
  standard value all of these are legal regardless of the flanks.
- **Gate D.** With both on their alternatives, behaviour is the combination of
  Gates B and C, and the developer record dump's `Ruleset` tag reads
  `<edition> DIAGONAL_ATTACKABLE=all DIAGONAL_ATTACK_PATH=open_path`, in that
  order. Repeat once on Battle and once on Skirmish.

---

## Step 9 — The reviewer shows what was played

Status: committed

Notes: `ReviewScreen.tsx` now computes `nonStandardRuleSentences(configuration)`
once per render (the record's rules are fixed for the whole review, unlike
`recordedResult`, which is cursor-dependent) and renders it as a new
`<p className="review-status__rules">` inside the existing `.review-status`
block, between the position line and the recorded-result line, only when
non-empty - a standard record therefore renders nothing new, matching
Decision 10 exactly. `GameRecord.tsx` computes the same summary from
`play.configuration` and appends it (space-joined, only when non-empty) to
the existing hint paragraph alongside the `Ruleset` tag it already prints -
one call in each of the two record surfaces, both consuming Step 7's
`nonStandardRuleSentences` so the wording is identical everywhere it
appears. Added `.review-status__rules` to `ReviewScreen.css` (plain weight,
explicitly distinguished in a comment from `.review-status__result`'s
italic "record's claim" styling, since this line states the record's rules
as fact rather than quoting a claim). No new player-facing framing was
added - no heading, no "non-standard"/"experimental" wording, just the same
plain sentences Step 7 wrote. No deviation from the plan: only the two files
Decision 10 names (`ReviewScreen.tsx`, `GameRecord.tsx`) were touched
besides `ReviewScreen.css` for styling, no automated tests were added (the
step's own verification lists none - `ruleChoices.test.ts` from Step 7
already covers `nonStandardRuleSentences` itself), and the test count is
unchanged at 702. (Step 8's notes recorded 703, which was accurate when that
step was reported; the orchestrator then removed `ruleChoices.test.ts`'s
"marks the standard option's label as standard" test while applying the
owner's copy revision at Step 8's manual gate, since no value is marked as
the standard one any more. Nothing in Step 9 changed the count.)
`npm run typecheck`,
`npm run lint`, `npm test` (702 tests, all passing), `npm run format:check`
and `npm run build` are all clean; `npm run dev` was restarted and confirmed
to serve the app (HTTP 200) as a basic smoke check, with Gate E itself left
for the orchestrator's manual verification pass with the owner, as
instructed.

Surface a record's non-standard rules, per Decision 10:

- `src/review/ReviewScreen.tsx`: show a short plain-language line (Step 7's
  summary of the configuration `readRecord` returned) near the status line while
  reviewing, and show nothing at all when the record is standard — an existing
  standard record's review must look exactly as it does today. Without this, a
  diagonal capture of a Flag looks like a bug.
- `src/board/GameRecord.tsx`: add the same summary to the developer-facing hint
  line alongside the `Ruleset` tag it already prints.

Why it comes here: it needs Step 6 (a record can carry flags) and Step 7 (the
copy), and it is the last piece of Gate E.

How to verify: **automated** — `npm run typecheck && npm run lint && npm test`
stay green. **Manual (Gate E)**, with a **restarted** `npm run dev`: play a
short game with both flags on their alternatives to a real ending, copy the
developer record dump to a file, and import it in the reviewer — it replays end
to end, the non-standard rules are named in plain language while reviewing, and
the review disappears none of today's behaviour. Repeat with a standard game and
confirm **no** rules line appears. Import each of the three `doc/samples/` files
added in Step 6 and confirm each reviews with the right rules named. Finally,
hand-edit one sample's tag to name a flag this app does not know and confirm the
rejection message names that exact token. ~~(This last check is superseded by
Step 10 — such a record must **review**, not be rejected.)~~

---

## Step 10 — An unrecognised flag must not prevent review

Status: committed

Notes: `configuration.ts`'s `parseRuleFlagTokens` no longer returns a
`{kind: "parsed"|"error"}` result; it always succeeds, returning
`{configuration, unrecognizedTokens}` — a token is resolved into the
configuration when, and only when, it is exactly one `NAME=value` pair
naming a known flag id, a value that flag id permits, and a flag id not
already resolved by an earlier token in the same call; everything else
(malformed, unknown flag id, unknown value, or a second token for an
already-resolved flag id) is pushed onto `unrecognizedTokens` verbatim and
left out of the configuration. The `RuleFlagTokenError`/
`ParseRuleFlagTokensResult` types are removed rather than repurposed.
`readRecord.ts` drops its `ruleFlags` `ReadRecordError` case entirely (the
edition id is now the only thing that can reject a record) and its `parsed`
result gains `unrecognizedRuleTokens: readonly string[]`, threaded through
`ImportScreen.tsx`'s `onImported` and `App.tsx`'s `review` screen state to
`ReviewScreen.tsx`, which now renders one sentence per unrecognized token
(a new `unrecognizedRuleSentence(token)` in `ruleChoices.ts`, quoting the
token verbatim — the one function in that module that deliberately embeds
raw token text) after the existing recognised-deviation sentences, so a
record can show both at once. `reviewText.ts` drops
`describeRuleFlagTokenError` and its `ruleFlags` case in `describeRejection`
entirely (the exhaustive switch's `satisfies never` forced this once the
case was removed from the union). `GameRecord.tsx` needed no change — a live
`PlayState` is always built from known flags, so it can never carry an
unrecognized token. Rewrote the four rejection-focused test blocks in
`configuration.test.ts` and `readRecord.test.ts` into pass-through
assertions per the step's verification list (each of the four token shapes
replays and is carried as unrecognized; a mixed recognised+unrecognised
record describes the recognised one and names the other; the same flag
given twice keeps the first token's value and reports the second as
unrecognized — a design call, called out inline in both the implementation
and its tests, matching the plan's own "open to challenge" framing), removed
the now-nonexistent `ruleFlags` cases from `reviewText.test.ts`, and added
`unrecognizedRuleSentence` coverage to `ruleChoices.test.ts` (quotes the
token verbatim; no "resume"/"experimental" wording; never says "ply"). No
deviation from the plan otherwise: existing record fixtures and the three
Step 6 `doc/samples/` files were not touched, and all pass unedited.
`npm run typecheck`, `npm run lint`, `npm test` (707 tests, up from 702),
`npm run format:check` and `npm run build` are all clean; `npm run dev` was
restarted and confirmed to serve the app (HTTP 200) as a basic smoke check,
with this step's own manual re-check left for Step 11's Gate E re-check as
the plan specifies.

**Added after Step 9's manual gate (Gate E), on the owner's finding.** Step 6
made an unrecognised flag token reject the whole record. That is wrong, and it
breaks a guarantee the companion project makes about this application by name.
`technical-notes.md`, "What is guaranteed, and to whom":

> **View-only replay is guaranteed for all records, forever.** A record can be
> read, its position block rendered, and its move sequence stepped through by
> notation-schema stability alone — no rules knowledge required. This holds for
> every record ever written, under any edition, and survives every minor bump.

and, closing that section: "The distinction is what lets rules change without
breaking the front-end application, **whose contract is review, not
validation**." `replay.ts` is already rule-blind and consults no rule to step a
record, so nothing about reviewing actually needs the flags — only the
_description_ shown to the reviewer does.

Implement:

- **No flag token ever rejects a record.** All four cases Step 6 introduced —
  malformed token, unknown flag id, unknown value for a known flag, repeated
  flag id — stop being rejections. Known tokens still resolve as they do now;
  everything else is carried as an **unrecognised token**, verbatim.
  _Design call (open to challenge at peer review): malformed and repeated
  tokens pass too, not just unknown ones. Blocking review over any of them
  denies view-only replay just the same, and the guarantee is about rules
  knowledge, not tag tidiness._
- **The edition id remains the one thing that can reject.** It is needed to
  resolve the board layout and the notation frame, and it is how major-1
  records are already refused (story 00000023's Step 8). Today's
  `unknownRuleset` rejection and its message are unchanged.
- **The reviewer is told, plainly, that it cannot describe those rules.** A
  record carrying an unrecognised token reviews normally, and says in the same
  plain voice as Step 7's copy that the game used a rule this app does not
  know, quoting the token — so a reviewer is never misled into thinking they
  are watching a standard game. Recognised flags keep their existing
  sentences; a record can carry both at once.
- **Nothing implies such a game could be resumed.** Reviewing is guaranteed;
  playing on from a record is not, and nothing in the app does that today.
  This is a note for the future, not code.
- The `RuleFlagTokenError` machinery from Step 6 is repurposed or removed as
  the implementation prefers; `reviewText.ts`'s wording for those four cases
  goes away with the rejections, and its exhaustive switches will say so.

Depends on: Steps 6, 7 and 9 (the parsing, the copy, and the reviewer's
display).

Verification (**automated**): `npm run typecheck`, `npm run lint`, `npm test`,
`npm run format:check` and `npm run build` all clean. Tests must pin: a record
whose tag names an unknown flag id replays end to end; the same for an unknown
value, a malformed token and a repeated flag; a record mixing one recognised
and one unrecognised token both replays and describes the recognised one; the
unrecognised token is reproduced verbatim in what the reviewer is told; and an
unknown **edition id** still rejects exactly as it does today. Existing record
fixtures and the three Step 6 samples must keep passing unedited.

Verification (**manual**, folded into Gate E's re-check at Step 11): hand-edit
a sample's tag to `DIAGONAL_SOMETHING=on`, and separately to
`DIAGONAL_ATTACKABLE=sideways`, and confirm each still reviews end to end while
saying the app does not know that rule.

---

## Step 11 — README, final copy sweep, and the accessibility pass

Status: committed

Notes: `README.md`'s two "corner-to-corner" mentions became "diagonal"; the
"Move, attack, and capture on the battlefield" bullet's flat "towers and the
flag can't be attacked that way, so the flag must always be taken head-on"
became settings-dependent ("whether that can also reach a tower or the flag,
and whether it needs a clear square beside the two pieces, depends on the
diagonal-attack settings you picked when you set up the game"), with neither
value named as standard, matching the UI; the "Set up a game with a friend"
bullet gained one clause ("choose how you'd like diagonal attacks to work for
this game"). A new paragraph was added to "The rules" resolving the
plan-flagged tension: it states plainly that the two diagonal-attack settings
"aren't official rules yet" and links to the companion repository's
`proposed-variants.md` (confirmed to exist via `gh api`) as their source,
satisfying "avoid language implying they are part of the official game"
without adding any hedging to the UI itself (that constraint applies only to
the UI, per story.md's Policy bullet and the plan's Decision 7/8 - the README
is free to, and here does, say more than the UI does). The copy sweep across
`GameChoice.tsx`, `HotSeatGame.tsx`, `ReviewScreen.tsx`, `GameRecord.tsx`,
`reviewText.ts` and `ruleChoices.ts` found nothing to change: every flag id,
value token and edition id present in those files is confined to code
identifiers, object keys or code comments, never rendered text (confirmed by
grep plus `ruleChoices.test.ts`'s existing jargon-guard test), and every
occurrence of "ply" is likewise a comment, a variable name, or part of
`reviewText.ts`'s "Move {ply} (round {round}, {color})" pattern where the
rendered word is "Move", not "ply". The accessibility pass was a code review
rather than new work: `GameChoice.tsx`'s two rule-choice groups already use
`role="group"`/`aria-labelledby` tied to a visible heading and the same
`aria-pressed` toggle-button pattern the pre-existing game buttons use (so a
screen reader announces each button's pressed state natively, satisfying "its
current state is announced" without a duplicate live region), the section
nests correctly in the heading hierarchy (h2 "Choose a game" → h3 "Diagonal
attacks" → h4 per choice), buttons are native `<button>` elements needing no
extra keyboard wiring, and the post-choice announcement
(`HotSeatGame.tsx`'s `gameAnnouncement` live region) is the single place the
chosen game and any non-standard rules are spoken aloud, so nothing is
announced twice from two regions; no code changes were needed. Ran
`npm run typecheck`, `npm run lint`, `npm test` (707 tests, unchanged - this
step touched only `README.md` and this plan file), `npm run format:check` and
`npm run build`, all clean; `npm run dev` was restarted and confirmed to
serve the app (HTTP 200) as a basic smoke check. Gate G itself, the Gate A
re-check, and the Gate E re-check (Step 10's unrecognised-token cases) are
left for the orchestrator's manual verification pass with the owner and a
real screen reader, as the plan specifies. No deviation from the plan.

- `README.md`: switch its two existing "corner-to-corner" mentions (lines 29 and 69) to "diagonal", per Decision 7 — the app and the README must use one word,
  and it is the rulebook's. Update the "Move, attack, and capture on the
  battlefield" bullet, which currently states flatly that towers and the flag
  can't be attacked diagonally "so the flag must always be taken head-on" — now
  true only on the standard setting; and the "Set up a game with a friend"
  bullet, which
  describes the new-game screen and should mention, in one short clause and the
  same plain voice, the two extra choices a player now meets there. Do not
  restate the rules; the companion repository stays the linked source of truth,
  and these two flags are proposals, so avoid language implying they are part of
  the official game. The `/update-readme` command may be used (it reviews the
  branch diff and updates `README.md` if warranted).
- Sweep every surface this story touched (`GameChoice.tsx`, `HotSeatGame.tsx`,
  `ReviewScreen.tsx`, `GameRecord.tsx`, `reviewText.ts`, `ruleChoices.ts`) for
  player-facing strings that leak a flag id, a value token, an edition id, or
  the word "ply".

Why it comes here: last, so the copy describes finished behaviour, and so the
accessibility pass exercises the whole feature.

How to verify: **automated** — `npm run typecheck && npm run lint && npm test`
and `npm run format:check` all clean, `npm run build` succeeds. **Manual (Gate
G, plus a Gate A re-check)**, with a **restarted** `npm run dev` and a screen
reader running:

- With the mouse put away, choose a game and both flag values by keyboard alone,
  start the game, place both armies, and play a diagonal attack that only one
  flag combination permits (e.g. a diagonal Tower attack under `all`). Every
  choice and its current state is announced, and nothing is announced twice from
  two regions.
- Re-check Gate A: a Battle and a Skirmish game left on the standard values play
  and record exactly as they did before this story, with bare `2-0:BATTLE` /
  `2-1:SKIRMISH` tags.
- Re-check Gate E for Step 10: a sample record hand-edited to name a flag this
  app does not know (`DIAGONAL_SOMETHING=on`) and one hand-edited to an unknown
  value (`DIAGONAL_ATTACKABLE=sideways`) both **review end to end**, each saying
  plainly that the app does not know that rule.
- Re-read the two changed `README.md` bullets end to end for accuracy and tone.
