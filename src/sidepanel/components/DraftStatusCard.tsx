import type { ActiveSleeperDraft } from "../hooks/useActiveSleeperDraft";
import type { DraftConnectionState, SleeperDraftStatus } from "../../types/draft";

interface DraftStatusCardProps {
  activeDraft: ActiveSleeperDraft;
  connection: DraftConnectionState;
}

export function DraftStatusCard({ activeDraft, connection }: DraftStatusCardProps) {
  const snapshot = connection.snapshot;
  const title = snapshot?.draft.name ?? draftConnectionTitle(activeDraft, connection);

  return (
    <section className="draft-status" aria-labelledby="draft-status-title">
      <div className="draft-status-copy">
        <p id="draft-status-title" className="section-label">
          Current draft
        </p>
        <p className="primary-status">{title}</p>
        {snapshot && (
          <p className="draft-detail">
            {formatDraftStatus(snapshot.draft.status)} · {snapshot.draft.teams} teams ·{" "}
            {snapshot.draft.rounds} rounds
          </p>
        )}
        {!activeDraft.draftId && (
          <p className="draft-detail">Open a Sleeper draft or mock draft in the active tab.</p>
        )}
        {connection.error && (
          <p className="draft-sync-error" role="alert">
            {connection.health === "stale"
              ? "Showing the last successful update while Sleeper reconnects."
              : connection.error}
          </p>
        )}
        {snapshot && (
          <p className="draft-detail">
            {snapshot.completedPickCount} completed
            {snapshot.futureKeeperCount > 0 &&
              ` · ${snapshot.futureKeeperCount} future keeper${snapshot.futureKeeperCount === 1 ? "" : "s"}`}
          </p>
        )}
        {activeDraft.draftId && (
          <details className="connection-diagnostics">
            <summary>Connection diagnostics</summary>
            <dl>
              <Diagnostic label="State" value={formatHealth(connection.health)} />
              <Diagnostic label="Draft ID" value={activeDraft.draftId} />
              <Diagnostic
                label="Last attempt"
                value={formatTimestamp(connection.diagnostics.lastAttemptAt)}
              />
              <Diagnostic
                label="Last success"
                value={formatTimestamp(snapshot?.lastSuccessfulSyncAt ?? null)}
              />
              <Diagnostic
                label={
                  connection.health === "stale" || connection.health === "error"
                    ? "Retry"
                    : "Refresh"
                }
                value={formatInterval(connection.diagnostics.nextRefreshMs)}
              />
              <Diagnostic
                label="Failures"
                value={String(connection.diagnostics.consecutiveFailures)}
              />
              <Diagnostic label="Page markers" value={formatPageMarkers(activeDraft)} />
            </dl>
            {connection.error && <p>Last error: {connection.error}</p>}
          </details>
        )}
      </div>
      <div className="pick-placeholder" aria-label={pickAriaLabel(connection)}>
        <span>Pick</span>
        <strong>{snapshot?.currentPick ?? (snapshot ? "Done" : "—")}</strong>
        {snapshot?.currentPick && <small>of {snapshot.totalPicks}</small>}
      </div>
    </section>
  );
}

function Diagnostic({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function draftConnectionTitle(
  activeDraft: ActiveSleeperDraft,
  connection: DraftConnectionState,
): string {
  if (!activeDraft.draftId) {
    return "No draft connected";
  }
  if (connection.health === "error") {
    return "Unable to connect to draft";
  }
  return "Connecting to Sleeper…";
}

function formatDraftStatus(status: SleeperDraftStatus): string {
  if (status === "pre_draft") return "Pre-draft";
  if (status === "drafting") return "Drafting";
  if (status === "complete") return "Complete";
  if (status === "paused") return "Paused";
  return "Status unavailable";
}

function formatHealth(health: DraftConnectionState["health"]): string {
  if (health === "idle") return "Disconnected";
  if (health === "connecting") return "Connecting";
  if (health === "live") return "Live";
  if (health === "stale") return "Stale — reconnecting";
  return "Connection failed";
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatInterval(milliseconds: number | null): string {
  if (milliseconds === null) return "Stopped";
  if (milliseconds < 1_000) return `${milliseconds} ms`;
  const seconds = milliseconds / 1_000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} seconds`;
}

function formatPageMarkers(activeDraft: ActiveSleeperDraft): string {
  const ownership = activeDraft.pickOwnership;
  if (!ownership) return "Unavailable";
  return `${ownership.ownedPickNumbers.length} acquired · ${ownership.tradedPickNumbers.length} traded away · ${ownership.keeperPickNumbers?.length ?? 0} keepers`;
}

function pickAriaLabel(connection: DraftConnectionState): string {
  const snapshot = connection.snapshot;
  if (!snapshot) {
    return "Current pick is not available";
  }
  return snapshot.currentPick === null
    ? "Draft is complete"
    : `Current overall pick ${snapshot.currentPick} of ${snapshot.totalPicks}`;
}
