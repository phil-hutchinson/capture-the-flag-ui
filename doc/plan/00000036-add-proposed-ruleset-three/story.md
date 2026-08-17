# Story 00000036 — Add proposed ruleset three

## Summary

The companion project has **proposed a whole new ruleset major**. Where every
proposal this app has tested so far was a setting inside the major-2 rules
text — a board, an army, a diagonal-attack flag — major 3 is a different rules
text entirely: an 8 × 8 open board, a generated starting position with no
placement phase at all, five ranks numbered the other way round, and a piece
that **loses a rank every time it survives a fight**.

**This app becomes the testing ground for it**, exactly as it did for the
diagonal-attack flags (story 00000027) and for Clash (story 00000030). A
player starting a hot-seat game picks it the way they already pick Battle,
Skirmish or Clash, and plays a real game under it.

This is also the first story in which **this repository's ruleset division
does the job it was built for.** Every previous rules change either extended
major 2 or — once, with explicit owner authorization (story 00000023, Step 8)
— replaced major 1 outright. Major 3 does neither: `src/rules/primary/v2/`
stays exactly as it is, byte for byte, and a new `src/rules/primary/v3/` is
built beside it. **Two rule majors are live in the same app at the same
time**, and the shared surfaces above them — the board, the art, the
announcements, the game picker — have to serve both without either one
bending to fit the other.

What a player will notice:

- **A fourth game on the "Choose a game" screen**, named **Demotion**,
  described as: _"Play on an 8x8 fixed board. When a piece wins a battle, it
  is demoted one rank."_ Offered in the same plain language as the other
  three, with no "experimental" or "proposed" framing — the whole game is
  pre-release and all of it gets equal billing.
- **No army to set up.** Choosing Demotion goes straight to play. There is no
  placement phase, no tray, no hand-off between players before the first move:
  both armies are already on the board, in full view, generated fresh for the
  game.
- **A board with nothing on it but pieces.** No lakes, no lanes, no buffer
  rows, no Towers. Rows 1–2 and 7–8 start completely full; rows 3–6 are empty.
- **Pieces that get weaker as they win.** A piece that survives a fight —
  attacker or defender — is immediately reduced one rank, permanently. A rank
  5 that wins is a rank 4 from then on, in every respect.
- **Rank 5 is the strongest, not rank 1.** The numbering runs the opposite way
  to every other game in this app.
- **A new way to end a game: resignation.** A player may concede at any point;
  the opponent wins immediately, with no acceptance needed.

## Background & references

- `doc/ruleset/rules.md` in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository is the single source of truth for the published rules and is not
  restated here. **Nothing in it changes for this story.** `2-0:BATTLE`,
  `2-0:CLASH` and `2-1:SKIRMISH` are untouched, at the same majors and minors,
  with the same boards, armies and rules text.
- **Major 3 is specified in that repository's `doc/ruleset/proposed-3/`
  folder** (its story 00000046, merged 2026-08-16), not in `rules.md`. That
  folder's own terms: nothing in it is published, nothing outside it may
  depend on it, and if the proposal is abandoned the folder is deleted and
  nothing breaks. Its four documents are:
  - `rules.md` — the complete proposed ruleset, self-contained and
    player-facing. Does not require reading the major-2 rules first.
  - `start-position.md` — how a starting position is generated and how a
    position ID encodes one. The implementer's copy of Section 3.
  - `changelog.md` — the entry major 3 _would_ publish, written as the delta
    from major 2. The most useful single document for this story.
  - `technical-notes.md` — design rationale and consumer-facing hazards. Not
    needed to implement anything.

  **A pinned copy of all four, plus the folder's own README, sits in
  `reference/` beside this story** — the version this story was written
  against, at companion commit `b3c3202`. It is a snapshot for the pipeline's
  cold-context agents to read, never a source of truth and never edited; see
  `reference/SNAPSHOT.md`. Major 3 is a live draft, so the companion
  repository may already have moved on.

- **The proposed edition is `3-0:PRE-RELEASE`**, and major 3 **publishes no
  rule settings at all** — no `BOARD_LAYOUT`, no `ARMY_COMPOSITION`, no
  `TOWER_PLACEMENT`, nothing. The edition is defined entirely by its rules
  text, and its `Ruleset` tag always renders as a bare edition id with no
  deviations. `PRE-RELEASE` is explicitly a **working name**, reusing a name
  already retired at major 1.

### The rules, in the shape this app needs them

Numbers below are section references into `proposed-3/rules.md`.

