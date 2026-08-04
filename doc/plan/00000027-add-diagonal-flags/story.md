# Story 00000027 — Add diagonal flags

## Summary

The companion project has **proposed** two new rule flags governing diagonal
attacks — `DIAGONAL_ATTACKABLE` and `DIAGONAL_ATTACK_PATH` — and has not
implemented either. They sit in that repository's `doc/ruleset/proposed-variants.md`
sandbox, where a flag can be specified in full and argued over before anything
commits to it. Neither has an edition; both published editions play their
defaults, which is exactly how every game plays today.

**This app becomes the testing ground for them.** A player setting up a
hot-seat game picks each flag's value alongside picking Battle or Skirmish, and
plays a real game under whatever they chose. That is the point of the story: to
make these two rules something you can feel across a board rather than reason
about on paper, so the companion project can decide them on evidence.

What a player will notice:

- **Two new choices on the new-game screen**, one per flag, each offering the
  standard rule and one alternative. Both apply to Battle and to Skirmish.
- **`DIAGONAL_ATTACKABLE` — what a diagonal attack can hit.** Standard: only a
  numbered piece. Alternative: any enemy piece, Towers and the Flag included —
  so the Flag can be captured from a diagonal, which it never could before.
- **`DIAGONAL_ATTACK_PATH` — whether a diagonal attack needs room.** Standard:
  no, a diagonally adjacent enemy can always be attacked. Alternative: yes, at
  least one of the two squares beside the diagonal must be free of pieces and
  not a lake.
- **Nothing else changes.** Placement, movement, orthogonal attacks, the
  formation bonus, and how a game ends are all untouched, and a game played on
  the standard settings is identical to a game played today.

Under the surface, this is the app's first configuration that is **not** simply
a published edition: a game is now recorded as an edition **plus** whichever
flags deviate from it.

## Background & references

- `doc/ruleset/rules.md` in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository is the single source of truth for the rules and is not restated
  here. Diagonal attack itself is baseline at major 2 — Section 4.3,
  "Diagonal attacks" — and this story changes only what the two proposed flags
  say it changes.
- **The two flags are specified in that repository's
  `doc/ruleset/proposed-variants.md`** (its story 00000039, merged 2026-08-02),
  not in `rules.md` Appendix A. That file's own terms: it carries no promises,
  entries may change or disappear, and nothing outside it may depend on it —
  the front-end player application named explicitly. A flag graduates to
  Appendix A only when its implementing branch merges in that repository.
  Neither has been implemented there.
- **`DIAGONAL_ATTACKABLE`** — values `movable_only` (default) | `all`. Governs
  which enemy pieces are legal targets of a diagonal attack. `all` makes a
  Tower or the Flag a legal diagonal target, resolving by the same rank and
  formation rules as any other target; a diagonal Tower attack is still a
  partial sacrifice, as every Tower attack is.
- **`DIAGONAL_ATTACK_PATH`** — values `always` (default) | `open_path`. Governs
  whether a diagonal attack requires a clear path, independently of what
  `DIAGONAL_ATTACKABLE` permits as a target. `open_path` additionally requires
  that **at least one** of the two squares flanking the diagonal — the two
  squares orthogonally adjacent to both attacker and target — be unoccupied by
  a piece of either side **and** not a lake.
- **`open_path` is consistent with the existing lake-corner decisions.** That
  repository's `doc/ruleset/technical-notes.md` already distinguishes the
  _skirt_ (one flanking square a lake, the other open — legal) from the
  _squeeze_ (both flanking squares lakes — illegal, though unreachable on both
  published boards). `open_path` generalizes the squeeze to flanks blocked by
  pieces as well as by lakes; the skirt stays legal under it.
- **The record format already carries this.** `technical-notes.md`, "Where a
  configuration is stamped" and "Record file format": a configuration is an
  edition id plus the flags that deviate from it, and the `Ruleset` tag is
  written as the edition id followed by one `FLAG=value` token per deviating
  flag, space separated, ordered alphabetically by flag id. Flags at their
  resolved value are **omitted**. An absent flag means the edition's value,
  falling back to the flag's own default for an edition published before the
  flag existed — which is precisely the case for both flags here.
- **A configuration is canonicalized when read**: a stamp listing a flag at the
  value it would resolve to anyway normalizes to one that omits it. The two
  mean the same thing, and this app reads stamps it did not write.
