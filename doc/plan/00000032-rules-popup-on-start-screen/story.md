# Story 00000032 — How-to-play rules page

## Summary

A player who opens this app today can start a game immediately but has nowhere
to find out how the game is played. The only rules text anywhere is the
outbound link in `README.md` to the companion project's full rulebook — a
technical document, several thousand words long, written to settle questions
rather than to teach.

This story adds a **"How to play" button to the start screen** leading to a
**rules page** carrying a deliberately small, illustrated summary of the game.
It is not the rulebook and does not try to be. It assumes a reader who already
has a general sense of how board games work, and fills in only the handful of
things this game does that they could not guess: how far a piece moves, why it
sometimes moves less far, that attacks reach one square further than moves do
(diagonally), and how a fight is decided.

What a player will notice:

- **A fourth button, "How to play", first on the start screen** — above "Play a
  game", so someone meeting the game for the first time finds it before they
  are asked to place an army.
- **A page with six short sections**, laid out with a full-width header and
  then two columns: movement on the left, combat on the right. Each section is
  one heading, a sentence or two, and one or two small pictures.
- **Pictures drawn with the game's own pieces** — the movement ones on small
  cutouts of a board, the combat ones as pieces on their own. They look like
  the real thing because they are drawn with the real board's artwork.
- **Nothing else changes.** A "Back to start" control returns the player to the
  start screen exactly as they left it.

## Amendments

Recorded so the change of direction is visible; both were decided by the owner
after seeing Step 3 running.

1. **The rules surface is a page, not a modal popup.** It was originally
   specified as a single popup over the start screen. A page sizes itself
   naturally, has no internal scroll region to fight, and behaves far better on
   a small screen — all of which the modal was working against. The app has no
   router, so this is a new screen in `App.tsx`'s existing screen union, not a
   URL.
2. **The six combat figures are drawn without a board.** Pictures 5–10 show
   pieces on their own rather than on a board cutout: less busy, and it opens a
   gap between the attacker and the defender for the arrow to occupy. The four
   movement figures (1–4), including both "Movement for attacks" pictures, keep
   their board cutouts — the board is what makes distance and direction legible
   there.

The story folder and branch keep their original `…-rules-popup-on-start-screen`
name; only the surface changed.

## Background & references

- `doc/ruleset/rules.md` in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository is the single source of truth for the rules and is not restated
  here. The page's copy is a **simplification** of §4.2 (movement) and §4.3
  (attacks and combat), written for players; where the two differ in wording,
  the rulebook is right and the page is short.
- The page covers **only** what the six sections below cover. Placement,
  lakes, lanes, what a Tower is, the Flag itself, how a game ends, draws, and
  the fifty-move rule are all deliberately absent — see Out of scope. The one
  thing it says about a Tower is what happens when one is attacked.
- The **diagonal-attack rule choices** (`DIAGONAL_ATTACKABLE`,
  `DIAGONAL_ATTACK_PATH` — see `src/rules/primary/v2/ruleFlags.ts`) are
  deliberately not explained here. The page says only that a piece can attack
  an enemy standing immediately diagonally; the two settings that qualify
  _which_ enemies and _when_ are presented to the player where they are chosen,
  on the new-game screen. This constrains the pictures — see Design decisions.
