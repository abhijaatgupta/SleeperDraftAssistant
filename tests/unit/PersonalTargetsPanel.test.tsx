import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PersonalTargetsPanel } from "../../src/sidepanel/components/PersonalTargetsPanel";
import type { ImportedPlayer, StoredBoard } from "../../src/types/board";
import type { DraftSnapshot, UserDraftIdentity } from "../../src/types/draft";

afterEach(cleanup);

describe("PersonalTargetsPanel", () => {
  it("shows the next three, five, or ten available targets without position tabs", () => {
    const players = Array.from({ length: 11 }, (_, index) => makeTarget(index + 1));
    render(
      <PersonalTargetsPanel
        board={makeBoard(players)}
        snapshot={makeSnapshot(["target-1"], 18)}
        identity={identity()}
        pagePickOwnership={null}
      />,
    );

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByText("10 available")).toBeInTheDocument();
    expect(screen.queryByText("Target 1")).not.toBeInTheDocument();
    expect(screen.getByText("Target 2")).toBeInTheDocument();
    expect(screen.getAllByText("Draft now")).toHaveLength(1);
    expect(screen.getAllByText("Consider now")).toHaveLength(2);

    const list = screen.getByRole("list");
    expect(screen.getByRole("combobox", { name: "Target reach tolerance" })).toHaveValue("0");
    const dropdown = screen.getByRole("combobox", { name: "Number of personal targets" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);

    fireEvent.change(dropdown, { target: { value: "5" } });
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);

    fireEvent.change(dropdown, { target: { value: "10" } });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
  });

  it("shows an empty state after every target has been drafted", () => {
    render(
      <PersonalTargetsPanel
        board={makeBoard([makeTarget(1)])}
        snapshot={makeSnapshot(["target-1"], 2)}
        identity={identity()}
        pagePickOwnership={null}
      />,
    );

    expect(screen.getByText("No matched personal targets are currently available.")).toBeVisible();
    expect(screen.queryByText("Target 1")).not.toBeInTheDocument();
  });

  it("uses User terminology when the workbook supplied User Pos Rank", () => {
    const board = makeBoard([makeTarget(1)]);
    board.metadata.rankingLabel = "User";

    render(
      <PersonalTargetsPanel
        board={board}
        snapshot={makeSnapshot([], 1)}
        identity={identity()}
        pagePickOwnership={null}
      />,
    );

    expect(screen.getByText("User ADP")).toBeInTheDocument();
    expect(screen.getByText("User: at value")).toBeInTheDocument();
    expect(screen.queryByText("Model: at value")).not.toBeInTheDocument();
  });

  it("omits Positional SOS when it was not supplied", () => {
    const target = { ...makeTarget(1) };
    delete target.projectedPositionSos;

    render(
      <PersonalTargetsPanel
        board={makeBoard([target])}
        snapshot={makeSnapshot([], 1)}
        identity={identity()}
        pagePickOwnership={null}
      />,
    );

    expect(screen.queryByText("Positional SOS")).not.toBeInTheDocument();
  });

  it("applies target reach tolerance against dynamic Sleeper value", () => {
    const marketLeader = {
      ...makeTarget(99),
      boardPlayerId: "RB:market-leader",
      sleeperPlayerId: "market-leader",
      name: "Market Leader",
      normalizedName: "market leader",
      sleeperOverallAdp: 1,
      isTarget: false,
    };
    render(
      <PersonalTargetsPanel
        board={makeBoard([marketLeader, makeTarget(1)])}
        snapshot={makeSnapshot([], 18)}
        identity={identity()}
        pagePickOwnership={null}
      />,
    );

    expect(screen.getByText("Consider now")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Target reach tolerance" }), {
      target: { value: "1" },
    });
    expect(screen.getByText("Draft now")).toBeInTheDocument();
    expect(screen.queryByText("Consider now")).not.toBeInTheDocument();
  });

  it("rounds target model draft spots to the nearest whole spot", () => {
    const target = {
      ...makeTarget(1),
      name: "Derrick Henry",
      normalizedName: "derrick henry",
      modelOverallAdp: 9.9,
    };

    render(
      <PersonalTargetsPanel
        board={makeBoard([target])}
        snapshot={makeSnapshot([], 1)}
        identity={identity()}
        pagePickOwnership={null}
      />,
    );

    expect(screen.getByText("Model: 9 draft spots early")).toBeInTheDocument();
  });

  it("uses value styling when a target model difference rounds to at value", () => {
    const target = {
      ...makeTarget(1),
      modelOverallAdp: 1.4,
    };

    render(
      <PersonalTargetsPanel
        board={makeBoard([target])}
        snapshot={makeSnapshot([], 1)}
        identity={identity()}
        pagePickOwnership={null}
      />,
    );

    const badge = screen.getByText("Model: at value");
    expect(badge).toHaveClass("timing-value");
    expect(badge).not.toHaveClass("timing-early");
  });

  it("shows consideration guidance when a target is too early but will not reach the next pick", () => {
    const marketPlayers = Array.from({ length: 2 }, (_, index) => ({
      ...makeTarget(index + 20),
      boardPlayerId: `RB:market-${index + 1}`,
      sleeperPlayerId: `market-${index + 1}`,
      name: `Market Player ${index + 1}`,
      normalizedName: `market player ${index + 1}`,
      sleeperOverallAdp: index + 1,
      isTarget: false,
    }));
    const jefferson = {
      ...makeTarget(1),
      name: "Justin Jefferson",
      normalizedName: "justin jefferson",
    };

    render(
      <PersonalTargetsPanel
        board={makeBoard([...marketPlayers, jefferson])}
        snapshot={makeSnapshot([], 3)}
        identity={identity()}
        pagePickOwnership={{
          ownedPickNumbers: [11],
          tradedPickNumbers: [],
          keeperPickNumbers: [],
        }}
      />,
    );

    expect(screen.getByText("Consider now")).toBeInTheDocument();
    expect(
      screen.getByText("Earlier than your target reach, but unlikely to reach your 2.01 selection"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Wait")).not.toBeInTheDocument();
  });

  it("formats deterministic target picks using the league size", () => {
    const tenTeamView = render(
      <PersonalTargetsPanel
        board={makeBoard([makeTarget(1)])}
        snapshot={makeSnapshot([], 14, 10)}
        identity={identity()}
        pagePickOwnership={null}
      />,
    );

    expect(screen.getByText("Target picks: 2.04–2.05 · next owned 2.08")).toBeInTheDocument();
    expect(screen.queryByText(/Trade-up window/)).not.toBeInTheDocument();
    tenTeamView.unmount();

    render(
      <PersonalTargetsPanel
        board={makeBoard([makeTarget(1)])}
        snapshot={makeSnapshot([], 14, 12)}
        identity={identity()}
        pagePickOwnership={null}
      />,
    );

    expect(screen.getByText("Target picks: 2.02–2.03 · next owned 2.10")).toBeInTheDocument();
  });
});