**Board (§2.1).** 8 × 8, every square open. No lakes, no lanes, no buffer
rows, no impassable terrain of any kind. Rows 1–2 are White's home rows, rows
7–8 Black's, rows 3–6 open ground. Each home area is 16 squares — exactly one
army — so both fill completely at the start. Columns A–H, rows 1–8, row 1
White's back row. The left half (A–D) and right half (E–H) matter **only**
when generating the starting position and have no meaning during play.

**Pieces (§2.2).** 15 numbered pieces and one Flag, 16 in all:

| Rank | Qty | Name           |
| ---- | --- | -------------- |
| 5    | 3   | Master-of-Arms |
| 4    | 3   | Champion       |
| 3    | 3   | Foot Soldier   |
| 2    | 3   | Militia        |
| 1    | 3   | Peasant        |
| —    | 1   | Flag           |

**Rank 5 is strongest, rank 1 weakest.** No Towers — the piece type does not
exist at major 3. The Flag cannot move or attack but can be attacked. Every
numbered piece follows the same rules; none has a special ability. The rules
state explicitly that **the number is the rule and the name is decoration**,
and that names may change without changing the game.

**Starting position (§3, and `start-position.md`).** No placement phase.

- White's 16 pieces fill rows 1–2, with one restriction: **the Flag must stand
  on row 1**. Every arrangement satisfying that is equally likely —
  1,345,344,000 of them.
- Black's army is White's, turned. **Sum the ranks of the seven numbered
  pieces in the same half of the board as White's Flag**, call it `S`:
  - `S ≥ 22` — **half-turn** (180°): column `c` → `9 − c`, row `r` → `9 − r`.
    The Flags end up in opposite halves.
  - `S ≤ 21` — **reflection**: column unchanged, row `r` → `9 − r`. The Flags
    end up in the same column, facing each other.
- The threshold is **derived, not fundamental**: `S × 15 > 7 × 45 ⟺ S > 21`.
  It is correct only for three each of ranks 1–5 and must be recomputed if the
  army ever changes.
- Both branches produce an even position; what the rule chooses is that each
  Flag faces the _weaker_ part of the enemy army either way.
- Because both home areas start full and the Flag is confined to row 1, **only
  front-row pieces can move and only forwards** — White always has exactly 8
  legal opening moves, in every generated position.
- Mirror-equivalent positions are **deliberately not collapsed**: an
  arrangement and its left–right mirror play identically, but merging them
  would bias every game's Flag to one side of the board.

**Position ID (`start-position.md` §5).** A **16-character uppercase
hexadecimal string** spelling White's 16 squares in a fixed order — row 1 A→H,
then row 2 A→H — one digit per square (`1`–`5` a rank, `F` the Flag, `0`
empty). Carried in an optional `[StartPosition "…"]` header tag; redundant for
replay, so a reader must never require it. **It is a string, never a number**
— 16 hex digits is 64 bits, past the 2⁵³ limit within which a JavaScript
`Number` holds integers exactly, so parsing one into a `Number` corrupts it
silently. A reader must **validate, not merely decode** (exactly three each of
`1`–`5`, exactly one `F`, that `F` among the first eight characters), and a
position must **never** be generated by drawing a random code — only about
7 × 10⁻¹¹ of expressible codes are positions.

**Movement (§4.2).**

- One square orthogonally, into an empty square or onto an enemy to attack.
- **Two squares in a straight orthogonal line** if the piece is _unencumbered
  in the direction it is moving_ and the square passed through is empty. May
  attack on the far square.
- **Encumbrance is direction-relative**: a piece is encumbered for a given
  direction if an enemy stands on any of the **five squares ahead of or beside
  it** in that direction (for a move north: NW, N, NE, W, E). The **three
  squares behind do not encumber**. Judged only from where the piece stands
  when the move begins — what stands near the destination is irrelevant. The
  same piece may be free two squares one way and restricted one square
  another. _(Major 2 encumbered on any of the eight surrounding squares, in
  every direction.)_
- No two-square diagonal move and no two-square diagonal attack. A piece may
  never step diagonally onto an empty square.
- The Flag never moves. No piece may move onto a friendly piece.
- **White's first move of the game is limited to one square** (§4.1). Every
  other move follows the ordinary rules.
- **Passing is never allowed**, and never needs to be: a player with at least
  one numbered piece always has a legal move, and a player with none has
  already lost.