- Relevant code today: `src/rules/primary/v2/movement.ts` (`legalAttacks`, whose
  diagonal loop at the end is the single site both flags act on, and
  `hasAnyLegalPly`, which is built on it), `src/rules/primary/v2/edition.ts`
  (the registry — an `Edition` carries fixed values for `BOARD_LAYOUT`,
  `ARMY_COMPOSITION` and `TOWER_PLACEMENT`, and there is no notion of a
  deviation), `src/rules/primary/v2/gameState.ts` (game-state artifacts carry a
  resolved `Edition`), `src/rules/primary/v2/combat.ts` (rank, equal rank,
  formation bonus, sacrifice resolution), `src/rules/primary/v2/outcome.ts`
  (game end, including "no legal move"), `src/rules/readRecord.ts` (which
  currently matches the **whole** `Ruleset` tag value against `EditionId`, so
  any tag carrying a flag token is rejected as `unknownRuleset` today),
  `src/rules/primary/v2/recordFile.ts` (tag parsing and rejections),
  `src/board/GameChoice.tsx` (the new-game screen and its session memory),
  `src/board/GameRecord.tsx` (which renders the `Ruleset` tag), and
  `src/review/ReviewScreen.tsx` (which shows a reviewed record's edition).

## Policy (fixed by the owner)

- **Both flags, now.** Both are implemented in this story, and their four
  combinations are all playable.
- **Both boards.** Every flag combination is offered for Battle and for
  Skirmish alike. Nothing about a flag is board-specific.
- **Human vs. human only.** The flags are offered on the hot-seat game.
  Computer play is out of scope and stays as it is.
- **Presented as plain options, with no "experimental" framing.** They read as
  ordinary game settings on the new-game screen, in the same plain language as
  everything else there. No warning banner, no disclosure, no jargon.
- **Session stickiness matching the game choice.** Returning to the new-game
  screen after a game pre-selects the flag values just played, exactly as it
  already pre-selects the game just played. Nothing is persisted across a
  reload — a fresh visit starts on the standard values.
- **A game records its edition _and_ its flags**, in the form the companion
  repository specifies: edition id plus alphabetically ordered `FLAG=value`
  tokens for deviations only.
- **This stays in `src/rules/primary/v2/`.** No new version folder: nothing
  about major 2's baseline changes, and the defaults preserve current play
  exactly.
- **Computer play stays disabled**, as story 00000023 left it. The engine still
  throws on any diagonal ply, which predates this story and is untouched by it.

## Players and colors

Unchanged: first player = White = red (`#a13d2b`); second player = Black = blue
(`#33526b`). Player-facing surfaces name the sides by color, use the rules'
piece names exactly as written there, and use the word "move" (never "ply").
The two games are named to players as **Battle** and **Skirmish**.

**Flag identifiers and value labels are never shown to a player.**
`DIAGONAL_ATTACK_PATH=open_path` is a record tag, not UI copy. The new-game
screen describes each choice in the same plain language as the rest of the
screen — what a diagonal attack can hit, and whether it needs room beside it.
The exact wording is a plan-time decision.

## In scope

1. **A rule configuration: an edition plus deviating flags.** The app's first
   configuration that is not simply a registered edition. It resolves each
   flag's value (the edition's value where it has one, the flag's own default
   otherwise), and knows which of its values deviate. This is what a game is
   set up, played, recorded, and replayed under, in place of a bare `Edition`.
2. **`DIAGONAL_ATTACKABLE` in the rules.** `legalAttacks`' diagonal loop offers
   an immobile enemy piece as a target under `all` and not under
   `movable_only`. Combat resolution is reached unchanged: rank, equal rank and
   the formation bonus apply as they already do, a Tower attack is a partial
   sacrifice by whatever direction it arrives from, and capturing the Flag ends
   the game however it was reached.
3. **`DIAGONAL_ATTACK_PATH` in the rules.** Under `open_path`, a diagonal
   attack additionally requires at least one flanking square to be both
   unoccupied and not a lake; under `always`, no such check. The two flanking
   squares are derived geometrically from attacker and target, never enumerated
   per board.
4. **The two flags compose.** All four combinations behave as the union of the
   two independent rules — `all` widens the target set, `open_path` narrows the
   legal paths, and neither reads the other.
5. **The configuration threaded wherever the rules are judged.** Movement,
   attack generation, "no legal move" detection in `outcome.ts`, and replay all
   see the same configuration the game claims to be played under. A flag read
   in one path and ignored in another is the exact drift the companion
   repository's "known gap" note warns is unmeasured — the app must not create
   an instance of it.
6. **The new-game screen.** Two flag choices alongside the game choice, plainly
   worded, keyboard and screen-reader equivalent to the mouse path, matching
   the established patterns on that screen. Selection is remembered for the
   next game of the session and not beyond it.
