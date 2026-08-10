# Capture the Flag — Play in Your Browser

Capture the Flag is a two-player battlefield board game. Each player secretly
arranges an army — soldiers, knights, towers, and one all-important flag —
then the armies are revealed and the battle begins. Pieces move and clash in
full view until one side captures the other's flag.

There are three games to choose from. **Skirmish** is the shortest one:
sixteen pieces a side on a small board, and a good place to start. **Clash**
is a mid-size game: twenty pieces a side on a bigger board with lakes laid
out unevenly, so the two halves don't mirror each other. **Battle** is the
full game: twenty-five pieces a side on a board more than twice the size of
Skirmish's.

This is the game's web app. It runs entirely in your browser — nothing to
install, no account, no server. It opens on a start screen where you can play
a game, review a recorded one, or read a quick guide to how the game works.
Playing against the computer is temporarily unavailable while the computer
player catches up with the latest rules.

## What you can do

- **Learn how to play** — the start screen's "How to play" button opens a
  short illustrated page covering how pieces move, when they're slowed down,
  how far an attack reaches, and how a fight is decided, all shown with the
  game's own pieces. It's a quick primer, not the official rules — see
  [The rules](#the-rules) below for the full rulebook.
- **Set up a game with a friend** on the same device — pick Skirmish, Clash,
  or Battle, choose how you'd like diagonal attacks to work for this game, then
  take turns secretly choosing where on your side of the board to place your
  army (you won't fill every square), then hand off. In Skirmish, a tower
  can't stand directly in front of a lane, one of the open columns running
  through the middle of the board. When both armies are placed, the game is
  ready for battle.
- **Move, attack, and capture on the battlefield** — once both armies are
  revealed, take turns moving pieces across the board in full view. Moving a
  piece onto an enemy piece attacks it, and the fight resolves immediately —
  the losing piece (or both, if they're evenly matched) leaves the board. A
  piece can also strike an enemy standing diagonally next to it, though it can
  only ever move straight; whether that can also reach a tower or the flag,
  and whether it needs a clear square beside the two pieces, depends on the
  diagonal-attack settings you picked when you set up the game. By default the
  board flips to face whoever's turn it is; a "Flip board between turns"
  switch lets you turn that off and keep the board on red's side the whole
  game — handy if you're playing both sides yourself.
- **Win, lose, or draw** — capture your opponent's flag and the game is yours.
  You can also win if your opponent is left with no legal move at all. A game
  can end in a draw too: by agreement, or if fifty moves go by in a row with
  no piece captured — you'll see a warning as that point gets close. However
  it ends, the app tells you who won and why, leaves the final position on
  screen, and offers you a new game.
- **Review a recorded game** — choose a game record file from your device and
  watch the battle again: step forward and back a move at a time, jump to the
  start or the end, or click any move in the list to go straight to it. The
  board shows the last move made, and at the end you see the result the record
  claims. The file is read on your device — nothing is uploaded. Records come
  from the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  project's engine; a game you play here can't be saved or reviewed yet.
- **Play against the computer** — temporarily unavailable. The option is still
  on the start screen, but it can't be chosen: the rules have moved on and the
  computer player needs to catch up before it can play the two games properly.
  It will return, and a properly trained opponent is still on the way.
- **Play without a mouse** — the whole game, from placing your army through to
  the final move, works entirely from the keyboard, and reads well with a
  screen reader too.

> **Status:** you can play a full game from start to finish — pick Skirmish,
> Clash, or Battle, place both armies, battle on the revealed board, and reach
> a real result — and review a recorded game move by move. Playing against
> the computer is paused for now, and saving a game you played here is still
> to come.

## The rules

The official rulebook lives in the companion repository and is the single
source of truth:
[rules.md](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/rules.md)
(with a [change log](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/changelog.md)).
The game is still in active pre-release development, and the rules are
evolving with it; a recorded game only plays back correctly in the ruleset
version it was recorded under. The app has now moved to the latest rules —
which brought the current games and diagonal attacks — so recordings made
under the earlier rules can no longer be reviewed here.

The two diagonal-attack settings on the new-game screen aren't official rules
yet — they're proposals from the companion project's
[proposed-variants.md](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/proposed-variants.md)
sandbox, offered here so players can try them out before anything is decided.

Clash's board and army aren't official rules yet either — they're a proposal
from the same
[proposed-variants.md](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/proposed-variants.md)
sandbox, offered here on equal footing with Skirmish and Battle so the
companion project can see it played before deciding whether to adopt it.

## Development

The app is a TypeScript/React single-page application with no backend — it can
be served from any static file host. The repo ships a VS Code Dev Container
that provisions the full toolchain automatically; see
[CONTRIBUTING.md](CONTRIBUTING.md) for setup and conventions.
