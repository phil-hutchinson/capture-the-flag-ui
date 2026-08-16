# Capture the Flag — Play in Your Browser

Capture the Flag is a two-player battlefield board game. Each player secretly
arranges an army — soldiers, knights, towers, and one all-important flag —
then the armies are revealed and the battle begins. Pieces move and clash in
full view until one side captures the other's flag.

There are four games to choose from. **Skirmish** is the shortest one:
sixteen pieces a side on a small board, and a good place to start. **Clash**
is a mid-size game: twenty pieces a side on a bigger board with lakes laid
out unevenly, so the two halves don't mirror each other. **Battle** is the
full game: twenty-five pieces a side on a board more than twice the size of
Skirmish's. **Demotion** plays quite differently from the other three: it's
fought on a fixed 8x8 board with both armies already set out and ready to
fight — a fresh arrangement every game, so no two games start the same way.

This is the game's web app. It runs entirely in your browser — nothing to
install, no account, no server. It opens on a start screen where you can play
a game or read a quick guide to how the game works.

## What you can do

- **Learn how to play** — the start screen's "How to play" button opens a
  short illustrated page covering how pieces move, when they're slowed down,
  how far an attack reaches, and how a fight is decided, all shown with the
  game's own pieces. It's a quick primer, not the official rules — see
  [The rules](#the-rules) below for the full rulebook.
- **Set up a game with a friend** on the same device — pick Skirmish, Clash,
  Battle, or Demotion. For the first three, choose how you'd like diagonal
  attacks to work for this game, then take turns secretly choosing where on
  your side of the board to place your army (you won't fill every square),
  then hand off. In Skirmish, a tower can't stand directly in front of a
  lane, one of the open columns running through the middle of the board.
  When both armies are placed, the game is ready for battle. Demotion skips
  all of that: pick it and you're straight into the fight, with no army to
  place and no hand-off — both sides' pieces are already on the board.
- **Move, attack, and capture on the battlefield** — once both armies are
  revealed, take turns moving pieces across the board in full view. Moving a
  piece onto an enemy piece attacks it, and the fight resolves immediately —
  the losing piece (or both, if they're evenly matched) leaves the board. A
  piece can also attack an enemy standing diagonally next to it, though it can
  only ever move straight; whether that can also reach a tower or the flag,
  and whether it needs a clear square beside the two pieces, depends on the
  diagonal-attack settings you picked when you set up the game. The board
  stays on red's side by default; a "Flip board between turns" switch lets
  you turn on flipping the board to face whoever's turn it is — handy if
  you're two players passing one device back and forth. Demotion has its own
  twist: a piece that wins a fight comes out of it weaker, dropping one rank
  every time it survives a battle, and its ranks run the opposite way from
  the other three games — rank 5 is the strongest piece there, not rank 1.
- **Win, lose, or draw** — capture your opponent's flag and the game is
  yours. In Skirmish, Clash, and Battle you can also win if your opponent is
  left with no legal move at all. Demotion ends that situation sooner and more
  bluntly: a player worn down to nothing but their flag has no army left and
  loses on the spot, without waiting for their turn. A game
  can end in a draw too: by agreement, or if too many moves go by in a row
  with no piece captured — you'll see a warning as that point gets close,
  fifty moves for Skirmish, Clash, and Battle, forty for Demotion. Demotion
  also offers one more way to lose: a player can resign at any point, which
  ends the game immediately in the opponent's favor. However it ends, the
  app tells you who won and why, leaves the final position on screen, and
  offers you a new game.
- **Play without a mouse** — the whole game, from choosing a game and placing
  your army through to the final move, works entirely from the keyboard, and
  reads well with a screen reader too.

> **Status:** you can play a full game from start to finish in any of the
> four games — set up and place your armies (Demotion starts already set out,
> with no placing to do), battle it out on the revealed board, and reach a
> real result. Saving a game you played here, playing against the computer,
> and reviewing recorded games aren't available yet.

## The rules

The official rulebook lives in the companion repository and is the single
source of truth:
[rules.md](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/rules.md)
(with a [change log](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/changelog.md)).
The game is still in active pre-release development, and the rules are
evolving with it. The app has now moved to the latest rules, which brought
the current games and diagonal attacks.

The two diagonal-attack settings on the new-game screen aren't official rules
yet — they're proposals from the companion project's
[proposed-variants.md](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/proposed-variants.md)
sandbox, offered here so players can try them out before anything is decided.

Clash's board and army aren't official rules yet either — they're a proposal
from the same
[proposed-variants.md](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/proposed-variants.md)
sandbox, offered here on equal footing with Skirmish and Battle so the
companion project can see it played before deciding whether to adopt it.

Demotion isn't an official rule yet either, and it's a bigger proposal than
the other two: a whole separate rulebook of its own, rather than a setting on
top of the existing rules. It comes from the companion project's
[proposed-3 rules](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/proposed-3/rules.md)
draft, offered here on equal footing with Skirmish, Clash, and Battle so the
companion project can see it played before deciding whether to adopt it.

## Development

The app is a TypeScript/React single-page application with no backend — it can
be served from any static file host. The repo ships a VS Code Dev Container
that provisions the full toolchain automatically; see
[CONTRIBUTING.md](CONTRIBUTING.md) for setup and conventions.
