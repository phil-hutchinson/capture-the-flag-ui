# Story 00000025 — Add tower restriction

## Summary

The companion project has published a new Skirmish edition, **`2-1:SKIRMISH`**
(its story 00000037, 2026-08-02), which adds one placement restriction:
**in Skirmish, no tower may stand directly in front of a lane.** A _lane_ is a
gap the lakes leave open through the middle of the board — the only way from
one half of the board to the other. On the Skirmish board the lanes are column
A, columns D–E, and column H, so the closed squares are **A3, D3, E3 and H3**
for the player whose back rank is row 1, and **A6, D6, E6 and H6** for the
other. Every other home square stays open, **B3, C3, F3 and G3** included —
those sit behind the lakes, not behind a lane.

**Battle is unaffected and does not change.** `2-0:BATTLE` stays exactly as it
is, still active, still written into records unchanged: Battle's home zones are
separated from the lake rows by an empty buffer row, so no Battle home square
is directly in front of a lane and the restriction closes nothing there.

What a player will notice:

- **In Skirmish, four squares in your home zone will no longer take a tower.**
  Placing a tower directly in front of a lane is refused, with a short
  explanation of why; the existing "no two towers may touch" rule is unchanged
  and still applies as well.
- **Auto-fill respects it**, so a randomly filled Skirmish army never produces
  an arrangement the player then has to fix.
- **Nothing else about a game changes.** Movement, combat, and how games end are
  untouched; a Skirmish game plays exactly as it did.

Under the surface, this is the app's first **minor** ruleset bump and its first
time carrying two editions of the same ruleset: new Skirmish games are recorded
as `2-1:SKIRMISH`, while games already recorded as `2-0:SKIRMISH` stay
reviewable.

## Background & references

- `doc/ruleset/rules.md` in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository is the single source of truth and is not restated here. This story
  is written against **`2-1:SKIRMISH`** (see that repo's
  `doc/ruleset/changelog.md`, entry for story 00000037, 2026-08-02). The rule
  itself is in that document's Section 3; the closed set is defined in
  Appendix A under `TOWER_PLACEMENT`; the editions are tabulated in Appendix B;
  and _lane_ is now a glossary term.
- **The restriction is published as a variant**, `TOWER_PLACEMENT`, with values
  `spacing_only` (the default — what every earlier edition played) and
  `spacing_and_lanes`. `2-1:SKIRMISH` sets `spacing_and_lanes`; `2-0:BATTLE`
  now spells out `spacing_only` in Appendix B, which changed nothing about that
  edition (an edition has always fixed a value for every variant; this one was
  at its default before it had a name).
- **The closed set is defined geometrically**, not as a list of squares: a home
  square that is orthogonally adjacent to a square that lies in a lake row and
  is not itself a lake. That definition is what makes the same variant value a
  real restriction on the Skirmish board and inert on the Battle board.
- **`2-0:SKIRMISH` is superseded, not retired.** It moves to Appendix B's
  Historical table; a game recorded under it was played with towers allowed in
  front of the lanes, and it remains a real edition a record may name.
- **The minor numbers of the two rulesets now differ for the first time** —
  Skirmish `2-1`, Battle `2-0`. They share major 2 because they share the same
  rules text. The app must not assume the two active editions carry the same
  minor.
- **The notation is unaffected.** A placement restriction produces no new kind
  of ply, and a record stamped `2-1:SKIRMISH` reads exactly as one stamped
  `2-0:SKIRMISH` does. Only the `Ruleset` tag differs.
