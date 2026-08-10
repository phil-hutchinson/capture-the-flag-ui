# Story 00000032 — Rules popup on the start screen

## Summary

A player who opens this app today can start a game immediately but has nowhere
to find out how the game is played. The only rules text anywhere is the
outbound link in `README.md` to the companion project's full rulebook — a
technical document, several thousand words long, written to settle questions
rather than to teach.

This story adds a **"How to play" button to the start screen** that opens a
**single popup** with a deliberately small, illustrated summary of the game.
It is not the rulebook and does not try to be. It assumes a reader who already
has a general sense of how board games work, and fills in only the handful of
things this game does that they could not guess: how far a piece moves, why it
sometimes moves less far, that attacks reach one square further than moves do
(diagonally), and how a fight is decided.

What a player will notice:

- **A fourth button, "How to play", first on the start screen** — above "Play a
  game", so someone meeting the game for the first time finds it before they
  are asked to place an army.
- **A popup with six short sections**, laid out with a full-width header and
  then two columns: movement on the left, combat on the right. Each section is
  one heading, a sentence or two, and one or two small pictures.
- **Pictures drawn with the game's own pieces**, on small cutouts of a board,
  showing exactly what the sentence above them describes. They look like the
  real board because they are drawn with the real board's artwork.
- **Nothing else changes.** The popup closes and the player is back on the
  start screen exactly where they were.

## Background & references

- `doc/ruleset/rules.md` in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository is the single source of truth for the rules and is not restated
  here. The popup's copy is a **simplification** of §4.2 (movement) and §4.3
  (attacks and combat), written for players; where the two differ in wording,
  the rulebook is right and the popup is short.
- The popup covers **only** what the six sections below cover. Placement,
  lakes, lanes, what a Tower is, the Flag itself, how a game ends, draws, and
  the fifty-move rule are all deliberately absent — see Out of scope. The one
  thing it says about a Tower is what happens when one is attacked.
- The **diagonal-attack rule choices** (`DIAGONAL_ATTACKABLE`,
  `DIAGONAL_ATTACK_PATH` — see `src/rules/primary/v2/ruleFlags.ts`) are
  deliberately not explained here. The popup says only that a piece can attack
  an enemy standing immediately diagonally; the two settings that qualify
  _which_ enemies and _when_ are presented to the player where they are chosen,
  on the new-game screen. This constrains the pictures — see Design decisions.
- Relevant code today: `src/app/StartScreen.tsx` and `src/app/StartScreen.css`
  (the three existing buttons, and the heading-focus-on-mount pattern);
  `src/board/LeaveGameDialog.tsx` (the repo's only dialog — native `<dialog>`
  shown with `showModal()`, labelled via `aria-labelledby`, focus set on open,
  focus restored by the browser on close); `src/art/PieceIcon.tsx`
  (`PieceIcon` and `PieceSpriteDefs`, the piece artwork and its symbol
  library); `src/rules/primary/v2/pieces.ts` (`PIECE_CATALOG` — rank 1 is the
  strongest, and the rank numeral drawn in each piece's corner is what the
  pictures rely on to read as "R1", "R2", …); `src/rules/primary/v2/movement.ts`
  and `combat.ts` (the rule logic the pictures must agree with);
  `src/board/Board.css` and `src/board/FullBoard.css` (the board's visual
  vocabulary — `--square`, `--parchment`, `--ink`, the side colors).
- The repo has **no DOM/component test environment** — Vitest runs in `node`
  only, and adding jsdom plus a component-testing library is a separate,
  already-proposed story
  (`doc/plan/proposed-stories/automated-accessibility-and-dom-testing.md`).
  That shapes how this story is verified: see Design decisions.

## Policy (fixed by the owner)

- **The button reads "How to play"**, with the detail line **"A quick guide to
  how the game works"**, and sits **first** in the start screen's list of
  choices, above "Play a game".
