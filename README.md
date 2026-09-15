# Sleeper Draft Assistant

A local-first Chrome extension that combines a model-generated fantasy football draft board with live Sleeper draft data.

## Current status

The project currently includes:

- A Manifest V3 extension scaffold
- A persistent Chrome side panel
- A Sleeper draft-page content script
- Draft URL and ID detection
- A background service worker
- TypeScript, React, Vite, and esbuild build tooling
- Formatting, linting, type checking, and unit tests
- Separate regression and verified-build entry points
- Local XLSX draft-board import from the side panel
- Strict Draft Board schema validation with actionable row diagnostics
- Normalized QB, RB, WR, and TE records, including model/Sleeper ADP and SOS
- Optional `isTarget` and Sleeper player ID columns
- Transactional IndexedDB persistence of the active board and import metadata
- Safe replacement behavior: an invalid new workbook never replaces the last valid board
- Position-filtered Sleeper player catalog synchronization for QB, RB, WR, and TE
- A 24-hour IndexedDB catalog cache with stale-cache fallback when Sleeper is unavailable
- Deterministic player matching by provided ID, normalized name, position, and team disambiguation
- Suffix-tolerant matching for names such as `Kenneth Walker III`
- Persisted Sleeper player IDs with a consolidated warning only when players need review
- Automatic connection to the Sleeper draft or mock draft in the active browser tab
- 750-millisecond pick polling while a draft is active, with slower pre-draft and retry intervals
- Full-response availability rebuilding so refreshes recover from missed intermediate updates
- Current overall-pick calculation that accounts for future keeper slots
- Visible connecting, stale, failed, pre-draft, drafting, and complete states
- A single position-tabbed viewer for the top three available QB, RB, WR, or TE recommendations
- A compact dropdown for showing the best 3, 5, or 8 available players
- Current-pick timing against both model ADP and Sleeper ADP
- Model position rank and projected positional strength of schedule on every recommendation
- Automatic user, draft-slot, and roster detection in single-user mock drafts
- Locally saved Sleeper username identity for multi-user drafts
- Snake and linear future-pick scheduling with traded-pick ownership
- Keeper-aware upcoming selections displayed in a dedicated card beneath Personal Targets
- A global model-ADP-ordered list of the next 3, 5, or 10 personal targets
- Live removal of drafted targets using stable Sleeper player IDs
- A persisted target-reach tolerance measured against Sleeper's live remaining-pool value
- Remaining-pool wait, draft-now, and trade-up guidance based on upcoming owned picks
- A live lineup card with natural-position-first flex allocation, expandable bench space, and keepers
- Expandable connection diagnostics with sync, retry, and page-marker details

## Requirements

- Node.js 20 or newer
- pnpm 11
- Chrome 114 or newer

## Install and build

```bash
pnpm install
pnpm run build
```

The loadable extension is generated in `dist/`.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this project's `dist/` directory.
5. Open a Sleeper page and click the extension action to open the side panel.

Browser end-to-end validation is performed manually by the project owner.

## Import a draft board

Open the extension side panel and choose **Import draft board**. Select an `.xlsx` or `.xls`
workbook containing a worksheet named `Draft Board`. The importer locates the header within the
first 25 rows and requires these columns (recognized aliases are also supported):

- `Player`
- At least one of `Model Pos Rank`, `User Pos Rank`, or `Expected Overall ADP`

The repository includes a ready-to-import
[example draft board](examples/2026_Draft_Board_Example.xlsx) with `Player`, `Targets`,
`User Pos Rank`, and `Projected Pos SOS`. It can be imported directly or copied and edited to create
a personal board.

