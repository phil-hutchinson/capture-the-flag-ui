# Story 00000034 — Initial tidyup before showing the app to people

## Summary

The app is about to be put in front of people for the first time — friends and
other players opening it cold, with no explanation, to see what the game feels
like. Everything in it works, but not all of it is worth showing yet: two of
the start screen's four choices lead somewhere a first-time viewer has no
reason to go, some of the copy is longer than it needs to be, and a
developer-facing panel sits at the bottom of the game screen where a player can
see it.

This story is a **presentation pass only**. It hides the parts that aren't
ready to be seen, shortens some copy, and changes one default. No behaviour
changes, no rules change, nothing is deleted.

What a player will notice:

- **Two choices, not four, on the start screen** — "How to play" and "Play a
  game". "Play against the computer" and "Review a game" are gone from view.
- **Shorter descriptions on the new-game screen**, and a plain **"Play"**
  button.
- **The board no longer flips between turns by default.**
- **No developer panel** under the game.

## Policy (fixed by the owner)

**Nothing is removed — everything hidden here comes back.** This is the
governing constraint of the whole story, and it applies to every item below
that hides something:

- The hidden features' code stays exactly where it is: components, screens,
  routing, props, styles and tests all remain in the tree and keep working.
  Only the way in is hidden.
- Re-enabling a hidden feature must be a **single obvious change in a single
  obvious place** — findable by someone who wasn't here when it was hidden,
  without hunting through components. A deletion "recoverable from git
  history" does not satisfy this.
- Copy that is being shortened *is* edited in place (the old wording is in git
  history and is not coming back as-is); only the *features* are hidden rather
  than removed.

## In scope

### 1. Hide two start-screen choices

`src/app/StartScreen.tsx` renders four choices. Two of them are hidden:

- **"Play against the computer"** — currently rendered visible-but-disabled,
  with a note explaining that the computer player needs to catch up with the
  rules. A viewer seeing the app for the first time doesn't need to be told
  about a feature they never knew existed; the explanation is more noise than
  the option is worth.
- **"Review a game"** — recorded-game replay works, but nothing this app
  produces can be reviewed yet (records come from the companion project's
  engine), so a first-time viewer has no file to open and only meets a dead
  end.

"How to play" and "Play a game" remain, in that order.

The import and review screens themselves stay in `App.tsx`'s screen union and
stay wired to `StartScreen`'s existing `onReviewAGame` prop; they simply
become unreachable while the button is hidden. The same holds for the disabled
computer button's markup and its explanatory note.

### 2. "How to play" header — second line

`RULES_HEADER.lines[1]` in `src/app/rules/rulesCopy.ts`:

- **From:** `Place your pieces in phase one; battle your opponent in phase two.`
- **To:** `Place your pieces in phase one — battle your opponent in phase two`

The semicolon becomes a dash and the trailing period goes, matching the first
line, which already ends without one. `rulesCopy.test.ts` asserts this string
verbatim and is updated with it.

This is a copy edit, not a hidden feature: the old wording is not preserved
behind a flag.

### 3. New-game screen — shorter copy

In `src/board/GameChoice.tsx`, `GAME_DETAIL` becomes:

| Game     | Description                                             |
| -------- | ------------------------------------------------------- |
| Skirmish | `Play on an 8x8 board with a 16-piece army.`            |
| Clash    | `Play on a 10x10 board with a 20-piece army. Irregular lakes.` |
| Battle   | `Play on a 12x12 board with a 25-piece army.`           |

Two earlier stories' deliberate additions are dropped by this, knowingly:

- Skirmish's tower/lane clause (story 00000025, Step 7 — "so a player meets the
  rule before it ever refuses them at placement"). A player who tries an
  illegal tower placement is still told why at placement time; that is now the
  only place the rule is explained.
- Clash's fuller lake explanation (story 00000030, Step 9 — the lake hard
  against the left edge, the missing lane, the widest lake blocking three
  columns) is compressed to "Irregular lakes."

The **button** at the foot of the screen reads **"Play"**, not
"Play Skirmish" / "Play Clash" / "Play Battle". The selected game is already
shown as pressed directly above it.

### 4. Diagonal-attack copy — "strike" → "attack"

In `src/board/ruleChoices.ts`, the `DIAGONAL_ATTACKABLE` / `all` description:

- **From:** `A piece can strike any enemy standing diagonally next to it, towers and the flag included — so the flag can be captured from a diagonal.`
- **To:** `A piece can attack any enemy standing diagonally next to it, towers and the flag included — so the flag can be captured from a diagonal.`

"Attack" is the word the rules, the "How to play" page and the rest of the app
use for this; "strike" was the odd one out. The same swap applies to the same
explanation wherever else it appears in player-facing text (`README.md` carries
a version of it).

### 5. Board flip defaults to off

`DEFAULT_FLIP_BETWEEN_TURNS` in `src/board/flipBoardSetting.ts` becomes
`false`. The "Flip board between turns" toggle stays exactly where it is and
still works both ways; only the starting value changes.

Rationale: two people passing one device is the case the flip was built for,
but most of the people looking at this app will be driving both sides
themselves, and a board that spins between turns is disorienting when you are
playing both sides.

### 6. Hide the developer game-record panel

