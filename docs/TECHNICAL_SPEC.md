# Sleeper Draft Assistant technical specification

## Overview

Sleeper Draft Assistant is a local-first Chrome extension for making faster, more informed decisions during Sleeper fantasy football drafts and mock drafts. It combines a user's custom player rankings with live Sleeper draft data and presents the result beside the active draft in a persistent Chrome side panel.

The extension is designed for draft rooms where decisions may need to be made in 15–30 seconds. It continuously tracks which players are unavailable, calculates who represents value at the current selection, monitors personal targets, identifies useful trade-up ranges, shows upcoming owned picks, and maintains the user's current roster.

The tool does not create its own player projection model. The user's spreadsheet supplies the opinion about how players should be ranked. Sleeper supplies the live player identities, teams, positions, scoring format, market ADP, draft selections, keepers, traded picks, and roster configuration. The extension combines those sources into actionable draft guidance.

## Primary goal

The goal is to turn a static draft board into an active draft assistant.

A spreadsheet is useful before a draft, but it becomes difficult to maintain manually once picks begin. The extension removes that burden by answering questions such as:

- Who are the best available players according to my rankings?
- How does my valuation compare with Sleeper's market value?
- Is this player early, at value, or a discount at the current pick?
- Is a personal target likely to reach my next selection?
- Which picks should I try to acquire if I want to trade up?
- Which selections do I own after accounting for trades and keepers?
- What does my roster currently look like?
- Can I quickly evaluate a player who is not among the current recommendations?

## What we achieved

### Local draft-board import

The extension imports `.xlsx` and `.xls` workbooks containing a worksheet named `Draft Board`. The importer searches the first 25 rows for the header and does not depend on a fixed column order.

The simplified input contract requires:

- `Player`
- At least one of `Model Pos Rank`, `User Pos Rank`, or `Expected Overall ADP`

Optional inputs include:

- `Targets`
- `Pos`
- `Team`
- `Projected Pos SOS`
- `Sleeper Player ID`

Any non-empty text in `Targets` marks a player as a personal target. Position, team, and strength of schedule may be omitted. Sleeper supplies position and team after matching, while the strength-of-schedule metric simply disappears from the UI when it is unavailable.

`Model Pos Rank` and `User Pos Rank` represent the same kind of ranking. The chosen header controls the terminology used in the interface. A board with `User Pos Rank` displays labels such as `User ADP` and `User: 5 draft spots of value`; a board with `Model Pos Rank` uses `Model` terminology. If both headers exist, `Model Pos Rank` takes precedence.

Legacy `Current Pos ADP` and `Sleeper Overall ADP` spreadsheet columns are ignored even when present. Those values can become stale, so live Sleeper data is authoritative.

The source workbook is never modified.

### Flexible ranking inputs

Users may provide positional ranks, overall values, or both:

- If only positional rank is supplied, the extension maps that rank onto Sleeper's live positional ADP curve to derive an overall value.
- If only Expected Overall ADP is supplied, the extension orders players within each position to derive positional ranks.
- If both are supplied, both user-provided values are preserved.

The importer rejects missing rankings, invalid numbers, unsupported positions, and duplicate positional ranks rather than silently guessing.

### Sleeper player matching

Imported names are matched to Sleeper's stable player IDs. The matching process uses:

1. An explicitly supplied Sleeper player ID, when present.
2. Normalized full name and position.
3. Name matching without suffixes such as `Jr.`, `III`, or `IV`.
4. Team as a disambiguator when multiple candidates remain.

When position and team are absent from the spreadsheet, the extension hydrates them from Sleeper after finding a unique name match. Two-way players listed by Sleeper as defensive backs but eligible at wide receiver are treated as wide receivers.

Successful matching is silent. Unmatched or ambiguous players are presented in one consolidated warning that names everyone requiring review.

### Live Sleeper ADP

The extension loads current Sleeper ADP when the board is imported or restored. It automatically chooses the correct market based on the connected draft:

- Standard
- Half-PPR
- PPR
- 2QB or superflex

Half-PPR is the fallback when scoring metadata is unavailable. Overall Sleeper ranks and positional ranks are derived from the same live market response so the values remain internally consistent.

### Automatic draft connection

The content script detects Sleeper draft and mock-draft URLs, extracts only the numeric draft ID, and reports the active draft to the side panel. Navigation within Sleeper's single-page application is monitored so changing drafts does not require manually entering an ID.

The extension loads:

