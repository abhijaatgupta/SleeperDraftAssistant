import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PlayerSearchCard } from "../../src/sidepanel/components/PlayerSearchCard";
import type { BoardPosition, ImportedPlayer, StoredBoard } from "../../src/types/board";
import type { DraftSnapshot, SleeperDraftPick } from "../../src/types/draft";

afterEach(cleanup);

describe("PlayerSearchCard", () => {
  it("waits for an imported board", () => {
    render(<PlayerSearchCard board={null} snapshot={null} />);

    expect(screen.getByRole("heading", { name: "Player Search" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Search draft-board players" })).toBeDisabled();
  });

  it("updates matching options as the query changes and selects a player", () => {
    const board = makeBoard([
      player("Justin Jefferson", "jefferson", "WR", 3, 5, true),
      player("Justin Fields", "fields", "QB", 30, 60),
      player("CeeDee Lamb", "lamb", "WR", 4, 6),
    ]);
    render(<PlayerSearchCard board={board} snapshot={makeSnapshot([], 3)} />);
    const input = screen.getByRole("combobox", { name: "Search draft-board players" });

    fireEvent.change(input, { target: { value: "just" } });
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(2);

    fireEvent.change(input, { target: { value: "jeff" } });
    const option = within(screen.getByRole("listbox")).getByRole("option", {
      name: /Justin Jefferson/,
    });
    fireEvent.click(option);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    const selection = document.querySelector(".player-search-selection");
    expect(selection).not.toBeNull();
    expect(within(selection as HTMLElement).getByText("Justin Jefferson")).toBeInTheDocument();
    expect(within(selection as HTMLElement).getByText("Available")).toBeInTheDocument();
    expect(within(selection as HTMLElement).getByText("Target")).toBeInTheDocument();
    expect(within(selection as HTMLElement).getByText("Pick 3")).toBeInTheDocument();
    expect(
      within(selection as HTMLElement).getByText("Model: 2 draft spots early"),
    ).toBeInTheDocument();
  });

  it("supports keyboard selection and clearing", () => {
    render(
      <PlayerSearchCard
        board={makeBoard([player("Derrick Henry", "henry", "RB", 9, 13.2)])}
        snapshot={makeSnapshot([], 3)}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Search draft-board players" });

    fireEvent.change(input, { target: { value: "hen" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(document.querySelector(".player-search-selection")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear player search" }));
    expect(input).toHaveValue("");
    expect(document.querySelector(".player-search-selection")).toBeNull();
  });

  it("uses User terminology when the workbook supplied User Pos Rank", () => {
    const board = makeBoard([player("Derrick Henry", "henry", "RB", 1, 1)]);
    board.metadata.rankingLabel = "User";
    render(<PlayerSearchCard board={board} snapshot={makeSnapshot([], 1)} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "hen" } });
    fireEvent.click(screen.getByRole("option", { name: /Derrick Henry/ }));

    expect(screen.getByText("User ADP")).toBeInTheDocument();
    expect(screen.getByText("User: at value")).toBeInTheDocument();
    expect(screen.queryByText("Model: at value")).not.toBeInTheDocument();
  });

  it("omits Positional SOS when it was not supplied", () => {
    const henry = { ...player("Derrick Henry", "henry", "RB", 9, 13.2) };
    delete henry.projectedPositionSos;
    render(<PlayerSearchCard board={makeBoard([henry])} snapshot={makeSnapshot([], 3)} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "hen" } });
    fireEvent.click(screen.getByRole("option", { name: /Derrick Henry/ }));

    expect(screen.queryByText("Positional SOS")).not.toBeInTheDocument();
  });

  it("labels drafted, keeper-assigned, and unmatched search results", () => {
    const drafted = player("Drafted Player", "drafted", "WR", 1, 1);
    const keeper = player("Keeper Player", "keeper", "RB", 2, 2);
    const unmatched = player("Unmatched Player", undefined, "TE", 3, 3);
    const snapshot = makeSnapshot(["drafted", "keeper"], 4, [
      draftPick("drafted", 2, false),
      draftPick("keeper", 12, true),
    ]);
    render(
      <PlayerSearchCard board={makeBoard([drafted, keeper, unmatched])} snapshot={snapshot} />,
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "player" } });
    const listbox = within(screen.getByRole("listbox"));
    expect(listbox.getByRole("option", { name: /Drafted Player.*Drafted/ })).toBeInTheDocument();
    expect(listbox.getByRole("option", { name: /Keeper Player.*Keeper/ })).toBeInTheDocument();
    expect(
      listbox.getByRole("option", { name: /Unmatched Player.*Unmatched/ }),
    ).toBeInTheDocument();
  });

  it("updates a selected player when the live draft marks them drafted", () => {
    const jefferson = player("Justin Jefferson", "jefferson", "WR", 3, 5);
    const board = makeBoard([jefferson]);
    const view = render(<PlayerSearchCard board={board} snapshot={makeSnapshot([], 3)} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "jeff" } });
    fireEvent.click(screen.getByRole("option", { name: /Justin Jefferson/ }));
    expect(screen.getByText("Available")).toBeInTheDocument();

    view.rerender(
      <PlayerSearchCard
        board={board}
        snapshot={makeSnapshot(["jefferson"], 4, [draftPick("jefferson", 3, false)])}
      />,
    );

    expect(screen.getByText("Drafted")).toBeInTheDocument();
    expect(screen.getByText("Drafted at 1.03")).toBeInTheDocument();
    expect(screen.queryByText("Available")).not.toBeInTheDocument();
  });

  it("closes the overlay when clicking outside and reports no matches", () => {
    render(
      <PlayerSearchCard
        board={makeBoard([player("Justin Jefferson", "jefferson", "WR", 3, 5)])}
        snapshot={makeSnapshot([], 3)}
      />,
    );
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "mahomes" } });
    expect(screen.getByText("No draft-board players match “mahomes”.")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("No draft-board players match “mahomes”.")).not.toBeInTheDocument();
  });
});

