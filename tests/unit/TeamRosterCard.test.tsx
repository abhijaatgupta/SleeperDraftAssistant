import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TeamRosterCard } from "../../src/sidepanel/components/TeamRosterCard";
import type { DraftSnapshot, UserDraftIdentity } from "../../src/types/draft";

afterEach(cleanup);

describe("TeamRosterCard", () => {
  it("renders starters, open slots, expandable bench slots, and keeper labels", () => {
    render(
      <TeamRosterCard
        board={null}
        snapshot={snapshot()}
        identity={identity()}
        pagePickOwnership={null}
      />,
    );

    expect(screen.getByRole("heading", { name: "Current roster" })).toBeInTheDocument();
    expect(screen.getByText("3 players")).toBeInTheDocument();
    const starters = screen.getByRole("heading", { name: "Starters" }).parentElement;
    expect(starters).not.toBeNull();
    expect(within(starters as HTMLElement).getByText("Keeper Quarterback")).toBeInTheDocument();
    expect(within(starters as HTMLElement).getByText("Open")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bench 2/2" })).toBeInTheDocument();
    expect(screen.getByText("Backup One")).toBeInTheDocument();
    expect(screen.getByText("Backup Two")).toBeInTheDocument();
    expect(screen.getByText("QB · TST · Keeper")).toBeInTheDocument();
  });
});

function snapshot(): DraftSnapshot {
  const picks = [
    {
      playerId: "keeper",
      playerName: "Keeper Quarterback",
      position: "QB",
      team: "TST",
      pickNumber: 11,
      round: 3,
      draftSlot: 3,
      rosterId: "3",
      isKeeper: true,
    },
    {
      playerId: "backup-1",
      playerName: "Backup One",
      position: "QB",
      team: "TST",
      pickNumber: 3,
      round: 1,
      draftSlot: 3,
      rosterId: "3",
      isKeeper: false,
    },
    {
      playerId: "backup-2",
      playerName: "Backup Two",
      position: "QB",
      team: "TST",
      pickNumber: 6,
      round: 2,
      draftSlot: 3,
      rosterId: "3",
      isKeeper: false,
    },
  ];
  return {
    draft: {
      draftId: "draft-1",
      name: "Test draft",
      status: "drafting",
      type: "snake",
      teams: 4,
      rounds: 3,
      rosterSettings: {
        qb: 1,
        rb: 0,
        wr: 0,
        te: 1,
        flex: 0,
        receiverFlex: 0,
        superFlex: 0,
        kicker: 0,
        defense: 0,
        bench: 1,
      },
      draftOrder: { user3: 3 },
      slotToRosterId: { 3: 3 },
      creatorUserIds: ["user3"],
    },
    picks,
    draftedPlayerIds: picks.map((pick) => pick.playerId),
    totalPicks: 12,
    currentPick: 7,
    completedPickCount: 2,
    futureKeeperCount: 1,
    tradedPicks: [],
    lastSuccessfulSyncAt: "2026-09-05T00:00:00.000Z",
  };
}

function identity(): UserDraftIdentity {
  return {
    user: { userId: "user3", username: "manager", displayName: "Manager" },
    draftSlot: 3,
    rosterId: 3,
    automatic: true,
  };
}