7. **Records: writing.** A finished game's `Ruleset` tag is the edition id plus
   alphabetically ordered `FLAG=value` tokens for deviating flags only. On the
   standard values it is byte-identical to what the app writes today.
8. **Records: reading.** The reviewer parses a `Ruleset` tag into an edition id
   and flag tokens, canonicalizes it, and replays the record under the
   resulting configuration — so a game played with a flag on replays under that
   flag. ~~A tag naming an unknown flag id, an unknown value for a known flag,
   or a malformed token is **rejected with a message that says which token was
   not understood**, never silently ignored.~~ **Amended 2026-08-04:** a tag
   naming an unknown flag id, an unknown value for a known flag, a malformed
   token or a repeated flag is instead carried as an unrecognised token and
   named to the reviewer, and never rejects the record; the edition id is the
   only part of the tag that can reject one. Rejection was originally
   required and was reversed at Step 9's manual gate on the owner's finding,
   because the companion repository's `technical-notes.md` guarantees
   view-only replay for every record forever with no rules knowledge
   required — see the implementation plan's Step 10.
9. **The reviewer shows what was played.** A record's non-standard flags are
   visible while reviewing it, in plain language. Without this, a diagonal
   capture of a Flag looks like a bug.
10. **Everything keeps working, accessibly.** A hot-seat game on any flag
    combination — choose, place, play, end, dump the record, re-import it — is
    playable throughout the story, each step verified and committed per the
    standard pipeline.

## Design decisions & constraints

- **This deliberately reverses a constraint from story 00000025.** That story
  fixed "no variant framework" and "the app plays published editions only,
  offering no variant as a player-selectable setting." Being the testing ground
  for a proposed flag is incompatible with both, and the owner has decided in
  favor of the testing ground. The framework should be built to the size of two
  flags, though — a resolution rule and a stamp, not a general settings engine.
- **The default path must be untouched, and demonstrably so.** Both flags
  default to current behavior, so a game on the standard values plays
  identically and records identically to one played before this story. The
  existing record fixtures should keep passing unchanged; that is the cheapest
  honest evidence for this claim.
- **Deviating flags are what the model stores; resolved values are what the
  rules read.** The distinction matters in both directions — the stamp must
  omit a flag at its resolved value, and a reader must accept a stamp that
  redundantly names one.
- **The flanking-square rule is geometry, not a table.** For an attack from
  `(c, r)` to `(c±1, r±1)`, the flanks are `(c±1, r)` and `(c, r±1)`. Derived,
  never hardcoded per layout, so it holds on any board the notation can
  describe.
- **`open_path` interacts with the existing "skirt" case.** A diagonal past a
  single lake corner has one open flank and stays legal; today's code checks
  only that the target square is not a lake, and that check must survive
  unchanged. A future layout could make the double-lake squeeze reachable, at
  which point `open_path` already answers it — but neither published board can
  produce one, so this is a note, not a requirement.
- **`all` changes how a game can end.** The Flag becoming diagonally capturable
  is a real change to the game's terminal conditions, not only to attack
  generation. Anything that reasons about the Flag's safety, warns about it, or
  detects the end of a game must be checked against it rather than assumed.
- **`open_path` reaches "no legal move", but barely.** `hasAnyLegalPly` is
  built on `legalAttacks`, so narrowing diagonal attacks narrows the stuck
  test — but orthogonal moves and attacks are untouched, so a side only becomes
  stuck if its **last** movable piece is boxed in orthogonally by edges, lakes
  and its own immobile pieces (needing both a Tower and the Flag, since two
  Towers can never touch), with every friendly neighbor likewise having no ply.
  Any orthogonally adjacent enemy is always an attack, so the case is a corner
  of a corner. Thread the flag through `hasAnyLegalPly` for correctness, but do
  not design around this scenario or spend plan budget on it.
- **Flag identifiers may still change.** They are permanent only on graduation
  to Appendix A. `proposed-variants.md` asks that they be chosen as if already
  permanent, so the risk is low and the identifiers are used as written — but
  they belong in one place in the code, not spread across it, so a rename is
  a small edit.
- **The engine's diagonal throw is untouched.** `src/engine/search.ts` and
  `src/encoding/eng-nn-1/` already reject diagonal plies, which is why computer
  play is disabled for all of major 2. These flags neither worsen nor fix that.

## Out of scope

- **Computer play under any flag combination**, and re-enabling computer play
  at all — still needs a new engine spec, re-encoding, and retraining. The
  start-screen option stays visible and disabled.
