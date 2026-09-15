import { useState } from "react";
import {
  buildPositionRecommendations,
  type PickTiming,
} from "../../recommendations/recommendation-engine";
import { BOARD_POSITIONS, type BoardPosition, type StoredBoard } from "../../types/board";
import type { DraftSnapshot } from "../../types/draft";

interface RecommendationsPanelProps {
  board: StoredBoard | null;
  snapshot: DraftSnapshot | null;
}

type RecommendationLimit = 3 | 5 | 8;

export function RecommendationsPanel({ board, snapshot }: RecommendationsPanelProps) {
  const [selectedPosition, setSelectedPosition] = useState<BoardPosition>("QB");
  const [recommendationLimit, setRecommendationLimit] = useState<RecommendationLimit>(3);
  const recommendations = board
    ? buildPositionRecommendations(
        board.players,
        snapshot?.draftedPlayerIds ?? [],
        snapshot?.currentPick ?? null,
        recommendationLimit,
        futureAssignedPlayerIds(snapshot),
      )
    : [];
  const selectedGroup = recommendations.find((group) => group.position === selectedPosition);
  const rankingLabel = board?.metadata.rankingLabel ?? "Model";

  return (
    <section className="recommendations" aria-labelledby="recommendations-title">
      <div className="section-heading">
        <div>
          <p className="section-label">{rankingLabel} recommendations</p>
          <h2 id="recommendations-title">Best available</h2>
        </div>
        <span className="muted">
          {snapshot?.currentPick
            ? `At pick ${snapshot.currentPick}`
            : board
              ? "Waiting for live pick"
              : "Waiting for board"}
        </span>
      </div>

      {!board && <p className="recommendations-empty">Import a draft board to rank players.</p>}
      {board && !snapshot && (
        <p className="recommendations-empty">
          Open a Sleeper draft to filter drafted players and calculate pick value.
        </p>
      )}
      {board && snapshot && (
        <div className="position-viewer">
          <div className="position-tabs" role="tablist" aria-label="Recommendation position">
            {BOARD_POSITIONS.map((position) => (
              <button
                key={position}
                id={`position-tab-${position}`}
                type="button"
                role="tab"
                aria-selected={selectedPosition === position}
                aria-controls={`position-panel-${position}`}
                onClick={() => setSelectedPosition(position)}
              >
                {position}
              </button>
            ))}
          </div>
          {selectedGroup && (
            <section
              id={`position-panel-${selectedGroup.position}`}
              className="position-card"
              role="tabpanel"
              aria-labelledby={`position-tab-${selectedGroup.position}`}
            >
              <div className="position-card-heading">
                <label className="recommendation-limit">
                  <span>Show</span>
                  <select
                    aria-label="Number of recommendations"
                    value={recommendationLimit}
                    onChange={(event) =>
                      setRecommendationLimit(toRecommendationLimit(event.target.value))
                    }
                  >
                    <option value={3}>Best 3</option>
                    <option value={5}>Best 5</option>
                    <option value={8}>Best 8</option>
                  </select>
                </label>
                <small>{selectedGroup.availableCount} available</small>
              </div>
              {selectedGroup.players.length > 0 ? (
                <ol className="recommendation-list">
                  {selectedGroup.players.map(
                    ({ player, sleeperValuePick, positionTiming, modelTiming, sleeperTiming }) => (
                      <li key={player.boardPlayerId} className="recommendation-player">
                        <div className="recommendation-player-heading">
                          <div>
                            <strong>{player.name}</strong>
                            <small>{player.team}</small>
                          </div>
                          <span className="position-rank">
                            {player.position}
                            {player.modelPositionRank}
                          </span>
                        </div>
                        <dl className="recommendation-metrics">
                          <div>
                            <dt>{rankingLabel} ADP</dt>
                            <dd>{formatNumber(player.modelOverallAdp)}</dd>
                          </div>
                          <div>
                            <dt>Sleeper value</dt>
                            <dd>{formatPick(sleeperValuePick)}</dd>
                          </div>
                          <div>
                            <dt>Positional value</dt>
                            <dd className={`position-value-${positionTiming.kind}`}>
                              {formatPositionValue(positionTiming, player.position)}
                            </dd>
                          </div>
                          {player.projectedPositionSos !== undefined && (
                            <div>
                              <dt>Positional SOS</dt>
                              <dd>{player.projectedPositionSos}/32</dd>
                            </div>
                          )}
                        </dl>
                        <div className="timing-row">
                          <TimingBadge label={rankingLabel} timing={modelTiming} />
                          <TimingBadge label="Sleeper" timing={sleeperTiming} />
                        </div>
                      </li>
                    ),
                  )}
                </ol>
              ) : (
                <p className="position-empty">No matched players are available.</p>
              )}
            </section>
          )}
        </div>
      )}
    </section>
  );
}

function TimingBadge({
  label,
  timing,
  position,
}: {
  label: string;
  timing: PickTiming | null;
  position?: BoardPosition;
}) {
  if (!timing) {
    return null;
  }

  const description = formatTiming(timing, position);
  const displayKind = displayTimingKind(timing);

  return (
    <span className={`timing-badge timing-${displayKind}`}>
      {label}: {description}
    </span>
  );
}

function displayTimingKind(timing: PickTiming): PickTiming["kind"] {
  return timing.basis === "overall" && Math.round(timing.picks) === 0 ? "value" : timing.kind;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPick(value: number | null): string {
  return value === null ? "—" : `Pick ${formatNumber(value)}`;
}

function formatTiming(timing: PickTiming, position?: BoardPosition): string {
  if (timing.kind === "value") return "at value";
  if (timing.basis === "overall") {
    const roundedPicks = Math.round(timing.picks);
    if (roundedPicks === 0) return "at value";
    const unit = `draft spot${roundedPicks === 1 ? "" : "s"}`;
    return timing.kind === "early"
      ? `${roundedPicks} ${unit} early`
      : `${roundedPicks} ${unit} of value`;
  }
  if (timing.basis === "position") {
    const unit = `${position ?? "position"} spot${timing.picks === 1 ? "" : "s"}`;
    return timing.kind === "early"
      ? `${formatNumber(timing.picks)} ${unit} early`
      : `${formatNumber(timing.picks)} ${unit} of value`;
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

function toRecommendationLimit(value: string): RecommendationLimit {
  const parsed = Number(value);
  return parsed === 5 || parsed === 8 ? parsed : 3;
}

function futureAssignedPlayerIds(snapshot: DraftSnapshot | null): string[] {
  if (snapshot?.currentPick === null || snapshot?.currentPick === undefined) return [];
  return snapshot.picks
    .filter((pick) => pick.pickNumber > (snapshot.currentPick as number))
    .map((pick) => pick.playerId);
}