function player(
  name: string,
  sleeperPlayerId: string | undefined,
  position: BoardPosition,
  modelAdp: number,
  sleeperAdp: number,
  isTarget = false,
): ImportedPlayer {
  return {
    boardPlayerId: `${position}:${name.toLowerCase()}`,
    sleeperPlayerId,
    sourceRow: 2,
    name,
    normalizedName: name.toLowerCase(),
    position,
    team: "TST",
    sleeperPositionAdp: sleeperAdp,
    modelPositionRank: modelAdp,
    projectedPositionSos: 7,
    sleeperOverallAdp: sleeperAdp,
    modelOverallAdp: modelAdp,
    positionEdge: 0,
    overallEdge: sleeperAdp - modelAdp,
    isTarget,
  };
}

function makeBoard(players: ImportedPlayer[]): StoredBoard {
  return {
    boardId: "board:test",
    metadata: {
      boardId: "board:test",
      fileName: "test.xlsx",
      fileHash: "hash",
      importedAt: "2026-09-06T00:00:00.000Z",
      playerCount: players.length,
      targetCount: players.filter((candidate) => candidate.isTarget).length,
      warningCount: 0,
    },
    players,
    warnings: [],
  };
}

function makeSnapshot(
  draftedPlayerIds: string[],
  currentPick: number,
  picks: SleeperDraftPick[] = [],
): DraftSnapshot {
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
    picks,
    draftedPlayerIds,
    totalPicks: 180,
    currentPick,
    completedPickCount: currentPick - 1,
    futureKeeperCount: picks.filter((pick) => pick.pickNumber > currentPick).length,
    tradedPicks: [],
    lastSuccessfulSyncAt: "2026-09-06T00:00:00.000Z",
  };
}

function draftPick(playerId: string, pickNumber: number, isKeeper: boolean): SleeperDraftPick {
  return {
    playerId,
    pickNumber,
    round: Math.ceil(pickNumber / 10),
    draftSlot: ((pickNumber - 1) % 10) + 1,
    isKeeper,
  };
}