- Draft status and metadata
- League size and number of rounds
- Scoring format
- Draft type, including snake and linear drafts
- Pick timer
- Roster and lineup settings
- Completed selections
- Keeper assignments
- Traded-pick ownership
- Draft order and roster identities

### Fast, reliable synchronization

During an active draft, completed picks are polled approximately 750 milliseconds after each successful response. Draft metadata and traded-pick ownership use slower schedules because they change less frequently.

Each successful response rebuilds availability from the complete pick list instead of applying only incremental changes. This makes the extension resilient to a missed response or a temporary connection interruption.

Polling cycles cannot overlap. An active request must finish or be cancelled before another begins. Requests use cache-busting parameters to avoid stale CDN responses, and failed requests retry with bounded exponential backoff while retaining the last successful snapshot.

### Best-available recommendations

The Best Available card provides tabs for:

- QB
- RB
- WR
- TE

The user can display the best 3, 5, or 8 available players at the selected position. Kicker and defense are intentionally excluded.

Each player card can show:

- Model or User overall ADP
- Sleeper's keeper-adjusted market value pick
- Model or User positional rank
- Positional value
- Optional positional strength of schedule
- Model or User draft value
- Sleeper draft value

Drafted players and keeper-assigned players are removed automatically.

### Draft-value calculations

The extension distinguishes between two related calculations.

#### Sleeper market value

The displayed `Sleeper value: Pick X` is the player's original overall Sleeper rank, adjusted only for future keepers ranked ahead of that player. The adjacent `Sleeper: ...` badge compares the current pick against that same value, so the number and badge always describe a single market baseline.

This preserves value created by reaches. For example, if Sleeper's top-ranked player remains available at Pick 4, the card shows `Sleeper value: Pick 1` and `Sleeper: 3 draft spots of value`.

#### Dynamic availability estimate

Target risk, deferral, and trade-up guidance separately estimate when a player is likely to leave the current remaining pool. That internal estimate starts at the current pick and counts available players ranked ahead by Sleeper; it is not presented as the player's market value.

#### Model or User value

Model/User value is calculated independently using the imported overall ranking. Completed selections advance the current market position, while only relevant future keeper assignments compress the pool. This allows multiple players to represent value simultaneously.

Positional value performs the same comparison within the player's position. It counts unavailable players at that position while excluding future assignments that should not influence the current positional frontier.

### Personal targets

The Personal Targets card displays the next 3, 5, or 10 available target players without splitting them by position. Drafted targets disappear automatically.

Targets that are so far down Sleeper's remaining pool that they are likely to survive through the user's next several selections are silently moved lower in the list. This keeps near-term decisions visible without deleting long-term targets.

The user may configure how many picks earlier than Sleeper's value they are willing to select a target. This target-reach tolerance is stored locally and is evaluated against Sleeper's market rather than the custom model. That reflects the behavior of other managers, who do not have access to the user's private rankings.

Target guidance can be:

- `Wait`
- `Consider now`
- `Draft now`
- `Trade up now`

### Deterministic trade-up targets

When a target is unlikely to survive to the next owned selection, the extension recommends a bounded set of picks to acquire.

The range begins at the earliest pick allowed by the user's target-reach tolerance and ends no later than one pick after the dynamic Sleeper expected pick. It is also clipped to the selection immediately before the user's next owned pick.

Conceptually:

```text
start = max(current pick, Sleeper expected pick - reach tolerance)
end   = min(next owned pick - 1, Sleeper expected pick + 1)
```

The UI labels this range `Target picks`, because it describes the selections worth acquiring rather than a broad period during which a trade could occur.

Overall selections are converted into league-aware round-and-slot notation:

- Pick 14 is `2.04` in a 10-team league.
- Pick 14 is `2.02` in a 12-team league.

If only one selection qualifies, the UI displays `Target pick` in the singular.

### Upcoming owned picks

The extension identifies the user's roster and displays the next four usable selections. The calculation accounts for:

- Snake or linear order
- Original draft slot
- Acquired picks
- Traded-away picks
- Occupied keeper selections
- Picks traded before the draft

For mock drafts where Sleeper's traded-picks API does not return the complete ownership information, the content script reads visible ownership markers from the active draft board as a fallback.

Single-user mock drafts can usually identify the user automatically. Multi-user drafts allow the user to save a Sleeper username locally.

### Current roster

The Current Roster card updates as selections are made. It uses the league's actual lineup configuration and supports:

- QB, RB, WR, and TE starters
- Flex and receiver-flex positions
- Superflex
- Kicker and defense
- Bench positions