- **The start screen is the only place it opens from.** The popup is not
  reachable while placing, playing, or reviewing a game. (A player mid-game
  who wants it must leave the game, which the app already guards with its
  "leave this game?" prompt.)
- **The popup is self-contained.** No outbound link to the companion
  repository's rulebook, and no link anywhere else. `README.md` already carries
  that link for a reader who wants the full text.
- **The copy below is the copy**, subject only to the spelling and grammar
  corrections listed under Copy. The popup does not gain sections, caveats, or
  footnotes beyond what is written here.
- **The pictures are drawn by code that lives beside the core board code, not
  inside it.** They reuse the piece artwork; they do not reuse — and must not
  cause any change to — `Board.tsx`, `FullBoard.tsx`, `PlayBoard.tsx` or
  `grid/AccessibleGrid.tsx`. No prop, mode or branch is added to a core board
  component to serve this popup.
- **No new dependencies.** The dialog is the platform's native `<dialog>`, as
  `LeaveGameDialog.tsx` already establishes.

## Players and colors

Unchanged: first player = White = red (`#a13d2b`); second player = Black = blue
(`#33526b`). The popup is not about a particular game in progress, so it has no
"active player" — it needs a _friendly_ side and an _enemy_ side, and should
use red for the piece the reader is invited to identify with and blue for the
enemy throughout, consistently across all ten pictures.

Player-facing vocabulary applies in full: the popup says **"move"**, never
"ply", and names pieces as the rules name them (**Tower**, **Flag**) when it
names them at all.

## The popup's content

### Header (full width)

> **Capture the Flag: Rules**
>
> Capture the opponent's flag before they capture yours
>
> Place your pieces in phase one; battle your opponent in phase two.

### Left column

**Movement**

> Pieces may move up to two squares in any of the four cardinal directions.

_Picture 1_ — a friendly piece in the middle of a 5×5 cutout of a board, with
arrows showing the eight squares it can reach (one and two squares away, in
each of the four directions). No other pieces on the cutout.

**Slowed movement**

> Pieces may only move one square if any enemy (including Tower or Flag) is
> present in the immediate surrounding eight squares.

_Picture 2_ — a friendly piece in the middle of a 5×5 cutout with an enemy
piece diagonally beside it, and four arrows showing the four squares it can now
reach. The enemy piece is drawn but not marked: this picture is about movement
only and deliberately ignores the fact that the enemy could be attacked.

**Movement for attacks**

> Pieces can attack other pieces with the same movements as regular movement,
> as well as on the immediate diagonal.

_Picture 3_ — a friendly piece with an enemy two squares in front of it, marked
as attackable.
_Picture 4_ — a friendly piece with an enemy diagonally beside it, marked as
attackable.

### Right column

**Combat**

> In combat, the stronger piece wins, regardless of which piece attacks which.
> The losing piece is removed from the board; in the case of an attacker win,
> the attacker moves to the destination square.

_Picture 5_ — a rank 1 piece attacks a rank 2 piece; the rank 2 piece is struck
out.
_Picture 6_ — a rank 3 piece attacks a rank 2 piece; the rank 3 piece is struck
out.

**Equal-ranked pieces and Tower attacks**

> If a piece attacks another piece of equal rank, both are removed. This also
> occurs when attacking a Tower.

_Picture 7_ — a rank 4 piece attacks a rank 4 piece; both are struck out.
_Picture 8_ — a rank 4 piece attacks a Tower; both are struck out.

**Rank-up**

> If a piece has a friendly piece of identical rank in any of the eight squares
> immediately surrounding it, it will draw against a piece one rank higher,
> both when attacking and when defending.

_Picture 9_ — a rank 3 piece with a friendly rank 3 piece beside it attacks an
enemy rank 2 piece; both the attacker and the defender are struck out.
_Picture 10_ — an enemy rank 2 piece attacks a rank 3 piece that has a friendly
rank 3 piece beside it; both are struck out.