An optional `Targets` column treats any non-empty cell as a target marker; the marker text itself
does not matter. Empty or whitespace-only cells are non-targets. `target` and `isTarget` are
recognized header aliases. If the column is absent, all players are imported as non-targets and a
warning is shown. `Pos`, `Team`, and `Projected Pos SOS` are optional; Sleeper supplies position and
team after name matching, and absent SOS is omitted from player cards. An optional `Sleeper Player
ID` column can resolve rare ambiguous names. `Current Pos ADP` and `Sleeper Overall ADP` columns are
ignored because live Sleeper data is authoritative. Kicker and defense rows are intentionally
ignored when a position is supplied.

`Model Pos Rank` and `User Pos Rank` provide the same ranking input. The selected header controls
whether the interface calls the imported ranking Model or User. When only Expected Overall ADP is
supplied, the extension derives a positional rank by ordering the matched players within each
Sleeper position. When only a positional rank is supplied, the extension assigns the overall ADP at
the corresponding rank on Sleeper's live positional curve. If both ranking types are supplied, both
values are preserved. If both positional-rank headers exist, Model Pos Rank takes precedence.
Duplicate positional ranks are rejected rather than guessed.

The source workbook is read-only. A normalized snapshot is stored locally in IndexedDB so it is
available after the side panel or browser restarts.

The extension reads the connected draft's Sleeper scoring metadata and automatically selects
Standard, Half-PPR, PPR, or 2QB ADP. Two-quarterback and superflex roster configurations use 2QB
ADP. Half-PPR is the fallback when no draft is connected or the setting is unavailable. The
extension retrieves overall ADP for all four offensive positions in one request and derives
positional ADP from that same live player pool.

## Sleeper player matching

After a board is imported or restored, the extension automatically matches its players to stable
Sleeper player IDs. It downloads active QB, RB, WR, and TE catalogs and caches the normalized result
for 24 hours. A fresh cached catalog avoids network requests; an expired catalog remains available
as an offline fallback if Sleeper cannot be reached.

Successful matching is silent. If any players are unmatched, ambiguous, or have invalid explicitly
provided IDs, the side panel displays one consolidated warning naming the affected players.
Ambiguous names are resolved by team only when that produces exactly one candidate; the matcher does
not silently guess.

## Live draft synchronization

Open a Sleeper draft or mock draft and then open the extension from that active tab. The side panel
connects automatically, fetches draft metadata, and polls the full picks endpoint 750 milliseconds
after each successful response while the draft is running. Traded picks refresh every 10 seconds;
live draft metadata refreshes every 30 seconds, or every five seconds while waiting for the draft to
start. Switching active tabs or navigating to a different Sleeper draft changes the connected draft
automatically.

Live draft requests include a changing query parameter because Sleeper's CDN can otherwise serve a
shared cached response even when the browser cache is disabled. This keeps the displayed pick and
player availability aligned with the current draft instead of waiting for the CDN cache window.

Every response rebuilds the drafted-player set from scratch, including keepers assigned to future
slots. The current overall pick is the first unoccupied pick number, rather than the number of pick
records plus one. If a request fails after a successful update, the panel retains the last snapshot,
marks it stale, and retries automatically with exponential backoff up to 60 seconds. Polling cycles
never overlap, and outstanding requests are cancelled when the panel disconnects or switches drafts.

## Model recommendations

Once a board and live draft are connected, the extension provides QB, RB, WR, and TE tabs in a
single compact viewer. The selected position shows its best three players by default, with a dropdown
for expanding the list to five or eight. Rankings use the model position rank from the workbook;
matched Sleeper player IDs are required so drafted players can be excluded safely. Each
recommendation includes the model and Sleeper overall ADPs, model position rank, positional SOS, and
live timing against both remaining-player orders. Drafted and keeper-assigned players are removed
before timing is calculated, so only unavailable players ranked ahead of a player move that player's
value forward.

The displayed Sleeper value pick is a live availability estimate based on how many higher-ranked
players remain. The Sleeper timing badge uses the player's original overall Sleeper rank, adjusted
only for future keepers ranked ahead of that player. This preserves value created when other teams
reach: the best remaining player can show several draft spots of value instead of resetting to “at
value” at every pick.