**Combat (§4.3).** Higher rank wins and the loser is removed; equal ranks
draw and both are removed; the winner advances. **Formation bonus**: a
friendly piece of equal rank within one square (orthogonal or diagonal) lets a
piece **draw** against a piece one rank stronger instead of losing — checked
for the attacker before its move and for the defender at the moment it is
attacked. Any piece may attack any enemy it can reach regardless of relative
strength (**sacrificial attacks** are always legal).

**Rank reduction (§4.3).** **Any piece that survives combat is immediately
reduced by one rank** — attacker and defender alike. Permanent and total: it
fights as the lower rank, forms up with the lower rank, and is written as the
lower rank. Three consequences the rules state outright:

- A **draw reduces nothing**, because it leaves no survivor.
- **No piece can be reduced below rank 1** — a rank 1 draws against a rank 1
  and loses to everything stronger, so under the rules as written it never
  survives combat and the case never arises.
- **Capturing the Flag is not combat**, so the capturing piece is not reduced.

A consequence for this app: **rank is mutable game state**, not a fixed
property of a token, and **formations must be recomputed after every combat**
because a reduced piece may gain or lose one.

**Diagonal attacks (§4.4).** One square diagonally, attack only. **Any enemy
piece may be attacked diagonally, the Flag included** — the Flag has no
immunity and may be captured from a diagonal. **An open path is required**: at
least one of the two squares orthogonally adjacent to _both_ attacker and
target must be **empty** (a piece on C3 attacking D4 needs C4 or D3 empty);
occupied by either side counts as blocked. This is what gives a Flag its
defence — pieces packed orthogonally around it close the diagonals into it.

**Notation (§4.5).** From-square, `-`, to-square, with two possible marks
placed immediately after a square, both describing the piece that was standing
there **when the move began**: `x` (did not survive) and **`=N` (survived and
is now rank `N`)**. In any move involving combat **each of the two squares
carries exactly one mark — never both, never neither**, which is a usable
assertion. Consequently `A2-A4x` (one square marked, the other not) **always**
means a Flag capture.

```
A2-A4      no combat
A2=3-A4x   attacker won; defender removed; attacker now rank 3
A2x-A4=2   attacker lost; defender survived and is now rank 2
A2x-A4x    both removed
A2-A4x     Flag captured (capturing the Flag is not combat)
```

The simplified form `A2A4` remains available for _entering_ a move in a text
interface but is **never valid in a record**, since it cannot carry `=N`.

**Ending the game (§5).** Checked after **every** move, including the
opponent's.

- **Win — Flag capture**, orthogonally or diagonally.
- **Loss — Attrition**: a player left with **no numbered pieces** loses
  immediately. The Flag does not count. _(Replaces major 2's "no legal move",
  and is checked after every ply rather than at the start of a turn.)_
- **Draw — Mutual attrition**: one move leaving **both** players with no
  numbered pieces. Neither is credited for having moved last.
- **Draw — Inactivity**: a counter from 0, +1 on every move that removes no
  piece, reset to 0 by any removal; **a draw at 40**. _(Major 2's limit is
  50.)_ A move that only reduces a rank without removing anything cannot
  occur.
- **Loss — Resignation**: a player concedes at any point and the opponent wins
  immediately. Not an offer — needs no acceptance, cannot be declined, and no
  position prevents it. Like a draw by agreement, it is a **decisive result
  that cannot be derived from the position**.
- **Draw — by agreement**: unchanged from major 2.

### Two silent breakages the proposal calls out by name

Both are quoted here because they produce a _wrong board_ rather than an
error, and both land squarely on this app.

1. **Rank numbering is reversed, and piece names are reused at different
   ranks.** At major 2 rank 1 is strongest; at major 3 rank 5 is. And "Foot
   Soldier" is rank 5 in Battle and rank **3** here; "Militia" is rank 6 there
   and rank **2** here. A consumer keying artwork or strength off a **name**
   survives Master-of-Arms and Champion and is wrong on the other two; one
   keying off a **digit** alone is wrong on all four. The proposal's
   instruction is explicit: **key off the pair `(major, rank digit)`, never
   off a name and never off a digit alone.**

   | Name           | Rank in `2-0:BATTLE` | Rank in `3-0:PRE-RELEASE` |
   | -------------- | -------------------- | ------------------------- |
   | Master-of-Arms | 1 (strongest)        | 5 (strongest)             |
   | Champion       | 2                    | 4                         |
   | Knight         | 3                    | _not in this army_        |
   | Halberdier     | 4                    | _not in this army_        |
   | Foot Soldier   | 5                    | 3                         |
   | Militia        | 6 (weakest)          | 2                         |
   | Peasant        | _did not exist_      | 1 (weakest)               |

