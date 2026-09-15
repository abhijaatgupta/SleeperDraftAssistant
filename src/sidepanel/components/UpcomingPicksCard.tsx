import { useState, type FormEvent } from "react";
import { findUpcomingOwnedPicks } from "../../draft/pick-ownership";
import type { DraftSnapshot } from "../../types/draft";
import type { DraftPagePickOwnership } from "../../shared/messages";
import type { SleeperIdentityState } from "../hooks/useSleeperIdentity";

export function UpcomingPicksCard({
  snapshot,
  pagePickOwnership,
  identityState,
}: {
  snapshot: DraftSnapshot | null;
  pagePickOwnership: DraftPagePickOwnership | null;
  identityState: SleeperIdentityState;
}) {
  const [username, setUsername] = useState("");
  const identity = identityState.identity;
  const picks =
    snapshot && identity ? findUpcomingOwnedPicks(snapshot, identity, 4, pagePickOwnership) : [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void identityState.saveUsername(username);
  };

  return (
    <section className="upcoming-picks" aria-labelledby="upcoming-picks-title">
      <div className="section-heading">
        <div>
          <p className="section-label">Your draft position</p>
          <h2 id="upcoming-picks-title">Upcoming picks</h2>
        </div>
        {identity && <span className="muted">Slot {identity.draftSlot}</span>}
      </div>

      {!snapshot && <p>Connect a Sleeper draft to calculate your upcoming selections.</p>}
      {snapshot && identityState.loading && <p>Resolving your Sleeper draft slot…</p>}
      {snapshot && !identityState.loading && !identity && (
        <form className="identity-form" onSubmit={submit}>
          <label htmlFor="sleeper-username">Sleeper username</label>
          <div>
            <input
              id="sleeper-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username"
              autoComplete="off"
            />
            <button type="submit" disabled={identityState.saving || !username.trim()}>
              {identityState.saving ? "Finding…" : "Find my picks"}
            </button>
          </div>
          <small>Your user ID is saved locally after Sleeper resolves the username.</small>
          {identityState.error && <p className="identity-error">{identityState.error}</p>}
        </form>
      )}
      {snapshot && identity && (
        <div className="owned-picks-content">
          <p>
            {identity.automatic
              ? `Detected from this mock draft · slot ${identity.draftSlot} · roster ${identity.rosterId ?? "unassigned"}`
              : `${identity.user.displayName} · slot ${identity.draftSlot} · roster ${identity.rosterId ?? "unassigned"}`}
          </p>
          {picks.length > 0 ? (
            <ol className="owned-pick-list">
              {picks.map((pick) => (
                <li key={pick.overallPick}>
                  <span>
                    {pick.round}.{String(pick.pickInRound).padStart(2, "0")}
                  </span>
                  <strong>Overall {pick.overallPick}</strong>
                  {pick.overallPick === snapshot.currentPick && <em>On the clock</em>}
                  {pick.acquired && <em>Acquired</em>}
                </li>
              ))}
            </ol>
          ) : (
            <p>No remaining owned selections.</p>
          )}
        </div>
      )}
    </section>
  );
}
