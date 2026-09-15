import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  buildRemainingPoolTimings,
  type PickTiming,
} from "../../recommendations/recommendation-engine";
import {
  getPlayerAvailability,
  searchBoardPlayers,
  type PlayerAvailability,
  type PlayerSearchResult,
} from "../../search/player-search";
import type { BoardPosition, ImportedPlayer, StoredBoard } from "../../types/board";
import type { DraftSnapshot } from "../../types/draft";

interface PlayerSearchCardProps {
  board: StoredBoard | null;
  snapshot: DraftSnapshot | null;
}

export function PlayerSearchCard({ board, snapshot }: PlayerSearchCardProps) {
  const [query, setQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLElement>(null);
  const listboxId = useId();
  const futureAssigned = useMemo(() => futureAssignedPlayerIds(snapshot), [snapshot]);
  const results = useMemo(
    () =>
      searchBoardPlayers(
        board?.players ?? [],
        query,
        snapshot?.draftedPlayerIds ?? [],
        futureAssigned,
      ),
    [board, futureAssigned, query, snapshot?.draftedPlayerIds],
  );
  const selectedPlayer =
    board?.players.find((player) => player.boardPlayerId === selectedPlayerId) ?? null;

  useEffect(() => {
    if (selectedPlayerId && !selectedPlayer) setSelectedPlayerId(null);
  }, [selectedPlayer, selectedPlayerId]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    const closeWhenOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, []);

  const selectPlayer = (result: PlayerSearchResult) => {
    setSelectedPlayerId(result.player.boardPlayerId);
    setQuery(result.player.name);
    setOpen(false);
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(0, results.length - 1)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === "Enter" && open && results[activeIndex]) {
      event.preventDefault();
      selectPlayer(results[activeIndex]);
    }
  };

  return (
    <section className="player-search" aria-labelledby="player-search-title" ref={rootRef}>
      <div className="section-heading">
        <h2 id="player-search-title">Player Search</h2>
        <span className="muted">
          {board ? `${board.players.length} players` : "Waiting for board"}
        </span>
      </div>

      <div className="player-search-control">
        <label htmlFor="player-search-input" className="sr-only">
          Search draft-board players
        </label>
        <div className="player-search-input-row">
          <input
            id="player-search-input"
            type="search"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open && Boolean(query.trim())}
            aria-activedescendant={
              open && results[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined
            }
            disabled={!board}
            placeholder={board ? "Search by first or last name" : "Import a draft board to search"}
            value={query}
            onFocus={() => query.trim() && setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActiveIndex(0);
            }}
            onKeyDown={onSearchKeyDown}
          />
          {(query || selectedPlayer) && (
            <button
              type="button"
              className="player-search-clear"
              aria-label="Clear player search"
              onClick={() => {
                setQuery("");
                setSelectedPlayerId(null);
                setOpen(false);
              }}
            >
              Clear
            </button>
          )}
        </div>

        {open && query.trim() && (
          <div className="player-search-popover">
            {results.length > 0 ? (
              <ul id={listboxId} role="listbox" aria-label="Matching players">
                {results.map((result, index) => (
                  <li key={result.player.boardPlayerId}>
                    <button
                      id={`${listboxId}-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectPlayer(result)}
                    >
                      <span>
                        <strong>{result.player.name}</strong>
                        <small>
                          {hasResolvedPosition(result.player)
                            ? [result.player.position, result.player.team]
                                .filter(Boolean)
                                .join(" · ")
                            : "Position pending Sleeper match"}
                        </small>
                      </span>
                      <em
                        className={`player-availability player-availability-${result.availability}`}
                      >
                        {availabilityLabel(result.availability)}
                      </em>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No draft-board players match “{query.trim()}”.</p>
            )}
          </div>
        )}
      </div>

      {selectedPlayer && (
        <SelectedPlayerCard
          player={selectedPlayer}
          board={board as StoredBoard}
          snapshot={snapshot}
          futureAssignedPlayerIds={futureAssigned}
        />
      )}
    </section>
  );
}

function SelectedPlayerCard({
  player,
  board,
  snapshot,
  futureAssignedPlayerIds: futureAssignedIds,
}: {
  player: ImportedPlayer;
  board: StoredBoard;
  snapshot: DraftSnapshot | null;
  futureAssignedPlayerIds: string[];
}) {
  const drafted = new Set(snapshot?.draftedPlayerIds ?? []);
  const futureAssigned = new Set(futureAssignedIds);
  const availability = getPlayerAvailability(player, drafted, futureAssigned);
  const timing = buildRemainingPoolTimings(
    board.players,
    drafted,
    snapshot?.currentPick ?? null,
    futureAssigned,
  ).get(player.boardPlayerId);
  const selectedPick = player.sleeperPlayerId
    ? snapshot?.picks.find((pick) => pick.playerId === player.sleeperPlayerId)
    : undefined;
  const liveStatus = snapshot ? availabilityLabel(availability) : "Draft status unavailable";
  const rankingLabel = board.metadata.rankingLabel ?? "Model";

  return (
    <article className="recommendation-player player-search-selection">
      <div className="recommendation-player-heading">
        <div>
          <strong>{player.name}</strong>
          {player.team && <small>{player.team}</small>}
        </div>
        <div className="player-search-tags">
          {player.isTarget && <span className="player-target-tag">Target</span>}
          <span className={`player-availability player-availability-${availability}`}>
            {liveStatus}
          </span>
          {hasResolvedPosition(player) && (
            <span className="position-rank">
              {player.position}
              {player.modelPositionRank}
            </span>
          )}
        </div>
      </div>

      {selectedPick && availability !== "available" && (
        <p className="player-search-status-detail">
          {availability === "keeper" ? "Keeper assigned" : "Drafted"} at{" "}
          {formatDraftPick(selectedPick.pickNumber, snapshot?.draft.teams ?? 0)}
        </p>
      )}
      {availability === "unmatched" && (
        <p className="player-search-status-detail">
          This player could not be matched to Sleeper, so live availability is unknown.
        </p>
      )}

      <dl className="recommendation-metrics">
        <div>
          <dt>{rankingLabel} ADP</dt>
          <dd>{formatNumber(player.modelOverallAdp)}</dd>
        </div>
        <div>
          <dt>Sleeper value</dt>
          <dd>
            {timing?.sleeperValuePick !== undefined
              ? `Pick ${formatNumber(timing.sleeperValuePick)}`
              : `ADP ${formatNumber(player.sleeperOverallAdp)}`}
          </dd>
        </div>
        <div>
          <dt>Positional value</dt>
          <dd className={timing ? `position-value-${timing.positionTiming.kind}` : undefined}>
            {timing ? formatPositionValue(timing.positionTiming, player.position) : "—"}
          </dd>
        </div>
        {player.projectedPositionSos !== undefined && (
          <div>
            <dt>Positional SOS</dt>
            <dd>{player.projectedPositionSos}/32</dd>
          </div>
        )}
      </dl>

      {timing && (
        <div className="timing-row">
          <TimingBadge label={rankingLabel} timing={timing.modelTiming} />
          <TimingBadge label="Sleeper" timing={timing.sleeperTiming} />
        </div>
      )}
    </article>
  );
}

function hasResolvedPosition(player: ImportedPlayer): boolean {
  return player.sourcePositionProvided !== false || Boolean(player.sleeperPlayerId);
}

function TimingBadge({ label, timing }: { label: string; timing: PickTiming | null }) {
  if (!timing) return null;
  const displayKind =
    timing.basis === "overall" && Math.round(timing.picks) === 0 ? "value" : timing.kind;
  return (
    <span className={`timing-badge timing-${displayKind}`}>
      {label}: {formatTiming(timing)}
    </span>
  );
}

function formatTiming(timing: PickTiming): string {
  if (timing.kind === "value") return "at value";
  if (timing.basis === "overall") {
    const roundedPicks = Math.round(timing.picks);
    if (roundedPicks === 0) return "at value";
    const unit = `draft spot${roundedPicks === 1 ? "" : "s"}`;
    return timing.kind === "early"
      ? `${roundedPicks} ${unit} early`
      : `${roundedPicks} ${unit} of value`;
  }
  const unit = `pick${timing.picks === 1 ? "" : "s"}`;
  return timing.kind === "early"
    ? `${formatNumber(timing.picks)} ${unit} early`
    : `${formatNumber(timing.picks)} ${unit} discount`;
}

function formatPositionValue(timing: PickTiming, position: BoardPosition): string {
  if (timing.kind === "value") return "At value";
  const unit = `${position} spot${timing.picks === 1 ? "" : "s"}`;
  return `${timing.kind === "discount" ? "+" : "−"}${formatNumber(timing.picks)} ${unit}`;
}

function availabilityLabel(availability: PlayerAvailability): string {
  switch (availability) {
    case "available":
      return "Available";
    case "drafted":
      return "Drafted";
    case "keeper":
      return "Keeper";
    case "unmatched":
      return "Unmatched";
  }
}

function futureAssignedPlayerIds(snapshot: DraftSnapshot | null): string[] {
  if (snapshot?.currentPick === null || snapshot?.currentPick === undefined) return [];
  return snapshot.picks
    .filter((pick) => pick.pickNumber > (snapshot.currentPick as number))
    .map((pick) => pick.playerId);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDraftPick(overallPick: number, teams: number): string {
  if (teams <= 0) return `pick ${overallPick}`;
  const round = Math.ceil(overallPick / teams);
  const pickInRound = ((overallPick - 1) % teams) + 1;
  return `${round}.${String(pickInRound).padStart(2, "0")}`;
}