2. **A position ID is a string.** See above — parsing one into a JavaScript
   `Number` corrupts it silently, and this is a front-end repository.

### Relevant code today

- `src/rules/primary/v2/` — the entire major-2 rule engine, 17 modules:
  `board.ts`, `boardLayout.ts`, `armyComposition.ts`, `pieces.ts`,
  `edition.ts`, `ruleFlags.ts`, `configuration.ts`, `games.ts`,
  `placement.ts`, `movement.ts`, `combat.ts`, `outcome.ts`, `gameState.ts`,
  `play.ts`, `notation.ts`, `recordFile.ts`, `replay.ts`. **None of it is
  touched by this story.**
- `src/rules/readRecord.ts` — the version-dispatch entry point for reading a
  record. Its own header already anticipates this story: _"A future ruleset
  version adds a case here rather than editing an existing one."_ Today it
  treats the `Ruleset` tag's first token as a major-2 edition id and rejects
  anything else as `unknownRuleset`.
- `src/board/` — every play surface, and the co-existence problem. `Board.tsx`,
  `FullBoard.tsx`, `PlayBoard.tsx`, `PlayStatus.tsx`, `GameResult.tsx`,
  `DrawOffer.tsx`, `playSession.ts`, `playAnnouncement.ts`, `playWarnings.ts`,
  `gameNames.ts`, `GameChoice.tsx`, `ruleChoices.ts` and `HotSeatGame.tsx` all
  import major-2 types (`Side`, `Square`, `BoardLayout`, `PieceTypeId`,
  `RuleConfiguration`, `PlayState`) **directly**.
- `src/board/HotSeatGame.tsx` (~1100 lines) — game choice, then placement,
  then play, as three branches of one component with a persistent `<h1>` and
  two live regions threaded across all three.
- `src/board/GameChoice.tsx` — the picker. `GAME_DETAIL` and `gameOrderRank`
  are exhaustive over `games.ts`'s `GameId` (`"battle" | "skirmish" |
"clash"`), a major-2 type; the "Diagonal attacks" rule-choice section sits
  between the selected game's description and the "Play" button.
- `src/board/gameNames.ts` — `gameName`, `gameNameForConfiguration`,
  `boardSizeDescription`, `defaultGameId`, `reviewedGameLine`, all keyed off a
  major-2 `GameId` or `RuleConfiguration`.
- `src/board/playWarnings.ts` — the countdown to the inactivity draw, against
  `outcome.ts`'s `INACTIVITY_LIMIT = 50`.
- `src/art/PieceIcon.tsx`, `src/art/pieceSprites.svg` — `PieceIcon` takes a
  major-2 `PieceTypeId` and a major-2 `Side`, maps the type to one of eight
  symbol ids, and overlays the piece's **position-block symbol** as a corner
  numeral. Four sprites from major 1 (`p-archer`, `p-assassin`, `p-sapper`,
  `p-skirmisher`) are still in the sheet, unreferenced.
- `src/board/grid/AccessibleGrid.tsx`, `gridNavigation.ts` — already
  dimension-parametric and, on the face of it, major-agnostic.
- `src/App.tsx` — the screen union, and `lastPlayedConfiguration`, typed as a
  major-2 `RuleConfiguration`, which outlives every screen change.
- `src/app/rules/` — the "How to play" primer (`rulesCopy.ts`, `figures.ts`,
  `RulesScreen.tsx`), written entirely for major 2.
- `src/featureVisibility.ts` — constants only, no logic. "Play against the
  computer", "Review a game" and the developer record dump are all currently
  hidden.
- `src/engine/`, `src/encoding/eng-nn-1/` — the computer player, hardwired to
  12 × 12 and Battle, non-functional today. Untouched.

## Policy (fixed by the owner)

- **Demotion is a fourth game, with equal billing.** It appears on the "Choose
  a game" screen alongside Skirmish, Clash and Battle, described in the same
  plain language, with **no** "experimental", "proposed" or "pre-release"
  marking of any kind — matching how Clash and the diagonal-attack choices are
  already presented.
- **The player-facing name is "Demotion"**, and its description is exactly:
  _"Play on an 8x8 fixed board. When a piece wins a battle, it is demoted one
  rank."_
- **Selecting Demotion hides the "Diagonal attacks" rule choices.** The four
  game buttons stay visible so a player can switch back; the rule-choice
  section below them is not rendered, because major 3 publishes no rule
  settings and both diagonal behaviours are fixed by its rules text. The
  section returns as soon as one of the other three games is selected.
- **No placement screen for Demotion.** Choosing it goes straight to play from
  the generated starting position. The placement phase does not apply and must
  not be shown, not even briefly.
- **Major 2 does not change — at all.** `src/rules/primary/v2/` is not edited.
  Battle, Skirmish and Clash place, play, end and record byte-for-byte as they
  do today, and their tests and fixtures pass unchanged and unedited.
- **Major 3 lives in its own version folder.** This is the ruleset division
  being used as designed: a new major means new rule logic alongside the old,
  never a rewrite of what recorded games depend on.
- **Human vs. human only.** Computer play stays exactly as it is (hidden,
  Battle-only, 12 × 12). Demotion is not offered against the computer and no
  engine work is in scope.
- **This app publishes nothing.** `3-0:PRE-RELEASE` is the companion
  repository's proposed edition id, used as written. This app does not invent
  an edition id, graduate anything, or claim a name.

## Players and colors

Unchanged: first player = White = red (`#a13d2b`); second player = Black =
blue (`#33526b`). Player-facing surfaces name the sides by color and use the
word "move", never "ply".