function makeTarget(number: number): ImportedPlayer {
  return {
    boardPlayerId: `RB:target-${number}`,
    sleeperPlayerId: `target-${number}`,
    sourceRow: number + 1,
    name: `Target ${number}`,
    normalizedName: `target ${number}`,
    position: "RB",
    team: "TST",
    sleeperPositionAdp: number,
    modelPositionRank: number,
    projectedPositionSos: 7,
    sleeperOverallAdp: number + 10,
    modelOverallAdp: number,
    positionEdge: 0,
    overallEdge: 10,
    isTarget: true,
  };
}

function makeBoard(players: ImportedPlayer[]): StoredBoard {
  return {
    boardId: "board:test",
    metadata: {
      boardId: "board:test",
      fileName: "targets.xlsx",
      fileHash: "hash",
      importedAt: "2026-09-04T00:00:00.000Z",
      playerCount: players.length,
      targetCount: players.length,
      warningCount: 0,
    },
    players,
    warnings: [],
  };
}

function makeSnapshot(draftedPlayerIds: string[], currentPick: number, teams = 10): DraftSnapshot {
  return {
    draft: {
      draftId: "draft-1",
      name: "Test draft",
      status: "drafting",
      type: "snake",
      teams,
      rounds: 18,
      draftOrder: { user3: 3 },
      slotToRosterId: { 3: 3 },
      creatorUserIds: ["user3"],
    },
    picks: [],
    draftedPlayerIds,
    totalPicks: teams * 18,
    currentPick,
    completedPickCount: currentPick - 1,
    futureKeeperCount: 0,
    tradedPicks: [],
    lastSuccessfulSyncAt: "2026-09-04T00:00:00.000Z",
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
