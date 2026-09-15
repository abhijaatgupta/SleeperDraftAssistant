# Workbook contract

The extension will import the `Draft Board` worksheet without depending on a fixed column order.
The repository's [example draft board](../examples/2026_Draft_Board_Example.xlsx) is a complete,
ready-to-import illustration of the minimal four-column format.

## Required columns

- Player
- Model Pos Rank, User Pos Rank, or Expected Overall ADP (at least one is required)

## Optional columns

- targets (`target` and `isTarget` are accepted aliases)
- Sleeper Player ID
- Pos
- Team
- Projected Pos SOS
- Injury and player-status fields
- Confidence and model-value fields

`Model Pos Rank` and `User Pos Rank` are equivalent ranking inputs. The chosen header determines
whether the interface labels the ranking Model or User. If both headers exist, Model Pos Rank takes
precedence. `Expected Overall ADP` is the imported overall fair-value selection. When both ranking
types are supplied, imported values are preserved exactly and are not renumbered as players are
drafted. If only Expected Overall ADP is supplied, positional rank is derived by ordering matched
players within their Sleeper position. If only a positional rank is supplied, Expected Overall ADP
is derived from the corresponding rank on Sleeper's live positional ADP curve.

Sleeper overall ADP is loaded live using the connected draft's scoring format. Two-quarterback and
superflex drafts use 2QB ADP, and Half-PPR is used when no scoring metadata is available. Current
positional ADP is derived from that same live overall ordering rather than required from the
workbook. `Current Pos ADP` and `Sleeper Overall ADP` workbook columns are ignored even when they
are present, because the live Sleeper response is authoritative. When Projected Pos SOS is absent,
the player cards omit that metric.

Position and team are enriched from Sleeper after name matching. Optional spreadsheet values help
disambiguate names but are not required. A name that still maps to multiple Sleeper players remains
unmatched and is reported instead of guessed.

A player is a target when its `Targets` cell contains any non-whitespace value. The marker text does
not matter. An empty or whitespace-only cell is not a target. Formatting and fill colors are ignored,
which keeps the same contract usable for a future CSV import.