The four games are named to players as **Skirmish**, **Clash**, **Battle** and
**Demotion**. Edition ids, flag identifiers and value tokens are never shown to
a player: `3-0:PRE-RELEASE` is a record tag, not UI copy.

Piece names at major 3 are **Master-of-Arms, Champion, Foot Soldier, Militia,
Peasant** — used as the rules write them, and understood as decoration over the
rank number, which is what actually governs.

## In scope

1. **A major-3 rule engine at `src/rules/primary/v3/`**, built from
   `proposed-3/rules.md` and `proposed-3/start-position.md` alone and not by
   copying and editing major 2. It covers: the fixed 8 × 8 open board; the
   five-rank, 16-piece army with rank 5 strongest; starting-position
   generation including the `S ≥ 22` strength rule; the position ID's
   encoding, decoding and validation, as a string; movement including the
   direction-relative two-square move and White's one-square first move;
   diagonal attacks on any piece including the Flag, with the open-path
   restriction; combat with the formation bonus and rank reduction; and every
   ending condition — Flag capture, attrition, mutual attrition, inactivity at
   40, resignation and draw by agreement.
2. **Rank as mutable state.** A piece on the board is a side and a _current_
   rank that changes during the game. Nothing may treat rank as a fixed
   property of a token, and formations must be evaluated against current ranks
   after every combat.
3. **A single edition, no configuration machinery.** `3-0:PRE-RELEASE` is the
   only edition, major 3 has no rule settings, and the v3 folder gets no flag
   catalog, no `configuration.ts` and no `games.ts` — there is nothing for
   them to vary. The edition id is spelled in exactly one place, since
   `PRE-RELEASE` is a working name that may change.
4. **Demotion as a playable game, end to end.** A hot-seat Demotion game
   generates a starting position, plays by keyboard and mouse, and ends by
   every route the rules describe — Flag capture, attrition, mutual attrition,
   inactivity, resignation and agreed draw — with the result announced
   correctly in each case.
5. **The picker offers four games.** "Demotion" appears with its copy above,
   in a settled display order, and selecting it hides the "Diagonal attacks"
   section. Session stickiness (`defaultGameId` — the picker pre-selects the
   game just played) must keep working across a major boundary.
6. **A game identity that spans majors.** `GameId`, `GAME_DETAIL`,
   `gameOrderRank`, `gameName` and `defaultGameId` are all keyed off major
   2's `GameId` today, and `App.tsx`'s `lastPlayedConfiguration` is a major-2
   `RuleConfiguration`. A game the app offers must be identifiable
   independently of which major it belongs to, without either major's types
   leaking into the other's.
7. **Shared surfaces serve both majors.** The board grid, the piece art, the
   status line, the announcements, the result panel, the draw offer, the
   flip-board toggle and the leave-game confirmation all work for a Demotion
   game without major 2's own behaviour changing in any way.
8. **Piece art keyed by `(major, rank)`.** `PieceIcon` cannot keep taking a
   major-2 `PieceTypeId`. Artwork and the corner numeral must be chosen from
   the major _and_ the current rank digit — never from a name, never from a
   digit alone — and the numeral must follow a piece as it is demoted.
9. **A resign control.** New to this app: available to the player to move at
   any point in a Demotion game, needing no acceptance, clearly distinct from
   the existing draw offer, and reachable by keyboard.