- Relevant code today: `src/App.tsx` (the screen union and the shell that
  mounts each screen — no router, no URL routing); `src/app/StartScreen.tsx`
  and `src/app/StartScreen.css` (the three existing buttons, and the
  heading-focus-on-mount pattern); `src/review/ImportScreen.tsx` and
  `src/review/ReviewScreen.tsx` (the precedent for a screen whose "Back"
  control returns to the start screen without prompting, since nothing is lost
  by leaving); `src/art/PieceIcon.tsx` (`PieceIcon` and `PieceSpriteDefs`, the
  piece artwork and its symbol library); `src/rules/primary/v2/pieces.ts`
  (`PIECE_CATALOG` — rank 1 is the strongest, and the rank numeral drawn in
  each piece's corner is what the pictures rely on to read as "R1", "R2", …);
  `src/rules/primary/v2/movement.ts` and `combat.ts` (the rule logic the
  pictures must agree with); `src/board/Board.css` and
  `src/board/FullBoard.css` (the board's visual vocabulary — `--square`,
  `--parchment`, `--ink`, the side colors).
- The repo has **no DOM/component test environment** — Vitest runs in `node`
  only, and adding jsdom plus a component-testing library is a separate,
  already-proposed story
  (`doc/plan/proposed-stories/automated-accessibility-and-dom-testing.md`).
  That shapes how this story is verified: see Design decisions.

## Policy (fixed by the owner)

- **The button reads "How to play"**, with the detail line **"A quick guide to
  how the game works"**, and sits **first** in the start screen's list of
  choices, above "Play a game".
- **The start screen is the only place it is reached from.** The page is not
  reachable while placing, playing, or reviewing a game. (A player mid-game who
  wants it must leave the game, which the app already guards with its "leave
  this game?" prompt.)
- **The page is self-contained.** No outbound link to the companion
  repository's rulebook, and no link anywhere else. `README.md` already carries
  that link for a reader who wants the full text.
- **The copy below is the copy**, subject only to the spelling and grammar
  corrections listed under Copy. The page does not gain sections, caveats, or
  footnotes beyond what is written here.
- **The pictures are drawn by code that lives beside the core board code, not
  inside it.** They reuse the piece artwork; they do not reuse — and must not
  cause any change to — `Board.tsx`, `FullBoard.tsx`, `PlayBoard.tsx` or
  `grid/AccessibleGrid.tsx`. No prop, mode or branch is added to a core board
  component to serve this page.
- **No new dependencies**, and no router — the page is a new member of
  `App.tsx`'s existing screen union.

## Players and colors

Unchanged: first player = White = red (`#a13d2b`); second player = Black = blue
(`#33526b`). The page is not about a particular game in progress, so it has no
"active player" — it needs a _friendly_ side and an _enemy_ side, and should
use red for the piece the reader is invited to identify with and blue for the
enemy throughout, consistently across all ten pictures.

Player-facing vocabulary applies in full: the page says **"move"**, never
"ply", and names pieces as the rules name them (**Tower**, **Flag**) when it
names them at all.

## The page's content

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

_Picture 3_ — on a board cutout, a friendly piece with an enemy two squares in
front of it, marked as attackable.
_Picture 4_ — on a board cutout, a friendly piece with an enemy diagonally
beside it, marked as attackable.

### Right column

The six pictures in this column are drawn **without a board** — see Design
decisions.

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
   "formation bonus" and "Phase 1"/"Phase 2" — the page is written for players,
   not to match the rulebook's vocabulary.

## In scope

1. **The "How to play" button** on the start screen, first in the list, in the
   same visual treatment as the other three choices, going to the rules page.
2. **The rules page itself** — a screen carrying the header and the six
   sections, in a full-width header plus two-column layout that collapses to a
   single column when there is not room for two, with the left column's
   sections read before the right column's in every layout, and a "Back to
   start" control that returns without prompting.
3. **The ten pictures**, drawn from the game's own piece artwork — four on
   board cutouts, six without a board — each accompanied by a text equivalent
   conveying the same fact in the same plain language.
4. **A picture-drawing module that lives beside the core board code** and is
   reusable across all ten figures — cutout geometry, a piece drawn with or
   without a square under it, a move/attack marker, and the struck-out marking
   for a removed piece — with no change to the core board components.
5. **Automated agreement between the pictures and the rules.** Each figure's
   marked squares and each combat figure's outcome are stated as data and
   checked against `movement.ts` and `combat.ts`, so a picture cannot quietly
   go stale when a rule changes — **including the six figures that no longer
   draw a board**. See Design decisions.
6. **Keyboard and screen-reader parity** — reaching, reading and leaving the
   page works from the keyboard alone, and every picture's meaning is available
   non-visually.
7. **`README.md` updated** to mention that the app now explains the basics
   itself, in the same plain register as the rest of that file.

## Design decisions & constraints

- **The page is a screen, not a modal.** It joins `App.tsx`'s existing screen
  union alongside `start`, `play`, `import` and `review`; the start screen's
  button asks the shell to switch screens exactly as "Review a game" does. It
  scrolls as an ordinary page — no internal scroll region, no focus trap, no
  Escape-to-close. Leaving is a "Back to start" control following
  `ImportScreen`/`ReviewScreen`'s precedent: no confirmation prompt, because
  nothing is lost by leaving.
- **Focus on arrival goes to the page's own heading** (the `tabIndex={-1}`
  heading pattern `StartScreen.tsx` and `GameResult.tsx` already use), so a
  keyboard or screen-reader user landing there is not stranded on `<body>` and
  hears what the page is before its contents.
- **The pictures are illustrations, not a live board.** They are not
  interactive, they are not part of a grid in the accessibility tree, and they
  animate nothing. A reader should not be able to click, focus or arrow around
  them.
- **The four movement figures (1–4) are drawn on a 5×5 board cutout.** The
  board is what makes "two squares in that direction" and "diagonally beside
  it" legible, so it stays for every figure whose point is _distance or
  direction_ — including both "Movement for attacks" pictures.
- **The six combat figures (5–10) are drawn without a board** (the owner's
  decision). Their point is _who wins_, not where anyone stands, and the board
  made them busy. The pieces sit on their own, with a deliberate gap between
  attacker and defender for the arrow to occupy.
  - **Accepted consequence:** a gap between two pieces that are, in the rules,
    on adjacent squares. The arrow spanning it is what carries the relationship.
  - **Watch the rank-up figures (9 and 10).** Their rule condition is that the
    friendly same-rank piece is in one of the eight _surrounding squares_ —
    adjacency, which a board makes obvious and a void does not. The supporting
    piece must sit visibly closer to its partner than the gap the arrow crosses,
    so "beside it" still reads. If it cannot be made to read, that is worth
    raising rather than shipping an ambiguous picture.
- **Dropping the board does not drop the squares.** Every figure — the six
  board-less ones included — keeps its real board squares in the figure data,
  because those squares are what the rule-engine agreement check consumes. The
  board is removed from the _drawing_ only; a figure whose squares stopped
  being real would silently stop being checked.
- **Every combat figure is one picture, not a before-and-after pair** (the
  owner's decision). The pieces are shown as they stand when the attack is
  declared; an **arrow runs from the attacker to the defending piece**; and
  whichever piece or pieces the fight removes carry a **red X** drawn over them
  — one of them in pictures 5 and 6, both in 7, 8, 9 and 10.
  - **The arrow does double duty**: it marks the attack, and it is what conveys
    "the attacker moves to the destination square", which a single static
    picture cannot show outright — the attacker can only be drawn in one place.
    So the arrow must read as directional and must clearly terminate _on_ the
    defender, not merely point toward it.
  - **Reconciling the arrow with picture 3 and 4's attack marking.** Those two
    figures mark an enemy as attackable, on a board, without any fight
    happening. Whether they use this same arrow or a distinct "attackable"
    marking is a plan-time call, but the two must not look
    similar-but-different in a way that reads as a distinction the page never
    explains.
  - The red X must not be the only thing distinguishing a removed piece, per
    the color rule below, and must stay legible over both side colors, over
    the rank numeral in the piece's corner, and under the head of the arrow.
- **Figure data is pure; figure rendering is thin.** Because the repo has no
  DOM test environment, each figure is declared as plain data (which squares
  hold which pieces, which squares are marked, what the outcome is, and whether
  a board is drawn) in a `.ts` module with no React in it, and rendered by a
  thin `.tsx` component. The data module is then unit-testable in the existing
  node environment: place the same pieces on a real board layout and assert
  that the marked squares equal `legalDestinations`/`legalAttacks`, and that
  the combat figures' outcomes equal `resolveCombat`'s. The `.tsx` layer, like
  every other component in this repo, is verified by the manual gates.
- **Checking a figure against the engine needs a configuration**, and the
  choice matters: the diagonal figures are only legal under some values of the
  two diagonal-attack flags. Check the figures against the **default**
  configuration (`movable_only`, `always`) and additionally require that the
  diagonal figures stay legal under **every** value of both flags — that is
  what keeps the page honest about not covering those settings.
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
    illustrate a rule the game does not always have. This still holds with the
    board removed: the figure's underlying squares are still checked.
  - The board cutouts show **no lakes and no board edge**: every 5×5 window
    sits in open board, so nothing in a picture depends on geometry the page
    never explains.
- **The cutouts are a window onto a real board, not a 5×5 board.** Sizing them
  as a window is what makes the engine check above meaningful and keeps the
  squares reading at the same scale as the real thing.
- **Colors carry no meaning on their own.** Friendly-vs-enemy is red-vs-blue,
  but the pictures' text equivalents must say which side is which, and the
  markers for "can move here" and "can attack here" must be distinguishable
  from each other by shape, not only by fill — the page has no legend.

## Out of scope

- **Everything the six sections do not cover**: placement and the secret setup
  phase (named in the header's phase line, but not explained), lakes and lanes,
  what a Tower is and why it cannot move, capturing the Flag, how a game ends,
  resignation, draws by agreement, and the fifty-move rule. The page is a
  primer, not a rulebook, and the sections it has are the sections it gets.
  Note that the equal-rank section now covers _attacking_ a Tower — what
  happens in that fight — without saying anything else about Towers.
- **The diagonal-attack settings themselves** — explained where they are
  chosen, not here.
- **Reaching the page from anywhere other than the start screen.**
- **Any link out of the app**, including to the companion rulebook.
- **Any change to the rules code** (`src/rules/`), the core board components,
  or the game itself. This story is read-only with respect to how the game
  plays.
- **A DOM/component test environment**, which stays the separate proposed
  story it already is; this story must not need one.
- **A router, or a URL of the page's own.** The app has never had URL routing
  and does not gain it here.
- **Localization and printing.**

## Manual-verification gates

- **Gate A — The button and the page.** From the start screen, "How to play" is
  the first choice and goes to the rules page; the header (both lines under the
  title), six sections and ten pictures are all present, with the copy exactly
  as written above. "Back to start" returns to the start screen unchanged, with
  no confirmation prompt, and going back in works.
- **Gate B — The pictures say what the sentences say.** Read each section with
  the rules open: picture 1 shows eight destinations, picture 2 shows four,
  pictures 3 and 4 mark the enemy as attackable on a board cutout, and pictures
  5–10 each run an arrow from the attacker to the defender and strike out
  exactly the right piece or pieces — one in 5 and 6, both in 7, 8, 9 and 10.
  Nothing in a picture contradicts its sentence; the arrow reads as the
  attacker arriving rather than merely pointing; and in pictures 9 and 10 the
  supporting piece reads as standing _beside_ its partner despite there being
  no board.
- **Gate C — Layout.** At a comfortable desktop width the header spans the full
  page and the two columns sit side by side; narrowing the window collapses
  them to one column with movement still read before combat; the page scrolls
  normally rather than being clipped, on both a short viewport and a narrow
  one.
- **Gate D — Keyboard and screen reader.** With the mouse put away: the button
  is reachable and activates, focus lands on the page's heading on arrival,
  every section and control is reachable in reading order, and "Back to start"
  returns to the start screen. With a screen reader: every section's heading
  and sentence is read, every picture has a text equivalent that conveys the
  same fact, and no picture presents itself as a table or grid to be navigated.
- **Gate E — Nothing else moved.** A Battle, Skirmish and Clash game each still
  set up, play and end exactly as before, and importing and reviewing a
  recorded game is untouched — the new screen must not have disturbed the
  shell's existing routing.

## Open items to resolve at plan time

- **What a move marker and an attack marker actually look like**, given they
  must differ by shape and not only by color, and that the page carries no
  legend. The board's own `--destination` and `--attack` highlights are a
  starting point but were designed for a board with a live selection on it, not
  for a static picture.
- **How the arrowhead and the red X sit together** in the six combat figures
  without either becoming unreadable — the defender carries an arrow
  terminating on it, an X over it, and a rank numeral in its corner. Related:
  whether the struck-out piece is dimmed as well as crossed, which would carry
  the meaning for a reader who cannot pick the red out; and whether pictures 3
  and 4 reuse the same arrow.
- **How a board-less figure is laid out** — how big the gap is, how the
  supporting piece in figures 9 and 10 is placed so adjacency reads, and
  whether the piece positions are derived from the figure's real squares or
  stated separately for the void.
- **How each picture's text equivalent is worded and attached** — settled for
  the popup as a visible caption per figure; confirm that still holds on a page.
- **How much of the cutout's look is shared with `Board.css`** without coupling
  to it: reusing the CSS custom properties (`--parchment`, `--ink`, the side
  colors) is clearly right, reusing the board's class names clearly is not, and
  the line between them wants drawing deliberately.
- **What the "Back to start" control looks like and where it sits**, matching
  the existing back controls on the import and review screens.
- **The step decomposition** for the work that remains, given Steps 1–3 of the
  original plan are already committed and Step 3 built a modal that now has to
  become a screen.
