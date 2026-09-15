# Sleeper Draft Assistant

Turn your personal fantasy-football rankings into live draft guidance. Sleeper Draft Assistant is
a local-first Chrome extension that runs beside a Sleeper draft and shows who is available, where
you see value, when a target is at risk, and which upcoming picks you actually own.

## Why it exists

Average draft position reflects the market, not necessarily how you value a player. A custom draft
board captures that difference before the draft, but it becomes difficult to maintain while picks
are arriving every 15–30 seconds. This extension combines the user's rankings with Sleeper's live
draft state so the next decision is visible without manually crossing names off a spreadsheet.

## What it helps with

- Find the best available QB, RB, WR, or TE according to your rankings.
- Compare your valuation with Sleeper ADP at the current pick.
- Track personal targets and see whether to wait, draft, consider, or trade up.
- Account for keepers, acquired picks, and traded-away picks.
- See upcoming owned selections and a live roster built from league settings.
- Search any imported player for a quick last-second evaluation.

## How it works

1. Open a Sleeper draft or mock draft and launch the extension side panel.
2. Import an Excel draft board containing player names and your positional or overall rankings.
3. The extension matches those players to Sleeper, loads the draft's scoring-aware market ADP, and
   stores the normalized board locally in the browser.
4. As selections are made, recommendations, targets, pick ownership, and roster state update
   automatically.

The project includes a ready-to-import
[example draft board](examples/2026_Draft_Board_Example.xlsx) that can also be copied and edited.

## Features

- **Live recommendations:** Position tabs show the best 3, 5, or 8 available players using the
  imported rankings.
- **Two views of value:** Player cards compare the user's price with Sleeper's market price, both
  overall and within the position.
- **Personal target planning:** Configurable reach tolerance and deterministic target-pick ranges
  help identify when a trade-up is worthwhile.
- **Draft awareness:** The extension tracks completed picks, future keepers, traded selections,
  snake or linear order, and the current pick.
- **Roster tracking:** League-specific starters, flex eligibility, keepers, and bench allocation are
  reflected as the draft progresses.
- **Scoring-aware ADP:** Standard, Half-PPR, PPR, and 2QB/Superflex markets are selected from the
  connected draft's settings.
- **Local-first storage:** The workbook, settings, resolved player IDs, and cached data remain in the
  user's browser; no custom backend is required.
- **Resilient synchronization:** Non-overlapping polling, complete-state rebuilding, request
  cancellation, stale-state preservation, and bounded retries protect fast draft updates.

For calculation rules, ownership handling, matching behavior, polling details, and architecture,
see the [technical specification](docs/TECHNICAL_SPEC.md).

## Requirements

- Node.js 20 or newer
- pnpm 11
- Chrome 114 or newer

## Install and build

```bash
git clone https://github.com/abhijaatgupta/SleeperDraftAssistant.git
cd SleeperDraftAssistant
pnpm install
pnpm run build
```

The loadable extension is generated in `dist/`.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this project's `dist/` directory.
5. Open a Sleeper draft or mock draft and click the extension action.

## Import a draft board

Choose **Import draft board** in the extension and select an `.xlsx` or `.xls` workbook containing
a worksheet named `Draft Board`. Column order does not matter. The minimum input is:

- `Player`
- At least one of `Model Pos Rank`, `User Pos Rank`, or `Expected Overall ADP`

Useful optional columns include `Targets`, `Projected Pos SOS`, `Pos`, `Team`, and `Sleeper Player
ID`. Any non-empty `Targets` cell marks that player as a target. Position and team can normally be
omitted because Sleeper supplies them after matching.

When only a positional rank is supplied, the extension maps that rank onto Sleeper's live
positional ADP curve to derive an overall value. When only an overall value is supplied, it derives
the positional rank. The source workbook is read-only.

See the complete [workbook contract](docs/WORKBOOK_CONTRACT.md) for aliases, validation rules, and
derivation behavior.

## Data source and privacy

This project uses [Sleeper's public API](https://docs.sleeper.com/) for draft, player, roster, and
league data. The API is read-only and does not require an API token. Sleeper documents a general
guideline of staying below 1,000 requests per minute; this extension remains comfortably below that
level. Active picks are polled sequentially every 750 milliseconds, traded-pick ownership every 10
seconds, and infrequently changing draft metadata every 30 seconds. The player catalog is cached
for 24 hours.

Imported rankings and retrieved Sleeper data stay in the user's browser. The extension has no
custom backend, does not upload the workbook, and does not share draft data with third parties.
Sleeper's documentation describes its API as free for non-commercial use and asks commercial users
to contact Sleeper about licensing.

This project is not affiliated with or endorsed by Sleeper.

## Development and testing

Run the non-browser regression suite during development:

```bash
./run_all_regression
```

It runs formatting checks, linting, TypeScript checks, unit/component tests, and a real import of the
committed example workbook without creating a new extension build.

Create a verified production build with:

```bash
./build_extension
```

This runs the regression gate, builds the extension, and validates its Manifest V3 entry files.
Browser end-to-end checks are intentionally manual; use the
[manual E2E checklist](docs/MANUAL_E2E_CHECKLIST.md).

For watch-mode development:

```bash
pnpm run dev
```

Reload the unpacked extension in `chrome://extensions` after rebuilt files change.

## Documentation

- [Technical specification](docs/TECHNICAL_SPEC.md)
- [Workbook contract](docs/WORKBOOK_CONTRACT.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Manual E2E checklist](docs/MANUAL_E2E_CHECKLIST.md)

## License

Licensed under the [MIT License](LICENSE).