10. **The inactivity countdown at 40.** `playWarnings.ts` counts toward major
    2's limit of 50; a Demotion game must warn against its own limit.
11. **Move text in the extended form.** Anywhere this app renders a move for
    a Demotion game — announcements, and the developer record dump if shown —
    it uses the extended notation with `x` and `=N`, never the simplified
    form.
12. **Everything keeps working, accessibly.** A Demotion game is fully
    playable by keyboard alone with a screen reader, including the two things
    that are new to announce: a piece's rank _changing_ mid-game, and a game
    that begins already in progress with no placement to orient the player.

## Design decisions & constraints

- **The version wall is the point, and it cuts both ways.** `v3` must not
  import from `v2`, and `v2` must not learn about `v3`. Types that look
  identical across the two (`Side`, `Square`, `squareKey`) are cheaper to
  restate inside `v3` than to hoist into a shared module, and hoisting them
  would mean editing `v2`, which Policy forbids. Where the two majors have to
  meet, they meet **above** the rules layer, not inside it.
- **The shared UI is the story's main technical risk.** `src/board/` imports
  major-2 types directly, everywhere. The two honest options are (a) a
  parallel set of v3 play surfaces, duplicating a lot of accessible board code
  that has been carefully built up over four stories, or (b) a small
  major-agnostic view layer that both majors adapt onto — board dimensions and
  terrain, a token as side + rank + label, actionable and target squares,
  status and announcement text, and the actions currently available. **(b) is
  the recommended direction**, extracted only as far as Demotion actually
  needs, with major 2 adapted onto it rather than rewritten beneath it. The
  exact seam is a plan-time call.
- **Rank reduction is the deepest new idea, and it is not a display concern.**
  Every existing rule module treats a piece's identity as fixed. Legal-move
  generation, the formation bonus, attack resolution, the tray-free board
  state and every announcement have to read _current_ rank. This is the single
  most likely source of a bug that looks like a rendering glitch and is
  actually a rules error.
- **`(major, rank digit)` is the keying rule, and the proposal is emphatic
  about it.** Reusing sprites by piece _name_ across majors is precisely the
  mistake the companion project's README warns produces a wrong board with no
  error. Master-of-Arms and Champion happen to keep their place in the
  strength order; Foot Soldier and Militia do not.
- **The sprites are settled** (owner decision at story time). Ranks 2–5 reuse
  the sprite already drawn for the piece of that name at major 2 —
  Master-of-Arms `p-marshal`, Champion `p-champion`, Foot Soldier
  `p-infantry`, Militia `p-militia` — and the Flag reuses `p-flag`. **Rank 1,
  the Peasant, uses `p-sapper`**, one of the four unreferenced major-1 sprites
  still in the sheet: it draws a spade, which reads as well for a peasant as
  for a sapper. `p-tower`, `p-knight` and `p-halberdier` are not used at major 3.

  Note what this is and is not. Four of the five sprites are shared with major
  2 **by name**, because the artwork suits the name — but they are _keyed_ by
  `(major, rank digit)`, and for two of them the digit differs between majors
  (Foot Soldier is rank 5 at major 2 and rank 3 here; Militia is 6 and 2).
  Sharing a drawing is fine; sharing a lookup key is the silent breakage the
  companion project warns about.

- **The generated position replaces a phase, not just a screen.** Removing
  placement removes the hand-off between players, the tray, the auto-fill, the
  Confirm flow, and the focus and announcement choreography built around them.
  A Demotion game starts at what is currently the _second_ branch of
  `HotSeatGame`, and the persistent heading and live regions still have to be
  registered before anything speaks.
- **Generation must be uniform, and must not be done through the ID.** Place
  the Flag uniformly on row 1, then shuffle the 15 numbered pieces uniformly
  into the remaining 15 squares. Drawing a random ID and validating it is
  specifically ruled out — the encoding is ~7 × 10⁻¹¹ dense. Mirror-equivalent
  positions are not collapsed.
- **The `S ≥ 22` threshold is derived and must be written as such.** `S × 15 >
7 × 45`. Hard-coding 22 with no note is exactly what the proposal warns
  against for the day the army changes.
- **A position ID is a 16-character uppercase string, and validation is
  separate from decoding.** No `Number` anywhere near it.
