# Manual end-to-end checklist

Run this checklist against a disposable Sleeper mock draft after `./build_extension` succeeds.

## Setup

- Reload the unpacked extension from `chrome://extensions`.
- Refresh the Sleeper draft tab so the current content script is installed.
- Open the extension side panel from the active Sleeper draft tab.
- Import the intended draft-board workbook and confirm player, target, and warning counts.

## Connection and availability

- Confirm the correct draft name, format, current pick, total picks, and future-keeper count.
- Open **Connection diagnostics** and confirm the draft ID and page-marker counts match the board.
- Start or resume the draft and confirm the current pick and available-player lists update promptly.
- Confirm a newly drafted player disappears from recommendations and Personal Targets.
- Pause the draft and confirm the last successful data remains visible.

## Picks, trades, and keepers

- Confirm Upcoming Picks includes acquired selections and excludes traded-away selections.
- Confirm keeper-occupied owned selections do not appear as upcoming picks.
- Confirm the Current Roster includes keepers attached to acquired picks.
- Confirm the Current Roster excludes keepers attached to traded-away picks.
- Confirm ordinary completed selections appear only on the roster that received the player.

## Recommendations and targets

- Confirm QB, RB, WR, and TE tabs rank only available matched players.
- Confirm the Best 3, 5, and 8 dropdown changes the displayed recommendation count.
- Confirm Personal Targets shows 3, 5, or 10 available targets and removes drafted targets.
- Change Target reach and confirm draft/trade-up timing moves earlier by that many Sleeper-value picks.
- Confirm the remaining-player timing compresses appropriately when high-ADP keepers are unavailable.

## Roster allocation

- Confirm a player fills an open natural starting slot before FLEX or SUPER FLEX.
- Confirm a second quarterback goes to the bench in a one-QB league unless SUPER FLEX is open.
- Confirm an incompatible extra player expands the bench when another starting position remains open.
- Confirm names and positions remain correct for players not present in the imported workbook.

Record the draft ID, observed behavior, and screenshots for any failed item before changing the mock
draft. The Connection diagnostics values and visible draft-board markers should make the scenario
reproducible.