Players fill a natural-position starter first, then an eligible flex position, and finally the bench. An extra player correctly moves to the bench even if a different starting position remains empty. The displayed bench can expand when drafted players cannot occupy an open starter.

Future keepers are included only when the keeper's pick is owned by the user's roster. Players selected from traded-away picks are not incorrectly added to the user's team.

### Player search

The Player Search card allows a last-second audible. Search results update as the user types and match either the first or last name. The result list floats above the remaining interface so it does not expand the entire side panel.

Selecting a player opens the same decision card used elsewhere, including availability, rankings, value, target status, and optional strength of schedule. This allows the user to evaluate a player who is not currently among the highest recommendations or personal targets.

## How the system works end to end

1. The user opens a Sleeper draft and the extension side panel.
2. The content script extracts the draft ID and detects visible ownership markers.
3. The side panel retrieves draft metadata, scoring settings, picks, and traded-pick information.
4. The user imports a draft-board workbook.
5. The workbook is validated and converted into normalized player records.
6. The extension downloads or restores the cached Sleeper player catalog.
7. Workbook players are matched to Sleeper IDs and hydrated with position and team.
8. Current Sleeper ADP is loaded using the draft's scoring format.
9. Missing overall or positional rankings are derived when necessary.
10. The normalized board is saved locally in IndexedDB.
11. Live polling rebuilds player availability and the current pick.
12. Recommendation, target, pick-ownership, and roster engines recalculate from the latest snapshot.
13. React rerenders the affected cards in the side panel.

## Technical architecture

The project is a fully client-side Chrome Extension using Manifest V3.

### User interface

- React 19
- React DOM
- TypeScript
- HTML and CSS
- Chrome Side Panel API

### Extension processes

- Manifest V3 background service worker
- Sleeper draft-page content script
- Chrome runtime messaging
- `chrome.storage.local` and `chrome.storage.session`

### Data and file handling

- SheetJS `xlsx` for workbook parsing
- IndexedDB through the `idb` library
- Browser File System Access APIs for local workbook selection
- Native browser `fetch` and `AbortController` for Sleeper requests

### Build tooling

- Node.js 20 or newer
- pnpm 11
- Vite for the React side panel
- esbuild for the service worker and content script
- TypeScript strict mode
- ESLint and Prettier

### Testing

- Vitest
- React Testing Library
- jest-dom
- jsdom
- fake-indexeddb
- Real-workbook contract tests using the committed public example board, with deeper v33 comparison
  coverage when the private source workbook is available locally

`./run_all_regression` runs formatting verification, linting, TypeScript checks, unit tests, component tests, storage tests, and workbook-contract tests without producing a build.

`./build_extension` runs the full regression gate, builds the extension, and validates the required Manifest V3 output files. The unpacked Chrome extension is generated in `dist/`.

Browser end-to-end testing remains a manual owner-run step because it depends on a real Sleeper draft, Chrome extension state, and live interaction timing.

## Local-first design and privacy

The extension does not require a custom backend or hosted database. Imported rankings, resolved player IDs, user settings, and cached catalogs remain in the browser's local storage and IndexedDB.

The extension communicates with Sleeper to retrieve public fantasy-football data and live draft state. It does not upload the user's workbook to a custom service and does not modify the source file.

## Reliability protections

The implementation includes:

- Non-overlapping polling cycles
- Cancellation when changing or disconnecting drafts
- Full-response state rebuilding
- Stale-state preservation during temporary failures
- Exponential retry backoff
- CDN cache-busting for fast-changing pick responses
- Transactional board replacement
- Cached player-catalog fallback
- Stable Sleeper player IDs for availability tracking
- Deterministic matching and ranking tie-breakers
- Consolidated warnings instead of silent guessing

## Current scope and future opportunities

The current version is a strong local planning and live-draft assistant. Potential future work includes:

- A cleaner import workflow that does not require choosing a local workbook manually
- Automatic synchronization with an actively maintained draft board
- Configurable recommendation and trade-risk settings beyond target reach
- More explicit confidence or volatility estimates around Sleeper expected picks
- Expanded support for unusual league formats and position eligibility
- Automated browser end-to-end coverage where practical
- Packaging and distribution outside Chrome's unpacked-extension workflow

The core product is already functional: it imports a custom ranking system, connects to a live Sleeper draft, updates quickly, handles keepers and traded selections, and converts the combined information into clear drafting and trade-up guidance.