- **A rank 1 never demotes.** The rules argue the case cannot arise — a rank 1
  draws against a rank 1 and loses to everything stronger, so it never
  survives combat — but the engine should not depend on that argument holding.
  Rank reduction stops at rank 1 explicitly, so that if the scenario ever does
  arise (a later rule change, or a bug elsewhere in combat resolution) the
  result is a rank 1 rather than a rank 0 propagating through the board state
  (owner decision at story time).
- **Nothing here is a rule setting.** Resisting the urge to model major 3's
  differences as major-2 flags is deliberate: they are a different rules text,
  and the companion project models them that way.
- **`PRE-RELEASE` is a working name, and reuses a retired major-1 name.** It
  belongs in one constant so a rename stays a one-line edit.

## Out of scope

- **Reading or writing major-3 record files** (owner decision at story time:
  play only for now). `readRecord.ts` stays major-2-only, and no major-3
  `recordFile.ts` or `replay.ts` is built. The `[StartPosition "…"]` header
  tag, the position block's major-3 alphabet, and importing a `3-0:PRE-RELEASE`
  record into the reviewer are all a **follow-up story** — as is the
  major-level dispatch (`3-*` → the v3 reader) that `readRecord.ts`'s header
  already anticipates.
- **Computer play on Demotion**, and any change to computer play at all.
- **The "How to play" primer.** `src/app/rules/` describes major 2 and is left
  describing major 2; a major-3 primer is a follow-up.
- **Any change to `src/rules/primary/v2/`**, to Battle, Skirmish or Clash, or
  to any existing record or fixture.
- **Publishing or graduating anything**, inventing an edition id, or acting on
  the `2-0:CLASH` edition the companion project has since published (this app
  still stamps Clash as `2-0:BATTLE` plus two deviating flags — a real
  divergence, but a major-2 concern and its own story).
- **Rule settings for major 3**, including re-opening the diagonal-attack
  flags, which do not exist at this major.
- **Saving a played game to a file**, and the items parked in
  `doc/plan/proposed-stories/`.

## Manual-verification gates

- **Gate A — The other three games are untouched.** A Battle, a Skirmish and a
  Clash game each choose, place, play and end exactly as before, with the
  diagonal-attack choices offered and applied as they are today.
- **Gate B — The picker.** Four games are offered; selecting Demotion shows
  its description and hides the "Diagonal attacks" section; selecting any
  other game brings the section straight back with its previous selections
  intact; "Play" starts the right game in each case; and returning to the
  picker after a Demotion game pre-selects Demotion.
- **Gate C — The starting position.** Choosing Demotion goes straight to an
  8 × 8 board with no placement step. Rows 1–2 and 7–8 are completely full,
  rows 3–6 empty, no lakes anywhere. White's Flag is on row 1. The two armies
  are congruent — a half-turn or a reflection of each other — and White has
  exactly 8 legal opening moves, each of one square. Starting several games
  gives visibly different arrangements, with both turn branches appearing over
  a handful of games.
- **Gate D — Movement.** One-square orthogonal moves work everywhere;
  White's first move is refused beyond one square and unrestricted thereafter;
  a two-square move is allowed only through an empty square and only when
  unencumbered _in that direction_ — demonstrably free forwards with an enemy
  behind, and restricted with an enemy ahead or beside; no diagonal move onto
  an empty square.
- **Gate E — Combat and demotion.** A stronger piece beats a weaker one and is
  **shown at one rank lower** afterwards, artwork and numeral both; equal
  ranks trade; the formation bonus turns a loss against a one-stronger piece
  into a trade; a defender that survives is likewise demoted; a demoted piece
  fights and forms up at its new rank for the rest of the game.
- **Gate F — Diagonal attacks.** A diagonal attack succeeds when one of the
  two flanking squares is empty and is refused when both are occupied — by
  friendly pieces as well as enemy ones. **The Flag can be captured
  diagonally**, and a Flag with both diagonals closed cannot.
- **Gate G — Every ending.** Flag capture, attrition (a player reduced to a
  Flag alone loses immediately, mid-move-pair), mutual attrition as a draw,
  the inactivity draw at 40 with the countdown warning against 40 and not 50,
  resignation (immediate, no acceptance, available to the player to move), and
  a draw by agreement.
- **Gate H — Rank numbering does not leak.** Across a Demotion game and a
  Battle game in the same session, rank 5 is the strongest piece in Demotion
  and rank 1 is the strongest in Battle, with no piece in either game drawn
  with the other major's artwork or numeral.
- **Gate I — Accessibility.** With the mouse put away, choosing Demotion,
  playing a full game to a Flag capture, and resigning a second game are all
  workable by keyboard alone, with the screen reader announcing the starting
  position on arrival, each move, each combat result **including the demotion
  of the surviving piece**, and the final result.