### Copy

The wording above is the owner's, and is fixed. It already incorporates the
owner's own amendments — **"up to two squares"** (the dictated "may move two
squares" read as though two were the only legal distance, contradicting picture
1's eight destinations), the **phase line** in the header, and the **Tower
sentence and its picture** folded into the equal-rank section. Beyond those,
four corrections were applied to what was dictated:

1. **Headings normalized to sentence case** — "Slowed movement", "Movement for
   attacks", "Equal-ranked pieces and Tower attacks" (dictated as "Slowed
   Movement", "Movement for Attacks", "Equal-Ranked Pieces", alongside
   "Movement", "Combat" and "Rank-up", which were already sentence case).
2. **"tower or flag" → "Tower or Flag"**, and **"a tower" → "a Tower"** in the
   equal-rank section and its heading, matching the rules' and the app's own
   naming of the pieces.
3. **"anther" → "another"**, and **"both on attack and defending" → "both when
   attacking and when defending"** — the latter mixes a noun and a gerund.
4. **No other change.** In particular "cardinal directions", "immediate
   diagonal", "rank-up" and lower-case "phase one"/"phase two" are kept as
   dictated, even though the rulebook says "orthogonal", "diagonally adjacent",
   "formation bonus" and "Phase 1"/"Phase 2" — the popup is written for
   players, not to match the rulebook's vocabulary.

## In scope

1. **The "How to play" button** on the start screen, first in the list, in the
   same visual treatment as the other three choices, opening the popup.
2. **The popup itself** — a modal dialog carrying the header and the six
   sections, in a full-width header plus two-column layout that collapses to a
   single column when there is not room for two, with the left column's
   sections read before the right column's in every layout.
3. **The ten pictures**, drawn from the game's own piece artwork on small
   board cutouts, each accompanied by a text equivalent conveying the same
   fact in the same plain language.
4. **A picture-drawing module that lives beside the core board code** and is
   reusable across all ten figures — cutout geometry, a piece on a square, a
   move/attack marker, and the struck-out marking for a removed piece — with
   no change to the core board components.
5. **Automated agreement between the pictures and the rules.** Each figure's
   marked squares and each combat figure's outcome are stated as data and
   checked against `movement.ts` and `combat.ts`, so a picture cannot quietly
   go stale when a rule changes. See Design decisions.
6. **Keyboard and screen-reader parity** — opening, reading and closing the
   popup works from the keyboard alone, and every picture's meaning is
   available non-visually.
7. **`README.md` updated** to mention that the app now explains the basics
   itself, in the same plain register as the rest of that file.

## Design decisions & constraints

- **The pictures are illustrations, not a live board.** They are not
  interactive, they are not part of a grid in the accessibility tree, and they
  animate nothing. A reader should not be able to click, focus or arrow around
  them.
