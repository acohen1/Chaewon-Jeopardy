<!-- Cumulative changelog - NEWEST version section on top; keep the old ones. -->
<!-- Each release section starts with a line containing only "##", a space, and -->
<!-- the version with a leading v - nothing else on that line, ever. Do NOT put -->
<!-- that pattern anywhere else in this file (including these comments): the -->
<!-- release workflow and the in-app parser both treat it as a section start. -->
<!-- The workflow ships ONLY the section matching desktop/package.json's version -->
<!-- as the release body / in-app "What's new", and FAILS the release if that -->
<!-- section is missing - notes can't be stale or forgotten. -->
<!-- Release prep = bump desktop/package.json + add a new section here, one commit. -->
<!-- Plain lines and "- " bullets render best in-app. Subsections within a -->
<!-- version use "###" headings (rendered as small accent headings in-app, -->
<!-- h3 on GitHub). NEVER use two-hash subheadings: the in-app parser splits -->
<!-- on those and would silently discard everything after one. -->

## v2.4.0

We are Rhubarb now! 🌱 Same game, new name — and the biggest quality-of-life update yet.

### New name: Rhubarb

- Everything says Rhubarb — the app, the installer, the board, the shortcuts
- Your boards, scores, and settings move over automatically; nothing to do
- Board files now save as .rhubarb (old .jeopardy files open forever)
- New permanent download link: github.com/acohen1/rhubarb — old links redirect
- A proper update screen: watch the install happen instead of wondering if anything is

### Game settings, all grown up

- The old Rules button is now a full Game settings menu: turn order, buzzers, media, and scoring in one organized place — in the editor and in play
- Buzzers arm themselves the moment a clue opens (switch it off to keep the classic read-first-then-arm flow)
- Two game clocks: an optional time-to-buzz-in window once the buzzers arm, and a time-to-answer countdown once somebody claims it — steal rounds get their own fresh window
- Every clock takes any custom length via a Custom… field, not just the preset pills
- The manual timer is its own setting: with the buzz-in clock off, pressing T runs a hand-started buzz window at whatever length you choose
- Slides with a single video or song start playing on reveal, automatically — slides with several clips stay manual so nothing talks over anything (and you can turn it all off)
- Allow negative scores moved off the top bar and into Game settings
- As always: whatever you pick becomes the default for your next board

### The clue screen, TV-first

- The timer is now a big draining ring (sage for buzz-in, amber for the answer clock) that turns urgent in the last seconds
- When somebody buzzes, their name slams onto the screen with couch-sized Correct / Wrong buttons — all in one corner card that never covers the question
- False-start lockout: buzzing before the buzzers arm freezes YOUR buzzer for half a second, so mashing is a losing strategy and clean timing wins

### Hosting & rounds

- New game and the podium's Play again now truly start fresh: the roster clears too — connected phones keep their seats and come back at $0 (the score-only and board-only reset tools are unchanged)
- Invite over the internet now also lives in the mid-game Room panel
- Fixed: a wrong-answer lockout no longer follows a player into later questions — every fresh clue reopens the buzzers to everyone

### Editor & library

- Undo, everywhere: Ctrl+Z / Ctrl+Y now work inside the cell editor too — take back an accidental media delete, reorder, upload, or volume drag (one drop of several files undoes as one step)
- The board grid fills the window: a short board stretches to use the space instead of huddling tiny at the top
- Shared boards finally keep their rules — exporting and importing no longer resets turn order and settings
- Tidy media now speaks human: sizes show as KB / MB / GB, and the confirm tells you exactly how much you'll get back (nothing is ever deleted automatically — cleanup stays your call)

## v2.3.0

The Party Update — your phones are the buzzers now:

- Host a game and friends join in seconds: scan the QR or type the room code from any phone or laptop on your wifi — nothing to install
- Or invite the whole internet: "Invite over the internet" opens a secure tunnel and the QR becomes a link that works from anywhere — no accounts, no setup
- Every game opens in a lobby: giant code and QR for the TV, the roster filling up live, then Start game rolls a roulette for who goes first
- Real buzzers — first buzz wins, a wrong answer locks you out while the others steal, and the host settles it in one click (✓ Correct / ✗ Wrong, or the C and W keys)
- Your phone knows the score: your money front and center, live standings, and a big +$400! flash when points land
- Joining is personal — pick who you are from the roster; if your phone dies mid-game, pick yourself again and your score is right where you left it
- The host can disconnect any device from the roster (scores always stay safe)
- Turn order, your way — new Rules menu in the editor and in play: first correct answer picks next (real Jeopardy), take turns in order, or the host hands the board around; whoever has the board wears the gamepad on the scoreboard and sees "Your pick!" on their phone
- Daily Doubles finally know who's wagering: pick the wagerer, and the wager is capped by the real rule — your score or the top row, whichever is higher
- Your rule choices are remembered as the defaults for every new board
- New game (in the top bar) resets scores and the board and heads back to the lobby for a fresh start — connected players ride along
- Present mode: Esc now does one thing at a time (leaving fullscreen no longer also closes the clue)

## v2.2.2

Updates, but make them smooth:

- Hitting Restart on an update now installs silently and relaunches the app — no more setup wizard mid-update (it still greets first-time installs)
- Checking for updates while a new version is still being published now says exactly that, instead of a wall of error text
- Fixed "What's new" and Version history showing the wrong notes after an update
- The installer clears lingering background processes before updating, so updates stay reliable even from much older versions

## v2.2.1

- Fixes the app failing to start after an update on some machines ("spawn UNKNOWN") — updates now install reliably
- If anything does go wrong, the app now explains what happened and keeps a log to help us fix it

## v2.2.0

Game night, upgraded:

- ★ Bonus tiles — mark any tile as a secret Daily Double: it opens with a reveal splash and the host sets the wager
- Sound effects — tile picks, correct dings, wrong buzzes, and a podium fanfare (press M to mute)
- Finish game — podium finale with confetti and final standings, plus one-click play-again
- The editor flags questions that are missing answers, and warns before you start playing
- Undo and redo in the editor (Ctrl+Z / Ctrl+Y)
- Duplicate as Double — instant round two with doubled values, scores carried over
- Tidy media in Settings — clean up uploads no board uses anymore
- About now shows the full version history, not just the latest notes

## v2.1.0

Chaewon Jeopardy is back — rebuilt from the ground up. Same game you know, brand-new engine underneath:

- Board library — build and keep as many boards as you want, with autosave while you edit (no more Save dialogs)
- Your old boards still work: legacy .json saves import directly
- Build slides with any mix of images, GIFs, video, and audio — up to 4 per slide
- Stacked audio plays layered tracks in perfect sync, instantly
- Scores, used cells, and game state survive closing the app mid-game — pick up right where you left off
- Host tools: click a score to fix it, undo any award, full scoring history
- Present mode (P) for the TV, clue timer (T), and hotkeys everywhere — press ? to see them
- Second screen over wifi: turn it on in Settings and open the board on a TV or phone browser
- Share boards as .jeopardy files — double-click one to import it
- Real install wizard — pick where it goes (or keep the sensible default), no admin needed
- Start Menu and desktop shortcuts, plus a clean uninstaller that keeps your boards safe
- Updates install themselves from here on out
