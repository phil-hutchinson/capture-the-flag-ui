# Story 00000006 — Phase 2 game-end: victory, draws & losses

## Summary

Finish Phase 2 — and with it, the game: detect and present every way a game of
Capture the Flag can end. The Flag finally becomes capturable, and capturing it
wins on the spot. The structural "unbreachable Flag" win, the no-legal-move
loss, the inactivity loss, and the no-progress draw are all detected the moment
they occur, and the players may agree to a draw. When the game ends — however
it ends — both players are clearly told who won (or that it is a draw) and why,
and can start a new game.

From a player's point of view: for the first time, I can actually win. I can
strike at the enemy Flag and end the game in glory; I can see when a slow
grind is drifting toward the draw or when my own idleness is about to cost me
the game; I can offer my opponent a draw; and when it's over, the app tells us
both plainly how it ended and lets us set up the next battle.

This is the third and last of the three Phase 2 stories (after 00000004
movement and 00000005 combat). It is what makes a game playable end-to-end,
from placement to a recorded result.

## Background & references

The rules are owned by the companion
[capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
repository — `doc/ruleset/rules.md` is the single source of truth. Do not
restate the rules here. This story was written against ruleset version 1.1
(current as of 2026-07-11); as with story 00000005, there is no need to
recheck the companion rules documentation during implementation planning or
implementation. Relevant game-end facts at 1.1:

- **The game ends the moment any Section 6 condition is met** (§6 preamble).
- **Flag capture (§6.1):** moving a piece onto the opposing Flag wins
  immediately. Story 00000005 deliberately never offered a Flag square as a
  destination; this story makes the Flag capturable. Two rules consequences
  become live for the first time: **the Flag is never Archer-supported** (an
  Archer behind the Flag changes nothing — §4.3), and an **Assassin attacking
  a supported Flag wins outright**.
- **Unbreachable Flag (§6.2):** a player wins immediately when every enemy
  Sapper is *unavailable* (captured, or unable to reach any of that player's
  Towers under the §5 reachability rules) **and** their own Flag is fully
  enclosed by intact Towers and the board edge. Edge cases: enclosure can
  only degrade, never be built; availability is re-checked continuously
  against the current board; and if both sides meet the condition
  simultaneously (the mutual last-Sapper trade), the game is a **draw**.
  Because placement is unrestricted, the condition can even hold **at the
  reveal**, before any move is made — detection must run from the start of
  Phase 2, not only after plies.
- **No legal move (§6.3):** a player who cannot make any legal move on their
  turn loses immediately. Passing is never allowed. (This properly implements
  what stories 00000004/00000005 left as an accepted "stuck" rough edge.)
- **Inactivity (§6.4):** each player has a personal counter starting at 0.
  Any attack you make (winning, trade, or sacrifice) resets **your** counter;
  any non-attack move of yours raises it by 1; any **sacrificial** attack by
  your opponent (complete or partial) also resets your counter. At **50**,
  you lose immediately.
- **No progress (§6.5):** a single shared counter rises by 1 on every ply
  with no capture and resets to 0 on any capture (a winning attack or mutual
  loss, including a Sapper destroying a Tower; a complete sacrifice does not
  reset it). At **80**, the game is a draw.
- **Draw by agreement (§6.6):** either player may offer a draw on their turn;
  if the opponent accepts, the game ends immediately in a draw; if declined,
  the offering player takes their turn as usual — an offer never replaces or
  skips a move.
- **Recording results:** the companion repository's record file format
  (`doc/ruleset/technical-notes.md`) always writes `Result` (PGN values:
  `1-0`, `0-1`, `1/2-1/2`, `*` for ongoing) and `ResultReason` (free text,
  e.g. `Flag Captured`, `Inactivity`, `No Progress`, `Unbreachable Flag`,
  `No Legal Move`) header tags.

**Precedence.** The rulebook orders Section 6 but does not spell out what
happens when one ply satisfies more than one condition. The companion
repository's reference engine (`capture_the_flag/outcome.py`) resolves this,
and recorded games must replay identically, so this story follows it exactly:
conditions are evaluated in rulebook order (6.1 flag capture, then 6.2
unbreachable Flag — both sides at once being a draw), except that the
conditions attributable to the opponent's just-completed ply — their
inactivity loss (6.4) and the shared no-progress draw (6.5) — are checked
**before** the active player's no-legal-move loss (6.3), because the game
ends the moment the opponent's ply meets them, before the active player is
ever asked to move. A single non-attack ply that reaches 50 inactivity and 80
progress at once resolves as the **inactivity loss** (6.4 precedes 6.5).

**Ruleset versioning:** game-end detection and the two counters are rule
logic and rule state, and must be organized per ruleset version, consistent
with stories 00000001/00000004/00000005.

This story builds directly on story 00000005's play state: the versioned
`PlayState`, `applyMove` and its exposed `PlyOutcome` (which already reports
what each ply did — the combat result and the pieces involved — precisely so
this story's counters and detection could hang off it), and the
perspective-flipping hot-seat board. Game-end extends that model — it must
not fork it.

## Players and colors

Unchanged from story 00000001: first player = **White = Side A = red
(`#a13d2b`)**; second player = **Black = Side B = blue (`#33526b`)**;
player-facing surfaces refer to the sides by color (red / blue) and use the
word "move" (never "ply").

## In scope

1. **The Flag becomes capturable.** The enemy Flag square is now offered as a
   destination wherever a piece could legally attack it (adjacency, charge
   geometry, rush geometry — the same structural offering as story 00000005),
   presented as an attack-style target. Capturing it ends the game
   immediately as a win. The newly-live rules details hold: an Archer behind
   the Flag does not convert the capture into a trade, and a charging Knight
   or rushing Skirmisher can capture it from distance.
2. **Game-end detection, all conditions, correct precedence.** After every
   ply — and once at the start of Phase 2, since placement can satisfy §6.2
   at the reveal — the versioned rule logic detects flag capture, the
   unbreachable Flag (including the both-sides draw), the opponent's
   inactivity loss, the no-progress draw, and the active player's
   no-legal-move loss, in exactly the precedence described above.
3. **The inactivity and progress counters.** Both players' inactivity
   counters and the shared progress counter live in the versioned play state
   and evolve per §6.4/§6.5 semantics, driven by what each applied ply
   actually did (attack or not, capture or not, sacrificial or not).
4. **Countdown warnings when an ending nears.** The UI stays quiet about the
   counters until one gets close, then warns plainly:
   - when a player has **10 or fewer** of their own moves remaining before
     the 50-move inactivity loss, that player sees a warning while it is
     their turn — including how many moves remain and that an attack resets
     it;
   - when **20 or fewer** moves (by both players combined) remain before the
     80 no-progress draw, both players see a warning with the remaining
     count.
   Warnings are perceivable without relying on color alone and are conveyed
   to assistive technology.
5. **Draw by agreement.** On their turn, the active player can offer a draw.
   The offer is presented to the opponent across the hand-off; accepting ends
   the game immediately in a draw, declining returns play to the offering
   player, who takes their turn as usual. Declining is quiet — no penalty, no
   record entry.
   Because the offer hands the physical board to the opponent, the board is
   drawn from **their** perspective while they answer, and turns back the
   moment they do: on a decline, back to the offering player, who now takes
   their turn; on an accept, the game is over and the final position is shown
   to the side to move, exactly as for every other ending. (An offer never
   changes whose turn it is — only who is looking at the board.)
6. **End-of-game presentation.** The moment the game ends, both players are
   told the result and the reason in player-facing terms — who won (red or
   blue) or that it is a draw, and why (Flag captured, unbreachable Flag, no
   legal move, inactivity, no progress, or agreement). The final position
   remains visible — the presentation must not permanently obscure the board —
   and the board becomes inert: no further selection or moves.
7. **Start a new game.** From the end-of-game presentation, a player-facing
   action starts a fresh game: back to an empty Phase 1 placement for both
   players. It is offered only once the game has ended.
8. **Result in the game record.** The developer-facing record dump gains the
   record file format's `Result` and `ResultReason` header tags: `*` while
   the game is ongoing, and the PGN result value plus a reason (matching the
   technical notes' examples, e.g. `Flag Captured`, `Inactivity`) once it
   ends.
9. **Accessible endings from the start.** Everything above is operable by
   keyboard and perceivable by screen reader as it is built, extending the
   established grid and live-region patterns: the Flag as an announced attack
   target, the countdown warnings, the draw-offer flow, the end-of-game
   announcement (result and reason), and the new-game action.

## Design decisions & constraints

- **Reuse, don't rebuild.** Game-end extends story 00000005's `PlayState`,
  `applyMove`/`PlyOutcome`, and the session layer; it must not introduce a
  parallel state model or a second interaction pattern. Detection, the
  counters, and reachability live with the other per-version rule logic.
- **Precedence follows the reference engine.** The evaluation order above is
  a rules-fidelity requirement, not a design choice: recorded games must
  replay to the same result in both codebases.
- **Plain `A2A3` recording stands.** Per the owner's decision (2026-07-11),
  switching the emitted notation to the extended result-marking form
  (`A4x-A5x`) is a separate later story; this story keeps emitting the plain
  form. This is safe because the record format requires readers to accept
  both forms, even mixed within one file. Draw offers and declines are not
  recorded in the move sequence (the notation has no form for them); an
  agreed draw appears only in the `Result`/`ResultReason` tags.
- **Flag capture is resolved as combat's simplest case.** Moving onto the
  Flag always succeeds for the attacker — no rank comparison, no Archer
  support. It should reuse the story 00000005 attack pathway (offering,
  activation, announcement), not invent a third kind of ply.
- **Counters are rule state.** They belong to the versioned play state, are
  initialized to zero at the start of Phase 2, and evolve only through
  applied plies. The mid-game-record header tags for resuming with non-zero
  clocks remain format-reserved and out of scope.
- **Warning thresholds are part of this story, not the plan.** The numbers —
  10 of the player's own moves remaining for inactivity, 20 combined moves
  remaining for no-progress — are fixed here by the owner. The plan decides
  presentation, not policy.
- **No-legal-move is verified by automated tests, not a manual gate.** The
  condition is practically unreachable in honest manual play: any adjacent
  enemy piece is a legal (sacrificial) attack, and at the reveal the front
  rank always has an empty buffer row ahead of it, so contriving zero legal
  moves by hand would take hundreds of plies. The detection and its
  precedence get thorough unit tests; the end-of-game presentation it shares
  with every other ending is exercised by the other gates.
- **New game means a full reset.** Fresh placement for both players, nothing
  carried over. It is only offered from the end-of-game presentation —
  mid-game abandonment or resignation is not a ruleset concept and is out of
  scope.
- **The Fair Play Rule (§7) is deliberately not enforced.** It is an informal
  social rule; the inactivity and progress clocks are its mechanical backstop
  and are fully implemented here.
- **Player-facing text** uses the sides' colors (red / blue), the rules'
  piece names, and the word "move" (never "ply"), per repository conventions.

## Out of scope

- **Switching the emitted notation to the extended result-marking form**
  (`A4-A5x` etc.) — a separate, later story by owner decision.
- **Mid-game records and resumption** (side-to-move and clock header tags
  remain format-reserved and unused).
- Loading / replaying a saved game (the record now carries a result and
  remains replay-sufficient; the feature is still not built).
- A captured-pieces display (graveyard/roster).
- Resigning or abandoning a game mid-play.
- Enforcing the Fair Play Rule (§7).
- AI opponent.
- Any networking or non-local multiplayer.
- Drag-and-drop (click interaction only, consistent with Phase 1).

## Manual-verification gates

These are hard stops: the implementation pauses for the owner to run the app
and confirm behavior automated tests cannot fully judge.

- **Gate A — Flag capture.** The enemy Flag is offered as an attack-style
  target when a piece can legally reach it (adjacent, and from distance by a
  charging Knight or rushing Skirmisher); capturing it ends the game at once
  with the right winner and "Flag captured" reason; an Archer stationed
  directly behind the Flag does not save it. The final position stays
  visible and the board goes inert.
- **Gate B — Unbreachable Flag.** Using placement to construct it (e.g. blue
  seals all 8 of their own Sappers into a 2×4 corner pocket behind their 6
  Towers, while red encloses their Flag in a corner behind 2 Towers), the
  win is detected **at the reveal**, before any move. And in play: with the
  opponent down to one available Sapper and the player's Flag enclosed,
  capturing that last Sapper ends the game immediately.
- **Gate C — Inactivity loss.** Shuffling non-attack moves, the at-risk
  player sees the warning once 10 of their moves remain, the count falls as
  they continue, an attack by them clears it (counter reset), and reaching
  50 loses them the game on the spot with the right reason.
- **Gate D — No-progress draw.** With both players shuffling (using
  occasional complete sacrifices to hold their inactivity counters down
  without making a capture), the shared warning appears for both players at
  20 moves remaining, any capture clears it, and reaching 80 ends the game
  as a draw with the right reason.
- **Gate E — Draw by agreement.** The active player can offer a draw;
  declining hands play back to the offerer who then moves as usual, with no
  trace in the record; offering again and accepting ends the game
  immediately as an agreed draw.
- **Gate F — Accessible endings.** With the mouse put away, a full game can
  be finished by keyboard alone — including capturing the Flag, offering and
  answering a draw, and starting a new game; with a screen reader on, the
  Flag target, the countdown warnings, the result and reason, and the
  new-game action are all announced; focus stays visible and untrapped
  through the end of the game.
- **Gate G — Result in the record.** During play the record dump carries
  `[Result "*"]`; after games ending by capture, counter, and agreement it
  carries the correct PGN result and reason tags alongside the ruleset,
  position block, and plain-form move sequence.
- **Gate H — New game.** From the end-of-game presentation, starting a new
  game returns to a fresh, empty Phase 1 placement for both players with
  nothing carried over.

## Open items to resolve at plan time

The design decisions for this story are settled above (evaluation order, the
warning thresholds, plain notation, the new-game reset, untestable-by-hand
no-legal-move). Remaining confirmations, all plan details rather than scope
questions:

- Confirm the exact `ResultReason` strings against the companion
  repository's technical notes (its examples cover every ending except
  agreement — pick a consistent string, e.g. `Draw Agreed`, for that case).
- Confirm the §5 reachability semantics in the implementation match the
  reference engine's (`capture_the_flag/reachability.py` /
  `breachability.py`): which Towers and Flag act as walls for the Sapper
  availability check versus the Flag enclosure check.
- Decide where the countdown warnings and draw-offer control live in the
  layout and how the hand-off presents a pending draw offer — presentation
  details for the plan (the policy is fixed above).

## Notes — Phase 2 complete; what follows

With this story, a full game is playable from placement to a recorded result.
The anticipated follow-on work, in no committed order:

- **Extended result-marking notation** — switch the emitted move record to
  the outcome-recording extended form (`A4x-A5x`), per the rules-variants
  redesign; a small standalone story.
- **Replay** — load and step through recorded games (the record format's
  reader; view-only and validated tiers per the variants redesign).
- **Rules-variants housekeeping** — the engine-folder-per-major rename,
  configuration threading, and record header changes, after the base
  repository's redesign lands.