- **Every combat figure is one cutout, not a before-and-after pair** (the
  owner's decision). The pieces are shown where they stand when the attack is
  declared; an **arrow runs from the attacker onto the defending piece's
  square**; and whichever piece or pieces the fight removes carry a **red X**
  drawn over them — one of them in pictures 5 and 6, both in 7, 8, 9 and 10.
  All six combat figures (5–10) use this one treatment.
  - **The arrow does double duty**: it marks the attack, and it is what
    conveys "the attacker moves to the destination square", which a single
    static cutout cannot show outright — the attacker can only be drawn in one
    place. So the arrow must read as directional and must clearly terminate
    _on_ the defender's square, not merely point toward it.
  - **Reconciling the arrow with picture 3 and 4's attack marking.** Those two
    figures mark an enemy as attackable without any fight happening. Whether
    they use this same arrow (likely — it is the same relationship) or a
    distinct "attackable" marking is a plan-time call, but the two must not
    look similar-but-different in a way that reads as a distinction the popup
    never explains.
  - The red X must not be the only thing distinguishing a removed piece, per
    the color rule below, and must stay legible over both side colors, over
    the rank numeral in the piece's corner, and — on the defender's square —
    under the head of the arrow.
- **Figure data is pure; figure rendering is thin.** Because the repo has no
  DOM test environment, each figure should be declared as plain data (which
  squares hold which pieces, which squares are marked, what the outcome is) in
  a `.ts` module with no React in it, and rendered by a thin `.tsx` component.
  The data module is then unit-testable in the existing node environment:
  place the same pieces on a real board layout and assert that the marked
  squares equal `legalDestinations`/`legalAttacks`, and that the combat
  figures' outcomes equal `resolveCombat`'s. The `.tsx` layer, like every other
  component in this repo, is verified by the manual gates.
- **Checking a figure against the engine needs a configuration**, and the
  choice matters: the diagonal figures are only legal under some values of the
  two diagonal-attack flags. Check the figures against the **default**
  configuration (`movable_only`, `always`) and additionally require that the
  diagonal figures stay legal under **every** value of both flags — that is
  what keeps the popup honest about not covering those settings.
- **Constraints on the pictures that follow from that**, and which a later
  reader must not "tidy away":
  - The diagonally attacked enemy is a **numbered piece**, never a Tower or
    the Flag, so the picture is true under `DIAGONAL_ATTACKABLE=movable_only`
    as well as `all`.
  - The squares flanking a diagonal attack are **left empty**, so the picture
    is true under `DIAGONAL_ATTACK_PATH=open_path` as well as `always`.
  - Pictures 3 and 4 stay **two separate cutouts**. Combining them — an enemy
    two squares in front _and_ an enemy diagonally adjacent, on one board —
    would make the two-square attack illegal, because the diagonal enemy slows
    the attacker. The same trap applies to any future crowding of picture 1.
  - **Picture 8's attack on a Tower is orthogonal, never diagonal.** Under
    `DIAGONAL_ATTACKABLE=movable_only` — the default — a Tower cannot be
    attacked diagonally at all, so a diagonal version of that figure would
    illustrate a rule the game does not always have.
  - Cutouts show **no lakes and no board edge**: every 5×5 window sits in open
    board, so nothing in a picture depends on geometry the popup never
    explains.
- **The cutouts are a window onto a real board, not a 5×5 board.** Sizing them
  as a window is what makes the engine check above meaningful and keeps the
  squares reading at the same scale as the real thing.
- **The dialog will be taller than the viewport on many screens.** It must
  scroll internally, keep its heading and its close control reachable, and
  never make the page behind it scroll.
- **Focus on open goes to the popup's heading** (the `tabIndex={-1}` heading
  pattern `StartScreen.tsx` and `GameResult.tsx` already use), so a screen
  reader announces what the popup is before its contents — rather than to the
  close button, which would announce the way out first. Escape closes it, and
  focus returns to the "How to play" button, which a native `<dialog>` does on
  its own.
- **The popup has no state.** It is open or it is not; that boolean lives in
  `StartScreen.tsx`, which today carries no state at all. `App.tsx` gains no
  new screen and no new route.
- **Colors carry no meaning on their own.** Friendly-vs-enemy is red-vs-blue,
  but the pictures' text equivalents must say which side is which, and the
  markers for "can move here" and "can attack here" must be distinguishable
  from each other by shape, not only by fill — the popup has no legend.

## Out of scope

