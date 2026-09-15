# Implementation plan

## Phase 1: Foundation

- Manifest V3 project
- React side panel
- Background service worker
- Sleeper draft-page content script
- Draft URL detection
- Fast regression entry point and separate verified production-build entry point

## Phase 2: Draft-board ingestion

- [x] Select and read an XLSX workbook
- [x] Locate and validate the Draft Board sheet
- [x] Normalize required player fields and optional targets
- [x] Store imports transactionally in IndexedDB
- [x] Cache workbook metadata and import diagnostics

## Phase 3: Sleeper player matching

- [x] Cache the active Sleeper player catalog
- [x] Normalize player names
- [x] Attach stable Sleeper player IDs
- [x] Report and resolve ambiguous players

## Phase 4: Live draft synchronization

- [x] Fetch draft metadata
- [x] Poll completed picks
- [x] Rebuild player availability from the full response
- [x] Calculate the current overall pick, including future keepers
- [x] Surface stale and degraded connection states

## Phase 5: Recommendations

- [x] Rank available QB, RB, WR, and TE players in a single position-tabbed viewer
- [x] Let the user display the best 3, 5, or 8 players from a dropdown
- [x] Show model and Sleeper ADP
- [x] Calculate current-pick reach and discount against both valuations
- [x] Display projected positional strength of schedule

## Phase 6: User-owned picks

- [x] Resolve Sleeper user and roster identity
- [x] Generate future snake or linear pick schedules
- [x] Apply traded-pick ownership
- [x] Fall back to visible mock-draft ownership when Sleeper's traded-picks API is empty
- [x] Exclude keeper-occupied future selections
- [x] Display the user's upcoming selections in their own card beneath Personal Targets

## Phase 7: Targets and trade-up guidance

- [x] Parse personal targets from the workbook
- [x] Show the next 3, 5, or 10 available targets in one global list
- [x] Remove targets immediately after they are drafted
- [x] Enforce model-approved draft timing
- [x] Calculate target urgency
- [x] Calculate Sleeper-value-based trade-up windows from the user's owned picks
- [x] Recalculate value and urgency from the live remaining-player pool
- [x] Persist a user-selected target reach tolerance measured in picks against Sleeper value

## Phase 8: Hardening

- [x] Build a live roster card from Sleeper lineup settings and owned picks
- [x] Allocate natural starting positions before compatible flex positions
- [x] Expand the displayed bench when incompatible picks leave starter vacancies
- [x] Include future committed keepers in the user's roster
- [x] Fast, non-overlapping polling with request cancellation
- [x] Cached metadata and traded-pick refresh intervals
- [x] Bypass stale shared CDN responses for live draft requests
- [x] Exponential retry and rate-limit backoff
- [x] Connection diagnostics
- [x] Full automated regression coverage for implementation-owned behavior
- Manual end-to-end validation in live Sleeper mock drafts
