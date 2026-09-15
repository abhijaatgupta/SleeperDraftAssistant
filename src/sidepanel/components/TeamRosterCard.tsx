import { buildTeamRoster, type RosterPlayer } from "../../roster/roster-engine";
import type { DraftPagePickOwnership } from "../../shared/messages";
import type { StoredBoard } from "../../types/board";
import type { DraftSnapshot, UserDraftIdentity } from "../../types/draft";

interface TeamRosterCardProps {
  board: StoredBoard | null;
  snapshot: DraftSnapshot | null;
  identity: UserDraftIdentity | null;
  pagePickOwnership: DraftPagePickOwnership | null;
}

export function TeamRosterCard({
  board,
  snapshot,
  identity,
  pagePickOwnership,
}: TeamRosterCardProps) {
  const roster =
    snapshot && identity
      ? buildTeamRoster(snapshot, identity, board?.players ?? [], pagePickOwnership)
      : null;

  return (
    <section className="team-roster" aria-labelledby="team-roster-title">
      <div className="section-heading">
        <div>
          <p className="section-label">Your team</p>
          <h2 id="team-roster-title">Current roster</h2>
        </div>
        {roster && <span className="muted">{roster.ownedPlayerCount} players</span>}
      </div>

      {!snapshot && <p>Connect a Sleeper draft to build your roster.</p>}
      {snapshot && !identity && <p>Identify your Sleeper roster above to display your team.</p>}
      {roster && (
        <div className="roster-content">
          <RosterSection
            title="Starters"
            rows={roster.starters.map((slot) => ({
              key: slot.id,
              label: slot.label,
              player: slot.player,
            }))}
            emptyMessage="No starting positions were included in the draft settings."
          />
          <RosterSection
            title={`Bench ${roster.bench.length}/${roster.displayedBenchSize}`}
            rows={Array.from({ length: roster.displayedBenchSize }, (_, index) => ({
              key: `BN-${index + 1}`,
              label: "BN",
              player: roster.bench[index] ?? null,
            }))}
            emptyMessage="This draft has no configured bench positions."
          />
        </div>
      )}
    </section>
  );
}

function RosterSection({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: Array<{ key: string; label: string; player: RosterPlayer | null }>;
  emptyMessage: string;
}) {
  return (
    <section className="roster-group">
      <h3>{title}</h3>
      {rows.length > 0 ? (
        <ul className="roster-slot-list">
          {rows.map((row) => (
            <li key={row.key} className={row.player ? "" : "roster-slot-open"}>
              <span>{row.label}</span>
              {row.player ? (
                <div>
                  <strong>{row.player.name}</strong>
                  <small>
                    {[row.player.position, row.player.team, row.player.isKeeper ? "Keeper" : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>
              ) : (
                <em>Open</em>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>{emptyMessage}</p>
      )}
    </section>
  );
}