- **Everything the six sections do not cover**: placement and the secret setup
  phase (named in the header's phase line, but not explained), lakes and lanes,
  what a Tower is and why it cannot move, capturing the Flag, how a game ends,
  resignation, draws by agreement, and the fifty-move rule. The popup is a
  primer, not a rulebook, and the sections it has are the sections it gets.
  Note that the equal-rank section now covers _attacking_ a Tower — what
  happens in that fight — without saying anything else about Towers.
- **The diagonal-attack settings themselves** — explained where they are
  chosen, not here.
- **Opening the popup from anywhere other than the start screen.**
- **Any link out of the app**, including to the companion rulebook.
- **Any change to the rules code** (`src/rules/`), the core board components,
  or the game itself. This story is read-only with respect to how the game
  plays.
- **A DOM/component test environment**, which stays the separate proposed
  story it already is; this story must not need one.
- **Localization, printing, or a rules page with its own URL.**

## Manual-verification gates

- **Gate A — The button and the popup.** From the start screen, "How to play"
  is the first choice and opens the popup; the header (both lines under the
  title), six sections and ten pictures are all present, with the copy exactly
  as written above. Closing it returns to the start screen unchanged, and
  reopening it works.
- **Gate B — The pictures say what the sentences say.** Read each section with
  the rules open: picture 1 shows eight destinations, picture 2 shows four,
  pictures 3 and 4 mark the enemy as attackable, and pictures 5–10 each run an
  arrow from the attacker onto the defender's square and strike out exactly the
  right piece or pieces — one in 5 and 6, both in 7, 8, 9 and 10. Nothing in a
  picture contradicts its sentence, and the arrow reads as the attacker
  arriving on that square rather than merely pointing at it.
- **Gate C — Layout.** At a comfortable desktop width the header spans the full
  popup and the two columns sit side by side; narrowing the window collapses
  them to one column with movement still read before combat; the popup scrolls
  internally rather than being clipped, on both a short viewport and a phone-
  width one.
- **Gate D — Keyboard and screen reader.** With the mouse put away: the button
  is reachable and activates, focus lands in the popup and cannot escape behind
  it, Escape closes it, focus returns to the button. With a screen reader: the
  popup announces itself, every section's heading and sentence is read, every
  picture has a text equivalent that conveys the same fact, and no picture
  presents itself as a table or grid to be navigated.
- **Gate E — Nothing else moved.** A Battle, Skirmish and Clash game each still
  set up, play and end exactly as before, and the review screen is untouched.

## Open items to resolve at plan time

- **What a move marker and an attack marker actually look like**, given they
  must differ by shape and not only by color, and that the popup carries no
  legend. The board's own `--destination` and `--attack` highlights are a
  starting point but were designed for a board with a live selection on it, not
  for a static picture.
- **How the arrowhead and the red X share the defender's square** in the six
  combat figures without either becoming unreadable — that square carries an
  arrow terminating on it, an X over it, and a piece that already has a rank
  numeral in its corner. Related: whether the struck-out piece is dimmed as
  well as crossed, which would carry the meaning for a reader who cannot pick
  the red out; and whether pictures 3 and 4 reuse the same arrow.
- **How each picture's text equivalent is worded and attached** — one sentence
  per figure, and whether that sentence is visible to everyone (a caption) or
  only to assistive technology. A caption may make the popup longer than it
  should be; a hidden equivalent is invisible to the owner reviewing the copy.
- **Where the new code lives** — `src/app/rules/` beside `StartScreen.tsx`, or
  its own top-level folder — and what it may import. It reuses `PieceIcon` and
  needs `PieceSpriteDefs` mounted (today every screen that draws pieces mounts
  its own copy).
- **How much of the cutout's look is shared with `Board.css`** without coupling
  to it: reusing the CSS custom properties (`--parchment`, `--ink`, the side
  colors) is clearly right, reusing the board's class names clearly is not, and
  the line between them wants drawing deliberately.
- **How the figure-vs-engine check is set up** — which board layout the 5×5
  windows are cut from (a layout with room for an open 5×5 window well away
  from lakes and edges), and how a figure's squares are expressed so the test
  can place them on that board.
- **Whether "How to play" first pushes the other three choices below the fold**
  on a small screen, and if so what gives.
- **The step decomposition** that keeps the app green at every commit — likely
  the figure data and its engine tests first, then the figure renderer, then
  the popup shell and its layout, then the start-screen button, then the
  `README.md` update.
