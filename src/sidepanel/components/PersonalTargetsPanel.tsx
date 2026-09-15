import { useEffect, useState } from "react";
import { findUpcomingOwnedPicks } from "../../draft/pick-ownership";
import type { PickTiming } from "../../recommendations/recommendation-engine";
import type { DraftPagePickOwnership } from "../../shared/messages";
import { buildTargetRecommendations, type TargetAction } from "../../targets/target-engine";
import type { StoredBoard } from "../../types/board";
import type { DraftSnapshot, UserDraftIdentity } from "../../types/draft";

interface PersonalTargetsPanelProps {
  board: StoredBoard | null;
  snapshot: DraftSnapshot | null;
  identity: UserDraftIdentity | null;
  pagePickOwnership: DraftPagePickOwnership | null;
}

type TargetLimit = 3 | 5 | 10;
const REACH_TOLERANCE_STORAGE_KEY = "targetReachTolerance";
const MAX_REACH_TOLERANCE = 20;

export function PersonalTargetsPanel({
  board,
  snapshot,
  identity,
  pagePickOwnership,
}: PersonalTargetsPanelProps) {
  const [targetLimit, setTargetLimit] = useState<TargetLimit>(3);
  const [reachTolerance, setReachTolerance] = useState(0);
  useEffect(() => {
    if (!globalThis.chrome?.storage?.local) return;

    let active = true;
    void chrome.storage.local.get(REACH_TOLERANCE_STORAGE_KEY).then((result) => {
      if (!active) return;
      setReachTolerance(toReachTolerance(result[REACH_TOLERANCE_STORAGE_KEY]));
    });

    return () => {
      active = false;
    };
  }, []);
  const upcomingOwnedPicks =
    snapshot && identity
      ? findUpcomingOwnedPicks(snapshot, identity, snapshot.totalPicks, pagePickOwnership)
      : null;
  const targets = board
    ? buildTargetRecommendations(
        board.players,
        snapshot?.draftedPlayerIds ?? [],
        snapshot?.currentPick ?? null,
        upcomingOwnedPicks,
        targetLimit,
        reachTolerance,
        futureAssignedPlayerIds(snapshot),
      )
    : null;
  const rankingLabel = board?.metadata.rankingLabel ?? "Model";

  return (
    <section className="targets" aria-labelledby="targets-title">
      <div className="section-heading">
        <div>
          <p className="section-label">Personal targets</p>
          <h2 id="targets-title">Next targets</h2>
        </div>
        <span className="muted">
          {targets ? `${targets.availableCount} available` : "Waiting for board"}
        </span>
      </div>

      {!board && <p className="targets-empty">Import a draft board to load personal targets.</p>}
      {board && !snapshot && (
        <p className="targets-empty">
          Open a Sleeper draft to filter drafted targets and calculate timing.
        </p>
      )}
      {board && snapshot && targets && (
        <div className="target-viewer">
          <div className="target-toolbar">
            <label className="recommendation-limit">
              <span>Target reach</span>
              <select
                aria-label="Target reach tolerance"
                value={reachTolerance}
                onChange={(event) => updateReachTolerance(event.target.value, setReachTolerance)}
              >
                {Array.from({ length: MAX_REACH_TOLERANCE + 1 }, (_, picks) => (
                  <option key={picks} value={picks}>
                    {picks === 0 ? "At Sleeper value" : `${picks} pick${picks === 1 ? "" : "s"}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="recommendation-limit">
              <span>Show</span>
              <select
                aria-label="Number of personal targets"
                value={targetLimit}
                onChange={(event) => setTargetLimit(toTargetLimit(event.target.value))}
              >
                <option value={3}>Next 3</option>
                <option value={5}>Next 5</option>
                <option value={10}>Next 10</option>
              </select>
            </label>
          </div>
          {targets.players.length > 0 ? (
            <ol className="recommendation-list target-list">
              {targets.players.map(
                ({
                  player,
                  sleeperValuePick,
                  positionTiming,
                  modelTiming,
                  sleeperTiming,
                  action,
                }) => (
                  <li key={player.boardPlayerId} className="recommendation-player target-player">
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
                    <TargetActionRow action={action} teams={snapshot.draft.teams} />
                    <div className="timing-row">
                      <TimingBadge label={rankingLabel} timing={modelTiming} />
                      <TimingBadge label="Sleeper" timing={sleeperTiming} />
                    </div>
                  </li>
                ),
              )}
            </ol>
          ) : (
            <p className="targets-empty">No matched personal targets are currently available.</p>
          )}
        </div>
      )}
    </section>
  );
}

function TargetActionRow({ action, teams }: { action: TargetAction | null; teams: number }) {
  if (!action) return null;

  const nextOwned = action.nextOwnedPick
    ? formatDraftPick(action.nextOwnedPick.overallPick, teams)
    : null;
  const detail =
    action.kind === "waiting"
      ? nextOwned
        ? `Expected to remain available for your ${nextOwned} selection`
        : `Target range begins near ${formatDraftPick(action.earliestApprovedPick, teams)}`
      : action.kind === "draft_now"
        ? "Your current selection is within your target reach"
        : action.kind === "consider_now"
          ? nextOwned
            ? `Earlier than your target reach, but unlikely to reach your ${nextOwned} selection`
            : "Earlier than your target reach, but unlikely to remain available"
          : action.tradeWindowEnd !== null
            ? nextOwned
              ? `Unlikely to reach your ${nextOwned} selection`
              : "Acquire a pick inside the recommended range"
            : "No later owned selection is available";

  return (
    <div className={`target-action target-action-${action.kind}`}>
      <strong>
        {action.kind === "waiting"
          ? "Wait"
          : action.kind === "draft_now"
            ? "Draft now"
            : action.kind === "consider_now"
              ? "Consider now"
              : "Trade up now"}
      </strong>
      <span>{detail}</span>
      {action.kind === "trade_up" && action.tradeWindowStart !== null && (
        <small>
          {formatTargetPicks(action.tradeWindowStart, action.tradeWindowEnd, teams)}
          {nextOwned ? ` · next owned ${nextOwned}` : ""}
        </small>
      )}
    </div>
  );
}

function formatTargetPicks(start: number, end: number | null, teams: number): string {
  const startPick = formatDraftPick(start, teams);
  if (end === null || end === start) return `Target pick: ${startPick}`;
  return `Target picks: ${startPick}–${formatDraftPick(end, teams)}`;
}

function TimingBadge({
  label,
  timing,
  position,
}: {
  label: string;
  timing: PickTiming | null;
  position?: string;
}) {
  if (!timing) return null;
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

function formatDraftPick(overallPick: number, teams: number): string {
  const round = Math.ceil(overallPick / teams);
  const pickInRound = ((overallPick - 1) % teams) + 1;
  return `${round}.${String(pickInRound).padStart(2, "0")}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPick(value: number | null): string {
  return value === null ? "—" : `Pick ${formatNumber(value)}`;
}

function formatTiming(timing: PickTiming, position?: string): string {
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

function formatPositionValue(timing: PickTiming, position: string): string {
  if (timing.kind === "value") return "At value";
  const unit = `${position} spot${timing.picks === 1 ? "" : "s"}`;
  return `${timing.kind === "discount" ? "+" : "−"}${formatNumber(timing.picks)} ${unit}`;
}

function toTargetLimit(value: string): TargetLimit {
  const parsed = Number(value);
  return parsed === 5 || parsed === 10 ? parsed : 3;
}

function toReachTolerance(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(MAX_REACH_TOLERANCE, Math.max(0, Math.floor(parsed)));
}

function updateReachTolerance(value: string, setValue: (value: number) => void): void {
  const tolerance = toReachTolerance(value);
  setValue(tolerance);
  if (globalThis.chrome?.storage?.local) {
    void chrome.storage.local.set({ [REACH_TOLERANCE_STORAGE_KEY]: tolerance });
  }
}

function futureAssignedPlayerIds(snapshot: DraftSnapshot | null): string[] {
  if (snapshot?.currentPick === null || snapshot?.currentPick === undefined) return [];
  return snapshot.picks
    .filter((pick) => pick.pickNumber > (snapshot.currentPick as number))
    .map((pick) => pick.playerId);
}