## Personal Targets and owned picks

Personal Targets is one global list ordered by model overall ADP rather than separate position tabs.
It displays the next three available targets by default, with a dropdown for expanding to five or
ten. Drafted targets disappear on the next live synchronization. Each target includes its model and
Sleeper ADP, positional rank, SOS, and live timing.

For every target, the extension independently ranks the live available pool by model ADP and
Sleeper ADP. Its dynamic model value pick is the current pick plus the number of available players
the model ranks ahead. Its Sleeper expected pick uses the same calculation with Sleeper ADP. A
target is at risk when its Sleeper expected pick falls before the user's next selectable owned pick.

The Target reach dropdown controls how many selections earlier than Sleeper's dynamic expected pick
the user is willing to take a personal target. The setting defaults to zero and is stored locally.
Guidance becomes **Trade up now** when a target is at risk before the next owned pick and that
Sleeper-based reach window is open, or **Draft now** when the current pick is owned and falls within
the window. Otherwise it recommends waiting. The model value remains visible for comparison but
does not block an intentional personal-target reach.

When a trade up is recommended, **Target picks** begins at the earliest selection allowed by the
reach tolerance and ends no later than one pick after the dynamic Sleeper value. The range is also
clipped before the user's next owned selection and displayed in round-and-slot notation using the
league size, such as `1.05–2.02`.

The dedicated Upcoming Picks card immediately beneath Personal Targets shows the user's draft slot,
roster, and next four owned selections. Single-user mock drafts are detected automatically. In a
multi-user draft, enter the Sleeper username once; the resolved user identity is stored locally and
reused for later drafts.

Upcoming selections are calculated for snake or linear drafts, adjusted to include acquired picks
and remove traded-away picks. Already occupied selections—including future keeper slots—are omitted.
For mock drafts where Sleeper's traded-picks API returns no ownership records, the extension reads
only the visible traded-pick markers from the active Sleeper draft board and applies them as a local
fallback.

## Current roster

The Current Roster card appears beneath Upcoming Picks. It reads Sleeper's QB, RB, WR, TE, flex,
super-flex, kicker, defense, and bench counts, then allocates committed keepers first and completed
picks in draft order. A player fills an open natural-position starter before an eligible flex slot;
otherwise the player moves to the bench.

The bench starts at the configured size but expands when drafted players cannot fill an open starter.
For example, an extra quarterback is shown on an expanded bench even if a tight-end starter remains
open. Future keeper picks owned by the user's roster are included immediately. Pick metadata supplies
the player name, position, and team when a player is not present in the imported draft board.

## Automated regression suite

The Current Draft card includes a collapsed **Connection diagnostics** section. It shows the exact
draft ID, connection health, last attempt and success times, active poll or retry interval,
consecutive failure count, raw last error, and detected acquired, traded-away, and keeper markers.
Use these values when capturing a draft-specific problem.

Run the fast, non-browser regression checks during development with:

```bash
./run_all_regression
```

This runs formatting verification, linting, TypeScript checking, and unit tests. It does not
produce a new extension build. The committed example workbook is imported during every regression
run, so clean clones exercise the real XLSX path. End-to-end browser tests are intentionally
excluded.

Use [the manual end-to-end checklist](docs/MANUAL_E2E_CHECKLIST.md) for the project-owner validation
that follows a verified build.

To additionally verify a specific real workbook fixture without hard-coding a personal path:

```bash
DRAFT_BOARD_FIXTURE="/absolute/path/to/draft-board.xlsx" pnpm test
```

## Verified production build

Build the extension after first running the complete regression gate with:

```bash
./build_extension
```

The loadable extension is generated in `dist/`, and its Manifest V3 entry files are validated
before the command succeeds.

## Development

```bash
pnpm run dev
```

The development command watches the side-panel UI, service worker, and content script. Reload the unpacked extension in `chrome://extensions` to apply rebuilt files.