- **Graduating either flag**, publishing a new edition, or any change to
  `2-0:BATTLE`, `2-1:SKIRMISH` or `2-0:SKIRMISH`. Editions are the companion
  repository's to publish; this story adds no edition and changes none.
- **Any flag beyond these two**, and any general settings or variants system
  beyond what these two need.
- **Changes to placement, movement, orthogonal attacks, combat resolution, the
  formation bonus, or the notation** — the flags reach attack _generation_ and
  nothing else.
- **Saving a played game to a file**, and the follow-up items parked in
  `doc/plan/proposed-stories/rules-2-0-edition-experience-and-records.md`.

## Manual-verification gates

- **Gate A — Standard values are unchanged.** A Battle game and a Skirmish game
  on the standard settings place, play and end exactly as before, and their
  records read `2-0:BATTLE` and `2-1:SKIRMISH` with no flag tokens.
- **Gate B — `DIAGONAL_ATTACKABLE=all`.** A numbered piece diagonally adjacent
  to an enemy Tower can attack it, and the attack resolves as a partial
  sacrifice; a piece diagonally adjacent to the enemy Flag can capture it and
  the game ends as a Flag capture. On the standard value, both are refused, as
  today.
- **Gate C — `DIAGONAL_ATTACK_PATH=open_path`.** A diagonal attack with both
  flanking squares occupied is refused; freeing either one makes it legal
  again. A diagonal past a single lake corner is still legal. On the standard
  value, all of these are legal regardless of the flanks.
- **Gate D — Both flags together.** A game with both set to their alternatives
  behaves as the combination of Gates B and C, and records
  `DIAGONAL_ATTACKABLE=all DIAGONAL_ATTACK_PATH=open_path` in that order.
- **Gate E — Records round-trip.** A finished game on non-standard flags dumps
  a record whose `Ruleset` tag names them, and re-importing that dump into the
  reviewer replays it end to end under those flags, with the non-standard rules
  visible while reviewing. ~~A record naming an unknown flag is refused with a
  message naming the token.~~ **Amended 2026-08-04:** a tag naming an unknown
  flag id, an unknown value for a known flag, a malformed token or a repeated
  flag is instead carried as an unrecognised token and named to the reviewer,
  and never rejects the record; the edition id is the only part of the tag
  that can reject one. Rejection was originally required and was reversed at
  Step 9's manual gate on the owner's finding, because the companion
  repository's `technical-notes.md` guarantees view-only replay for every
  record forever with no rules knowledge required — see the implementation
  plan's Step 10.
- **Gate F — The new-game screen.** The flag choices are understandable without
  knowing the flag identifiers; returning to the screen after a game
  pre-selects both the game and the flags just played; reloading the page
  returns to the standard values.
- **Gate G — Accessibility.** With the mouse put away, choosing a game and both
  flag values, then playing a diagonal attack that only one flag combination
  permits, is workable by keyboard alone with the screen reader announcing the
  choices and their current state.

## Open items to resolve at plan time

- **How the configuration is modeled** — whether a flag set hangs off `Edition`
  as an overlay type, replaces `Edition` in game-state artifacts with a
  configuration that contains it, or something else; and how far it has to be
  threaded before the seam gets ugly, given that most rule functions currently
  take a `BoardLayout` rather than an `Edition`.
- **How the configuration reaches `legalAttacks`**, which today takes
  `layout: BoardLayout = BATTLE_LAYOUT` and is called from several places. The
  default-parameter pattern is convenient and is exactly how a flag comes to be
  read in one path and ignored in another; whether it survives is a plan-time
  call.
- **The player-facing wording of both choices**, given they must be plain,
  unframed, and free of flag identifiers — including whether each choice names
  its standard value as the standard one.
- **How the new-game screen accommodates two more choices** without becoming a
  settings form, and how the per-game descriptions interact with them.
- **How a reviewed record's flags are surfaced**, and whether the same
  treatment serves the in-progress record view in `GameRecord.tsx`.
- **Where `Ruleset` tag rendering and parsing live**, and how the new rejection
  cases fit `recordFile.ts`'s existing error model and `readRecord.ts`'s
  `unknownRuleset`.
- **What test fixtures are needed** for each flag and for the combination,
  including at least one record per non-standard configuration, and a
  canonicalization case (a stamp naming a flag at its resolved value).
- **Whether `README.md` needs updating**, given the new-game screen now offers
  choices a player will meet immediately.
- **The step decomposition** that keeps the app green at every commit — likely
  the configuration model first, then each flag in the rules with its tests,
  then the stamp (write and read), then the new-game screen, then the
  reviewer's display.