`GameRecord` (`src/board/GameRecord.tsx`, rendered by `HotSeatGame.tsx`) shows
a collapsed "Developer: inspect game record" disclosure at the foot of the
game screen. It is hidden from the game screen — the component, its styles and
its record-rendering stay in place.

### 7. README brought in line with what a viewer can see

`README.md` describes the start screen, the two hidden options, and the flip
default. It is updated to match what the app now shows, in its existing plain
register, **without** narrating the hiding as a temporary state any more than
it already does for the computer player. A viewer reading the README should not
be told about buttons that aren't there.

## Design decisions & constraints

- **One place to re-enable things.** All the hiding in items 1 and 6 should be
  driven from a single small module of named booleans (a `featureVisibility.ts`
  or similar) rather than from ad-hoc edits at each render site — one constant
  per hidden thing, named for what it hides, each carrying a one-line comment
  saying why it is off and what turning it on restores. Flipping one constant
  to `true` restores that feature with no other edit. The exact shape is a
  plan-time call; the property that matters is: **one file, one line per
  feature, no hunting.**
- **No conditional logic beyond visibility.** Hiding a choice must not change
  what any other screen does, reorder anything that stays, or alter the game.
  If hiding the review button makes the import screen unreachable, that screen
  is left intact and unreachable — it is not also stripped out of the screen
  union.
- **The flip default only affects devices with nothing stored.** The setting is
  persisted in local storage (`ctf:flip-board-between-turns`), so a browser
  that has already stored `true` keeps flipping. That's correct behaviour — a
  stored preference outranks a default — but it means the owner's own browser
  may not show the change until its stored value is cleared or the toggle is
  used. Do **not** rename the storage key to force the new default onto
  everyone; the caveat is accepted, and the manual gate is checked in a browser
  with no stored value (a private window is enough).
- **Dev-build console logging of the game record stays.** `GameRecord`'s
  `console.log` under `import.meta.env.DEV` is invisible to a viewer and is not
  part of what this story hides.
- **The disabled-button accessibility treatment is not touched.** The
  "Play against the computer" button's `aria-disabled` + no-op handler pattern
  (story 00000002, decision 7) stays as written in the hidden markup, so that
  restoring it restores the accessible version, not an older one.
- **No new dependencies, no build-time configuration, no environment
  variables.** This app is deployed as static files from a plain build; a
  compile-time constant in source is the mechanism.

## Out of scope

- **Deleting any feature, screen, component, style or test.** Explicitly ruled
  out by Policy.
- **Any change to rules, engine, encoding or game behaviour** (`src/rules/`,
  `src/engine/`, `src/encoding/`). This story cannot change how a game plays or
  how a record is written.
- **Making the computer player or record-saving work.** Both stay where they
  are; this story only stops advertising one of them.
- **Any other copy change** than the ones listed above — the game screens,
  placement copy, result copy, warnings and the "How to play" page's six
  sections are all left exactly as they are.
- **Visual redesign** — no new layout, spacing, colour or typography work.
  Hiding two of four start-screen choices may leave the layout looking sparse;
  if it does, that's noted at the gate and handled as its own story, not
  fixed here.
- **A user-facing settings screen** for any of the hidden features.

## Manual-verification gates

- **Gate A — Start screen.** The start screen offers exactly two choices, "How
  to play" then "Play a game", both working. Nothing on the page hints at a
  missing option, and keyboard tabbing moves between exactly those two buttons.
- **Gate B — New-game screen.** Skirmish, Clash and Battle each show their new
  one- or two-sentence description exactly as written above, the button reads
  "Play", and it starts the game currently selected — including after switching
  the selection. The diagonal-attack choice describing any-piece attacks says
  "attack", not "strike".
- **Gate C — How to play.** The header's second line reads
  "Place your pieces in phase one — battle your opponent in phase two", with a
  dash and no trailing period; the rest of the page is unchanged.
- **Gate D — Game screen.** In a browser with no stored setting, a new game
  starts with "Flip board between turns" **unchecked** and the board staying on
  red's side across a hand-off; ticking it flips as it always did, and the
  choice still persists across a reload. No developer panel appears anywhere on
  the game screen.
- **Gate E — Nothing broke.** A full Skirmish game plays start to finish and
  reaches a real result; a Clash and a Battle game each set up and play a few
  moves.
- **Gate F — Reversibility.** Flipping each visibility constant back to `true`
  restores that feature exactly as it was: both start-screen choices reappear
  in their original order and treatment, "Review a game" reaches the import
  screen and a record still replays, and the developer panel returns under the
  game. This gate is checked and then reverted — the committed state has them
  all hidden.

## Open items to resolve at plan time

- **Where the visibility constants live and what they're called** — one module
  used by both `StartScreen.tsx` and the game screen, or something narrower. It
  should be discoverable from the file names alone.
- **Whether hiding a start-screen choice happens at the button or at the list**
  — i.e. whether `StartScreen` renders a filtered list of choice descriptors or
  simply wraps two blocks in a condition. The second is smaller; the first may
  read better with two of four gone.
- **How much of README's "What you can do" section moves** versus staying with
  a lighter touch — the review and computer-player bullets both describe things
  a reader can no longer reach.
