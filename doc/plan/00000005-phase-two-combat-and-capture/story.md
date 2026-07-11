# Story 00000005 — Phase 2 combat: attacks & capture resolution

## Summary

Give Phase 2 its teeth: on your turn you can now **attack**. Moving one of your
pieces onto a square occupied by an enemy piece resolves an encounter
immediately — attacker wins, attacker loses, or both fall — according to the
game's rank-based combat rules and their special cases. Knights gain their
signature **charge** (a 2–3 square straight-line move that exists only as an
attack), Skirmishers can now **rush** into an attack, and the Assassin, Archer,
Sapper, and Halberdier all do the special things they exist to do.

From a player's point of view: the game stops being a polite dance around each
other. On my turn I can pick one of my pieces and strike at an enemy piece it
can legally reach; the fight resolves instantly and visibly, the fallen piece
(or pieces) leave the board, and the turn passes.

What this story does _not_ yet let me do is **win, lose, or draw** — game-end
detection and its UI arrive in story 00000006. In particular, the enemy Flag
cannot be attacked in this story, because capturing it _is_ winning (see Design
decisions). This is the second of the three Phase 2 stories and is expected to
be the largest.

## Background & references

The rules are owned by the companion
[capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
repository — `doc/ruleset/rules.md` is the single source of truth. Do not
restate the rules here. Relevant combat facts as of ruleset version 1.1
(to be re-confirmed against the ruleset at plan time):

- The only way to attack is to **move a piece onto an enemy-occupied square**
  (§4.3). The result resolves immediately, with exactly three outcomes:
  **attacker wins** (defender removed, attacker advances onto the square),
  **attacker loses** (attacker removed, defender stays), or **mutual loss**
  (both removed, square left empty).
- **Rank decides**: between two numbered pieces, the lower-numbered (stronger)
  piece wins. **Equal rank is mutual loss** — the default for every rank,
  overridden only by the Knight-vs-Knight charge and Assassin-vs-Assassin.
- **Knight — charge** (§4.2): a Knight may move **2 or 3 squares in a straight
  line only when the move ends in an attack**, over a clear line (no pieces of
  either side, no lakes). A 1-square Knight attack is an ordinary attack, not a
  charge — the distinction drives the Halberdier and Knight-vs-Knight rules.
  (Story 00000004 already limits non-attacking Knights to one square.)
- **Skirmisher — rush** (§4.2): up to 3 squares in a clear straight line for
  movement _or_ attack. Story 00000004 built the movement half; this story adds
  the attacking half.
- **Assassin**: wins whenever it attacks, loses whenever it is attacked,
  regardless of rank. Assassin-vs-Assassin: the attacker wins. The guaranteed
  win does **not** extend to Towers.
- **Sapper and Tower**: only a Sapper destroys a Tower. Any other piece may
  attack a Tower but is simply removed while the Tower stands (a complete
  sacrifice). Towers never move and never attack.
- **Halberdier vs. Knight**: a Knight may **not charge** a Halberdier; it must
  attack from an adjacent square (and then wins normally, rank 3 over rank 5).
  The Halberdier gains nothing on offense.
- **Knight vs. Knight — charge exception**: a Knight that _charges_ another
  Knight wins and advances; an adjacent Knight-vs-Knight attack is normal
  mutual loss.
- **Archer — defensive support**: if a friendly piece adjacent to an Archer
  loses a _defensive_ combat, and the Archer stands directly opposite the
  attacker — one square beyond the defender, continuing the attacker's exact
  straight line of travel — the result becomes **mutual loss**. Support extends
  to Towers (a supported Tower trades with the Sapper demolishing it); the
  Assassin is not immune; the Archer's own combat is by rank; no support if the
  trigger square is off-board, a lake, or not a friendly Archer. (The rules'
  Flag exemption cannot arise in this story, since the Flag is not attackable
  here.)
- **Sacrificial attacks are legal**: any piece may attack any enemy piece,
  regardless of relative strength.
- A piece may never move onto a square occupied by a **friendly** piece
  (unchanged from story 00000004).

This story builds directly on story 00000004's play state: the versioned
`PlayState` (current board, side to move, recorded moves), the
`legalDestinations` movement logic, and the perspective-flipping hot-seat board.
Attacks extend that model — they must not fork it.

**Ruleset versioning:** combat resolution is rule logic and must be organized
per ruleset version, consistent with stories 00000001 and 00000004. As of
writing, the current ruleset is version 1.1 (`PRIMARY:1.1`); re-check the
companion repository's changelog at plan time in case a newer version has
landed.

## Players and colors

Unchanged from story 00000001: first player = **White = Side A = red
(`#a13d2b`)**; second player = **Black = Side B = blue (`#33526b`)**;
player-facing surfaces refer to the sides by color (red / blue) and use the word
"move" (never "ply").

## In scope

1. **Attack destinations, offered structurally.** On their turn, the active
   player's selectable destinations now include enemy-occupied squares the
   selected piece can legally attack, alongside the empty squares it can move
   to. Illegal attacks are prevented structurally, exactly as story 00000004
   prevents illegal moves — never validated after the fact. That includes the
   subtle cases: a Knight's 2–3 square destinations appear only on
   enemy-occupied squares (never empty ones) and never on a Halberdier;
   friendly pieces, Flags, and blocked or diagonal lines are never offered.
2. **Attack targets distinguishable from plain moves.** A player (sighted or
   using a screen reader) can tell which offered destinations are attacks and
   which are plain moves before committing to one.
3. **Immediate combat resolution.** Choosing an attack destination resolves the
   encounter at once per the rules — attacker advances, attacker falls, or both
   fall — and the board updates accordingly. Resolution covers the full rank
   table, equal-rank mutual loss, and every special case at ruleset 1.1:
   Assassin (both directions, including Assassin-vs-Assassin and the Tower
   exception), Sapper vs. Tower, non-Sapper vs. Tower, Halberdier anti-charge,
   Knight-vs-Knight charge, and Archer defensive support with its edge cases
   (support of a Tower; Assassin not immune; correct trigger-square geometry
   for 1-square attacks, charges, and rushes alike).
4. **Combat outcome presented to both players.** The result of each encounter
   is clearly communicated — which pieces fought and who fell — in player-facing
   terms (red/blue, piece names), so the outcome is obvious across the hand-off
   in hot-seat play, not just inferable from the changed board.
5. **Accessible combat from the start.** Attacking is operable by keyboard and
   perceivable by screen reader as it is built, extending story 00000004's grid
   interaction model: attack destinations are reachable and identified as
   attacks, and combat outcomes are announced to assistive technology.
6. **Recording attacks into the game state.** Every attack evolves the
   versioned play state and is recorded in the same plain origin-destination
   coordinate form as story 00000004 (e.g. `A2A3`) — no separator, **no
   combat-resolution markers**. Per rules §4.4, the plain form is sufficient:
   an attack's result always follows automatically from the position and the
   rules, which this story's deterministic resolution guarantees. The
   developer-facing game-record dump continues to work, now reflecting combat.

## Design decisions & constraints

- **Reuse, don't rebuild.** Attacks extend story 00000004's selection →
  destinations → move interaction and its `PlayState`; they must not introduce
  a parallel interaction or a second game-state model. Combat resolution lives
  with the other per-version rule logic.
- **The Flag is not attackable in this story.** Capturing the Flag is
  immediately winning the game (rules §6.1), and game-end belongs to story
  00000006 — so a Flag square is simply never offered as a destination here,
  the same structural quietness story 00000004 used for occupied squares. This
  is a deliberate, accepted limitation of a work-in-progress story, handled
  without special UI; story 00000006 makes the Flag capturable and makes doing
  so win the game. (Towers, by contrast, are fully attackable here — their
  rules are pure combat.)
- **Plain `A2A3` recording stands.** No combat markers, no extended
  `A4x-A5x`-style result notation — the rules make the plain form sufficient
  for replay, and richer notation remains a later concern. What matters is
  that resolution is a pure function of position + rules, so a future replay
  can reproduce every result.
- **Not throwaway.** Combat outcomes must be exposed in a way game-end
  (00000006) can build on — flag capture, the inactivity counter (reset by
  attacks) and the progress counter (reset by captures) all hang off "what did
  this move do" — without forcing a rewrite. This story does not implement
  those counters; it must simply not bury the information they need.
- **Deterministic, rules-complete resolution.** No randomness, no partial
  implementation of the special cases: the full ruleset-1.1 combat table ships
  in this story, because recorded games played on it must replay identically
  forever.
- **Accessibility built in, not bolted on.** Same WAI-ARIA grid interaction as
  stories 00000002/00000004 — attacking must not introduce a new mouse-only
  interaction. Announcements extend the existing live-region pattern.
- **"Stuck with no move" remains an accepted limitation.** Attacks make it far
  rarer, but the no-legal-move condition is still story 00000006's to handle;
  do not consider it all. No logic to account for it or avoid crashing is
  required in this story; no UI is required; no tests are required.
- **Player-facing text** uses the sides' colors (red / blue), the rules'
  piece names (Knight, Skirmisher, Lord Marshal, …), and the word "move"
  (never "ply"), per repository conventions.

## Out of scope

- **Everything that ends a game** (story 00000006): flag capture and the
  attendant win, the unbreachable-flag win, loss by having no legal move, the
  inactivity-counter loss, the no-progress draw, draw by agreement, and any
  end-of-game UI.
- **Attacking the Flag** in any form (see Design decisions).
- The **inactivity and progress counters** themselves (their inputs must merely
  remain derivable).
- A captured-pieces display (graveyard/roster). The combat announcement covers
  the immediate outcome; a persistent display of fallen pieces is a possible
  later refinement, not part of this story.
- The extended result-marking notation (`A4-A5x` etc.) from rules §4.4.
- AI opponent.
- Loading / replaying a saved game (the record continues to anticipate it; the
  feature is not built).
- Any networking or non-local multiplayer.
- Drag-and-drop (click interaction only, consistent with Phase 1).

## Manual-verification gates

These are hard stops: the implementation pauses for the owner to run the app and
confirm behavior automated tests cannot fully judge.

- **Gate A — Basic attacks & rank resolution.** Enemy-occupied squares in reach
  are offered as attack targets and visually distinguished from plain moves;
  friendly pieces and the Flag never are. Attacking a weaker piece wins and
  advances, attacking a stronger piece is a complete sacrifice, and equal rank
  is mutual loss — with the board updating correctly in all three cases and the
  outcome clearly presented.
- **Gate B — Knight charge.** A Knight is offered 2–3 square destinations only
  onto attackable enemy pieces over a clear straight line — never onto empty
  squares, never through blockers or lakes, and never onto a Halberdier. A
  charge against a Knight wins outright; an adjacent Knight-vs-Knight attack is
  mutual loss; an adjacent Knight attack on a Halberdier wins normally.
- **Gate C — Skirmisher rush, Assassin & Sapper.** A Skirmisher can attack up
  to 3 squares away along a clear line. The Assassin wins any attack it makes
  (including against another Assassin) but falls to any attack against it, and
  is destroyed if it attacks a Tower. A Sapper destroys a Tower and advances;
  any other piece attacking a Tower is removed while the Tower stands.
- **Gate D — Archer support.** When a defender adjacent to a friendly Archer
  loses, with the Archer directly opposite the attacker's line of travel, the
  result becomes mutual loss — verified for an ordinary attack, a charge or
  rush from distance, a supported Tower (Sapper trades), and an attacking
  Assassin (not immune). No support when the Archer is adjacent but off the
  attack line, or when the supported piece is the one attacking.
- **Gate E — Accessible combat.** With the mouse put away, a full attack can be
  made by keyboard alone; attack destinations are announced as attacks
  (distinct from plain moves); the combat outcome — who fought, who fell — is
  announced to assistive technology; focus remains visible and untrapped
  through the resolution.
- **Gate F — Move record.** After a sequence including moves and attacks of
  each outcome type, the evolved game-state artifact records every ply in the
  plain `A2A3` form (no combat markers) with the ruleset version, and the
  positions implied by replaying those plies match the board — confirming the
  record remains sufficient for future replay.

## Open items to resolve at plan time

The design decisions for this story are settled above (the non-attackable Flag,
plain `A2A3` recording, full special-case coverage, built-in accessibility).
Remaining confirmations:

- Re-read `rules.md` at the current ruleset version to confirm the combat model
  in full — the rank table, all special cases and their edge cases (especially
  Archer support geometry: the trigger square continues the attacker's exact
  line of travel, whatever the attack distance) — and that no rule beyond those
  listed above affects combat.
- The story was written again ruleset version in the companion repository's changelog
  (1.1 as of writing). There is no need to recheck the companion rules documentation
  during impementation planning or implementation.
- Confirm how the combat outcome is best exposed for story 00000006 to consume
  (e.g. a resolved-outcome value alongside the applied move) — a design detail
  for the plan, not a scope question.

## Notes — anticipated follow-on story

Phase 2 is being delivered as three stories; this is the second. The last one
is already created and will build on it:

- **Story 00000006 — Phase 2 game-end: victory, draws & losses.** Detect and
  present all the ways a game ends: flag capture (which also makes the Flag
  attackable), the "unbreachable flag" win, a player with no legal move losing,
  the per-player inactivity loss, the no-progress draw, and draw by mutual
  agreement — with the end-of-game UI. This is what finally makes a game
  winnable end-to-end.