## Open items to resolve at plan time

- **Where the two majors meet, and what the shared view layer looks like** —
  the story's central design question. What the board and its surfaces
  actually need from a rules major (dimensions, terrain, tokens, legal
  targets, status, available actions), whether major 2 is adapted onto that
  interface or left alongside it, and how much of `src/board/` moves without
  putting a single edit inside `src/rules/primary/v2/`.
- **How a game is identified across majors** — what replaces the major-2
  `GameId` union in `GAME_DETAIL`, `gameOrderRank`, `gameName` and
  `defaultGameId`; what `App.tsx` holds in `lastPlayedConfiguration` when the
  last game was major 3; and how the exhaustiveness property those records
  were written for (a fifth game failing to compile rather than falling into a
  default) survives the change.
- **Where Demotion sits in the picker's display order**, given the existing
  order is by board size (Skirmish 8 × 8, Clash 10 × 10, Battle 12 × 12) and
  Demotion is 8 × 8 but a different major.
- **How `PieceIcon` is re-keyed** to `(major, rank)` without changing what
  major 2 renders today. _Which_ sprite each major-3 rank uses is already
  settled (see Design decisions); how the lookup is structured so that a
  shared drawing never becomes a shared key is not.
- **How a demotion is announced** to a screen reader, and how the mid-game
  rank change is conveyed on the board itself beyond the corner numeral.
- **How a Demotion game is entered and oriented** — what `HotSeatGame`'s
  choice → play path looks like with the placement branch absent, where focus
  lands, and what the opening announcement says when the player has not
  arranged anything themselves.
- **Whether the position ID is shown to a player at all**, and if so where —
  the rules call it optional and player-facing only as a way to replay or
  mirror a position, which this app cannot yet do.
- **How the starting position is generated in the app** — the source of
  randomness, whether a game's position is reproducible within a session, and
  whether generation is worth making injectable for tests (it almost certainly
  is, given a uniform distribution and a derived threshold are both worth
  testing directly).
- **What the resign control looks like and where it lives**, next to the
  existing draw offer, and what confirmation (if any) it needs given it cannot
  be declined or undone.
- **Whether major 2's `LeaveGameDialog` wording still fits** a game with no
  placement phase to abandon.
- **What test coverage the engine needs** — at minimum: generation uniformity
  and the flag-on-row-1 restriction, both branches of the strength rule and
  the exact `S = 21`/`S = 22` boundary, position ID round-trip and validation
  rejection, direction-relative encumbrance in all four directions, open-path
  diagonals including the Flag, rank reduction on both attacker and defender,
  rank reduction stopping at rank 1, the formation bonus recomputed after a
  demotion, and each ending condition including mutual attrition.
- **Whether `README.md` needs updating**, given a fourth game a player meets
  immediately on the "Choose a game" screen.
- **The step decomposition** that keeps the app green at every commit — likely
  the v3 board and pieces first, then generation and the position ID, then
  movement, combat and outcome, then the shared view layer, then the picker
  and the play surfaces.

## Addendum — dev container file watching

Added after the story's work was complete, and carried on the same branch
because it is a one-line development-environment fix with no bearing on the
app that ships.

Manual-verification gates for this story were run with the dev server never
picking up an edit on its own: every check meant restarting Vite by hand. The
cause is the dev container's mount rather than anything in this repository.
The workspace is passed through from the Windows drive over 9p/drvfs, and that
filesystem does not implement **recursive** inotify — a flat, single-directory
watch works, but a recursive one silently reports nothing at all, which reads
as the feature being switched off rather than failing. Vite 7 no longer uses
chokidar (which walked the tree itself and set one flat watch per directory);
it calls `fs.watch(..., { recursive: true })` directly, so it lands squarely on
the one primitive the mount does not provide.

`vite.config.ts` now sets `server.watch.usePolling`, which was confirmed to
restore HMR on this mount. Two things worth recording for whoever meets this
next:

- **It fixes Vite only.** `npm run test:watch` and any other tooling that
  watches the tree — including the assistant's own detection of files changed
  outside its edits — go through the same missing primitive and are not
  covered by this change.
- **The structural fix is to move the working copy off 9p**, either onto
  WSL2's own ext4 or into a container volume, which would make the workaround
  unnecessary and speed up file I/O generally. That was considered and
  deliberately declined: the owner wants the repository to stay reachable from
  Windows at an ordinary path.
