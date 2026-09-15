import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RecommendationsPanel } from "../../src/sidepanel/components/RecommendationsPanel";
import type { ImportedPlayer, StoredBoard } from "../../src/types/board";
import type { DraftSnapshot } from "../../src/types/draft";

afterEach(cleanup);

describe("RecommendationsPanel", () => {
  it("shows model-ranked available players and their decision metrics", () => {
    const board = makeBoard([
      makePlayer("Drafted Runner", "drafted", 1),
      makePlayer("Available Runner", "available", 2),
    ]);
    const snapshot = makeSnapshot(["drafted"], 15);

    render(<RecommendationsPanel board={board} snapshot={snapshot} />);

    expect(screen.getByRole("tab", { name: "QB" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("No matched players are available.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "RB" }));

    expect(screen.getByRole("tab", { name: "RB" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("combobox", { name: "Number of recommendations" })).toHaveValue("3");
    const runningBack = within(screen.getByRole("tabpanel"));
    expect(runningBack.getByText("Available Runner")).toBeInTheDocument();
    expect(runningBack.queryByText("Drafted Runner")).not.toBeInTheDocument();
    expect(runningBack.getByText("RB2")).toBeInTheDocument();
    expect(runningBack.getByText("Pick 15")).toBeInTheDocument();
    expect(runningBack.getByText("Positional value")).toBeInTheDocument();
    expect(runningBack.getByText("At value")).toBeInTheDocument();
    expect(runningBack.getByText("7/32")).toBeInTheDocument();
    expect(runningBack.getByText("Model: at value")).toBeInTheDocument();
    expect(runningBack.getByText("Sleeper: 5 draft spots early")).toBeInTheDocument();
  });

  it("lets the user choose the best three, five, or eight players from a dropdown", () => {
    const board = makeBoard(
      Array.from({ length: 8 }, (_, index) =>
        makePlayer(`Runner ${index + 1}`, `runner-${index + 1}`, index + 1),
      ),
    );

    render(<RecommendationsPanel board={board} snapshot={makeSnapshot([], 15)} />);
    fireEvent.click(screen.getByRole("tab", { name: "RB" }));

    const dropdown = screen.getByRole("combobox", { name: "Number of recommendations" });
    expect(within(screen.getByRole("tabpanel")).getAllByRole("listitem")).toHaveLength(3);

    fireEvent.change(dropdown, { target: { value: "5" } });
    expect(within(screen.getByRole("tabpanel")).getAllByRole("listitem")).toHaveLength(5);

    fireEvent.change(dropdown, { target: { value: "8" } });
    expect(within(screen.getByRole("tabpanel")).getAllByRole("listitem")).toHaveLength(8);
  });

  it("uses User terminology when the workbook supplied User Pos Rank", () => {
    const board = makeBoard([makePlayer("Available Runner", "available", 1)]);
    board.metadata.rankingLabel = "User";

    render(<RecommendationsPanel board={board} snapshot={makeSnapshot([], 1)} />);
    fireEvent.click(screen.getByRole("tab", { name: "RB" }));

    expect(screen.getByText("User recommendations")).toBeInTheDocument();
    expect(screen.getByText("User ADP")).toBeInTheDocument();
    expect(screen.getByText("User: at value")).toBeInTheDocument();
    expect(screen.queryByText("Model: at value")).not.toBeInTheDocument();
  });

  it("omits Positional SOS when it was not supplied", () => {
    const player = { ...makePlayer("Available Runner", "available", 1) };
    delete player.projectedPositionSos;

    render(<RecommendationsPanel board={makeBoard([player])} snapshot={makeSnapshot([], 1)} />);
    fireEvent.click(screen.getByRole("tab", { name: "RB" }));

    expect(screen.queryByText("Positional SOS")).not.toBeInTheDocument();
  });

  it("rounds model draft spots to the nearest whole spot", () => {
    const player = {
      ...makePlayer("Derrick Henry", "henry", 1),
      modelOverallAdp: 9.9,
    };

    render(<RecommendationsPanel board={makeBoard([player])} snapshot={makeSnapshot([], 1)} />);
    fireEvent.click(screen.getByRole("tab", { name: "RB" }));

    expect(screen.getByText("Model: 9 draft spots early")).toBeInTheDocument();
  });

  it("uses value styling when a model difference rounds to at value", () => {
    const player = {
      ...makePlayer("Amon-Ra St. Brown", "amon-ra", 1),
      modelOverallAdp: 1.4,
    };

    render(<RecommendationsPanel board={makeBoard([player])} snapshot={makeSnapshot([], 1)} />);
    fireEvent.click(screen.getByRole("tab", { name: "RB" }));

    const badge = screen.getByText("Model: at value");
    expect(badge).toHaveClass("timing-value");
    expect(badge).not.toHaveClass("timing-early");
  });

  it("renders the top remaining player at model value when elite keepers are assigned later", () => {
    const keepers = [
      { ...makePlayer("Keeper One", "keeper-1", 1), sleeperOverallAdp: 1 },
      { ...makePlayer("Keeper Two", "keeper-2", 2), sleeperOverallAdp: 2 },
      { ...makePlayer("Keeper Three", "keeper-3", 3), sleeperOverallAdp: 3 },
    ];
    const cmc = {
      ...makePlayer("Christian McCaffrey", "cmc", 4),
      sleeperOverallAdp: 4.5,
    };
    const lateKeeper = {
      ...makePlayer("Late Keeper", "late-keeper", 100),
      sleeperOverallAdp: 90,
    };
    const snapshot = makeSnapshot(
      [...keepers.map((keeper) => keeper.sleeperPlayerId as string), "late-keeper"],
      1,
    );
    snapshot.picks = [
      futureKeeper("keeper-1", 4),
      futureKeeper("keeper-2", 9),
      futureKeeper("keeper-3", 18),
      futureKeeper("late-keeper", 90),
    ];

    render(
      <RecommendationsPanel board={makeBoard([...keepers, cmc, lateKeeper])} snapshot={snapshot} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "RB" }));

    const card = within(screen.getByRole("listitem"));
    expect(card.getByText("Christian McCaffrey")).toBeInTheDocument();
    expect(card.getByText("Model: at value")).toBeInTheDocument();
  });
});

function futureKeeper(playerId: string, pickNumber: number) {
  return {
    playerId,
    pickNumber,
    round: Math.ceil(pickNumber / 10),
    draftSlot: ((pickNumber - 1) % 10) + 1,
    isKeeper: true,
  };
}

function makePlayer(
  name: string,
  sleeperPlayerId: string,
  modelPositionRank: number,
): ImportedPlayer {
  return {
    boardPlayerId: `RB:${name}`,
    sleeperPlayerId,
    sourceRow: 2,
    name,
    normalizedName: name.toLowerCase(),
    position: "RB",
    team: "TST",
    sleeperPositionAdp: 3,
    modelPositionRank,
    projectedPositionSos: 7,
    sleeperOverallAdp: 20,
    modelOverallAdp: modelPositionRank,
    positionEdge: 1,
    overallEdge: 6,
    isTarget: false,
  };
}

function makeBoard(players: ImportedPlayer[]): StoredBoard {
  return {
    boardId: "board:test",
    metadata: {
      boardId: "board:test",
      fileName: "test.xlsx",
      fileHash: "hash",
      importedAt: "2026-09-04T00:00:00.000Z",
      playerCount: players.length,
      targetCount: 0,
      warningCount: 0,
    },
    players,
    warnings: [],
  };
}

function makeSnapshot(draftedPlayerIds: string[], currentPick: number): DraftSnapshot {
  return {
    draft: {
      draftId: "draft-1",
      name: "Test draft",
      status: "drafting",
      type: "snake",
      teams: 10,
      rounds: 18,
      draftOrder: {},
      slotToRosterId: {},
      creatorUserIds: [],
    },
    picks: [],
    draftedPlayerIds,
    totalPicks: 180,
    currentPick,
    completedPickCount: currentPick - 1,
    futureKeeperCount: 0,
    tradedPicks: [],
    lastSuccessfulSyncAt: "2026-09-04T00:00:00.000Z",
  };
}