- Relevant code today: `src/rules/primary/v2/edition.ts` (the edition registry —
  `EditionId` is currently the two-value union `2-0:BATTLE` | `2-0:SKIRMISH`,
  and an `Edition` carries a `BOARD_LAYOUT` and an `ARMY_COMPOSITION` but no
  third variant), `src/rules/primary/v2/boardLayout.ts` (the geometry the
  closed-square definition is computed from), `src/rules/primary/v2/placement.ts`
  (the tower-adjacency check and `autoFill`), `src/board/PlacementStatus.tsx`
  and `src/board/HotSeatGame.tsx` (the blocking message and its announcement),
  `src/board/gameNames.ts` (`gameName`, and `defaultGameId`, which currently
  returns the literal `2-0:SKIRMISH`), and `src/rules/readRecord.ts` (which
  resolves a record's `Ruleset` tag through the edition registry).

## Policy (fixed by the owner)

- **Both Skirmish editions are registered; only `2-1:SKIRMISH` is played.**
  New Skirmish games are set up, played, and recorded as `2-1:SKIRMISH`.
  `2-0:SKIRMISH` remains in the registry so that records naming it still
  review, but it is never offered as a game to start.
- **This is a minor bump, so it stays in `src/rules/primary/v2/`.** Per the
  convention from stories 00000016 and 00000023, a new code folder is for a
  major bump only. There is no `v2.1` folder.
- **`TOWER_PLACEMENT` joins the edition model as a third variant**, alongside
  `BOARD_LAYOUT` and `ARMY_COMPOSITION`, with `spacing_only` as its default.
  Each registered edition names its value explicitly, `2-0:BATTLE` included.
- **The closed squares are computed from the board geometry**, per the rules'
  definition — a home square orthogonally adjacent to a non-lake square in a
  lake row — and never hardcoded as A3/D3/E3/H3 and A6/D6/E6/H6. Those squares
  are what the definition must _produce_ on the Skirmish board, and are the
  test's expected values, not the implementation.
- **`spacing_and_lanes` on the Battle board is inert, and that falls out of the
  geometry.** No special-casing by board or by edition: applying
  `spacing_and_lanes` to `standard_144` must close nothing, because the buffer
  row means no home square qualifies.
- **Battle is untouched.** `2-0:BATTLE` keeps its id, its rules, and its
  records; nothing about a Battle game changes.
- **Computer play stays disabled**, as story 00000023 left it. Re-enabling it
  still needs a new engine spec and is out of scope here.

## Players and colors

Unchanged: first player = White = red (`#a13d2b`); second player = Black = blue
(`#33526b`). Player-facing surfaces name the sides by color, use the rules'
piece names exactly as written there, and use the word "move" (never "ply").
The two games are named to players as **Battle** and **Skirmish** — edition ids
are never shown to players.

**"Lane" is now player-facing vocabulary.** The rules define it in the glossary
for a player audience, so UI copy may use the word — but it should be explained
in passing the first time it matters (e.g. "the open column through the middle
of the board"), not assumed known.

## In scope

1. **The `TOWER_PLACEMENT` variant in the edition model.** `edition.ts` gains a
   third variant with values `spacing_only` | `spacing_and_lanes`, defaulting
   to `spacing_only`; every registered edition sets it explicitly.
2. **The registry carries three editions.** `2-0:BATTLE`
   (`spacing_only`, active), `2-1:SKIRMISH` (`spacing_and_lanes`, active), and
   `2-0:SKIRMISH` (`spacing_only`, historical). `EditionId` widens to three
   values, and the set offered for play becomes a deliberate subset of the set
   that can be _read_ — the first time those two sets differ. Anything that
   currently enumerates editions to build the game picker must offer only the
   active pair.
3. **The rule itself.** A placement helper computes, from a board layout, the
   home squares closed to towers under `spacing_and_lanes` (a home square
   orthogonally adjacent to a non-lake square in a lake row) — producing
   A3/D3/E3/H3 and A6/D6/E6/H6 on `standard_64` and the empty set on
   `standard_144`. Placement validity for towers then combines the unchanged
   spacing rule with this one, according to the edition's variant value.
4. **Placement enforcement in the UI.** A player cannot finish a Skirmish
   placement with a tower in front of a lane, and is told which rule they have
   broken in plain language distinct from the "two towers are touching"
   message. The keyboard and screen-reader paths stay equivalent to the mouse
   path, matching the established placement patterns.
5. **Auto-fill.** `autoFill` on a `spacing_and_lanes` edition never produces a
   tower on a closed square, and still satisfies the spacing rule. It must
   remain reliable on the Skirmish board, where 3 towers are placed into a
   24-square home zone with 4 squares closed.
6. **Records.** New Skirmish games write `Ruleset "2-1:SKIRMISH"`; Battle keeps
   `2-0:BATTLE`. The reviewer accepts `2-1:SKIRMISH` and continues to accept
   `2-0:SKIRMISH` and `2-0:BATTLE`. No other part of the notation changes, and
   the position block is unchanged.
7. **The game picker's default.** `defaultGameId`'s "nothing played yet" fall
   back becomes `2-1:SKIRMISH`, and a session's "most recently played" memory
   keeps working across the renamed edition.
8. **Everything keeps working, accessibly.** A hot-seat game of either game —
   choose, place, play, end, dump the record — is playable throughout the
   story, each step verified and committed per the standard pipeline.

## Design decisions & constraints

- **Refuse the placement, don't just block the confirm.** The spacing rule
  depends on where the _other_ towers went, so it can only be judged once
  towers are down — hence today's "confirm is blocked, here is why" treatment.
  The lane restriction is different: the closed squares are known before the
  player places anything, so a tower dropped on one can be refused at the
  moment of placement with an immediate explanation. Preferred, but see the
  open items — the two rules should end up feeling like one coherent
  experience, not two mechanisms.
- **The closed squares should be visible, not just enforced.** A player
  shouldn't have to discover the rule by being refused. Some quiet indication
  on the placement board while a tower is in hand is expected; the exact
  treatment is a plan-time decision.
- **No variant framework.** `TOWER_PLACEMENT` is a third field in the same
  small edition configuration, in the same shape as the existing two. This
  story does not build a general variants system, and offers nothing beyond the
  registered editions.
- **The two active editions no longer share a minor.** Anything that derives an
  edition id, matches on one, or assumes a shared version string must be
  checked — `gameName` in `src/board/gameNames.ts` currently reads "Battle if
  the id is `2-0:BATTLE`, else Skirmish", which happens to survive a third id
  but should be made deliberate rather than accidental.
- **Replay is unaffected by the restriction.** A record carries a completed
  position, and placement rules are only checked while a player is placing —
  so an old `2-0:SKIRMISH` record with a tower in front of a lane must still
  replay without complaint. The variant value must not leak into replay
  validation.

## Out of scope

- **Re-enabling computer play** — still needs a new engine spec, re-encoding,
  and retraining. The start-screen option stays visible and disabled.
- **A general variants/flags framework**, or offering `TOWER_PLACEMENT` (or any
  other variant) as a player-selectable setting. The app plays published
  editions only.
- **Any change to Battle**, to the notation, or to movement, combat, or the
  ending conditions.
- **The follow-up items already parked** in
  `doc/plan/proposed-stories/rules-2-0-edition-experience-and-records.md`
  (the fuller two-edition experience, and verification against real
  engine-produced records), and **saving a played game to a file**.

## Manual-verification gates

- **Gate A — The rule, in Skirmish.** Starting a Skirmish game and trying to
  put a tower on A3, D3, E3 or H3 (as White) is refused with a message a player
  can act on; B3, C3, F3 and G3 accept a tower normally, as does every square
  in the second and third home rows. The same holds for Black on A6, D6, E6 and
  H6. The "two towers are touching" rule still behaves as it did, and the two
  messages are distinguishable.
- **Gate B — Auto-fill.** Auto-filling a Skirmish army repeatedly never places
  a tower on a closed square and never produces two touching towers; the fill
  succeeds every time.
- **Gate C — Battle is unchanged.** A Battle game places, plays, and ends
  exactly as before; no Battle square is refused a tower for this reason, and
  the record still reads `2-0:BATTLE`.
- **Gate D — Records.** A finished Skirmish game dumps a record tagged
  `2-1:SKIRMISH`, and re-importing that dump into the reviewer replays it end
  to end. A record tagged `2-0:SKIRMISH` — including one whose starting
  position has a tower in front of a lane — still imports and replays without
  complaint.
- **Gate E — Accessibility.** With the mouse put away, a Skirmish placement
  including a refused tower and a recovery from it is workable by keyboard
  alone, with the screen reader announcing the refusal and the reason, and any
  visual marking of the closed squares having a non-visual equivalent.

## Open items to resolve at plan time

- **How the refusal and the existing block fit together as one experience** —
  whether the lane rule is enforced at drop time (as preferred above) while
  spacing stays a confirm-time block, or both are unified; and how the two
  messages are worded so a player reads them as the same rule family.
- **How the closed squares are indicated on the board** while a tower is in
  hand (and whether anything is shown when one is not), with an accessible
  equivalent.
- **How the historical edition is represented** so that "readable" and
  "playable" are cleanly separated in `edition.ts` — extending
  `playableEditions()`, an explicit `status` field, or a separate historical
  registry — and what the picker enumerates.
- **Whether `2-0:SKIRMISH` needs a sample/fixture record** to hold the
  historical path honest, and what existing test fixtures should move to
  `2-1:SKIRMISH` versus deliberately stay on `2-0:SKIRMISH`.
- **Where the closed-square computation lives** (`boardLayout.ts` as geometry
  versus `placement.ts` as a rule) and how the variant value is threaded to it,
  given that most rule functions currently take a `BoardLayout` rather than a
  full `Edition`.
- **Whether any existing player-facing copy** — placement instructions, help
  text, the game picker's description of Skirmish — should mention the rule up
  front rather than only on refusal, and whether `README.md` needs updating.
- **The step decomposition** that keeps the app green at every commit — likely
  the variant and registry first, then the rule and its tests, then placement
  enforcement and auto-fill, then the UI treatment, then the record tag and
  the picker default.
