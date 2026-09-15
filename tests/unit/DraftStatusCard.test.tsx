import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DraftStatusCard } from "../../src/sidepanel/components/DraftStatusCard";
import type { DraftConnectionState } from "../../src/types/draft";

afterEach(cleanup);

describe("DraftStatusCard", () => {
  it("shows the connected draft, current pick, and future keepers", () => {
    render(
      <DraftStatusCard
        activeDraft={{
          tabId: 1,
          draftId: "12345678",
          url: "https://sleeper.com/draft/12345678",
          pickOwnership: {
            ownedPickNumbers: [11, 30],
            tradedPickNumbers: [18],
            keeperPickNumbers: [18, 38],
          },
        }}
        connection={liveConnection()}
      />,
    );

    expect(screen.getByText("Test Draft")).toBeInTheDocument();
    expect(screen.getByLabelText("Current overall pick 3 of 12")).toBeInTheDocument();
    expect(screen.getByText(/2 completed · 1 future keeper/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Connection diagnostics"));
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("750 ms")).toBeInTheDocument();
    expect(screen.getByText("2 acquired · 1 traded away · 2 keepers")).toBeInTheDocument();
  });

  it("prompts for an active Sleeper draft tab when disconnected", () => {
    render(
      <DraftStatusCard
        activeDraft={{
          tabId: 1,
          draftId: null,
          url: "https://example.com",
          pickOwnership: null,
        }}
        connection={{
          draftId: null,
          health: "idle",
          snapshot: null,
          error: null,
          diagnostics: { lastAttemptAt: null, consecutiveFailures: 0, nextRefreshMs: null },
        }}
      />,
    );

    expect(screen.getByText("No draft connected")).toBeInTheDocument();
    expect(screen.getByText(/Open a Sleeper draft or mock draft/)).toBeInTheDocument();
    expect(screen.queryByText("Connection diagnostics")).not.toBeInTheDocument();
  });

  it("shows stale data, retry diagnostics, and the underlying error", () => {
    const connection = liveConnection();
    connection.health = "stale";
    connection.error = "Sleeper draft request failed with HTTP 503.";
    connection.diagnostics = {
      lastAttemptAt: "2026-09-04T12:00:05.000Z",
      consecutiveFailures: 1,
      nextRefreshMs: 5_000,
    };
    render(
      <DraftStatusCard
        activeDraft={{
          tabId: 1,
          draftId: "12345678",
          url: "https://sleeper.com/draft/12345678",
          pickOwnership: null,
        }}
        connection={connection}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/last successful update/i);
    expect(screen.getByText("Stale — reconnecting")).toBeInTheDocument();
    expect(screen.getByText("5 seconds")).toBeInTheDocument();
    expect(screen.getByText(/Last error:.*HTTP 503/)).toBeInTheDocument();
  });
});

function liveConnection(): DraftConnectionState {
  return {
    draftId: "12345678",
    health: "live",
    error: null,
    diagnostics: {
      lastAttemptAt: "2026-09-04T12:00:00.000Z",
      consecutiveFailures: 0,
      nextRefreshMs: 750,
    },
    snapshot: {
      draft: {
        draftId: "12345678",
        name: "Test Draft",
        status: "drafting",
        type: "snake",
        teams: 4,
        rounds: 3,
        draftOrder: {},
        slotToRosterId: {},
        creatorUserIds: [],
      },
      picks: [],
      draftedPlayerIds: ["a", "b", "keeper"],
      totalPicks: 12,
      currentPick: 3,
      completedPickCount: 2,
      futureKeeperCount: 1,
      tradedPicks: [],
      lastSuccessfulSyncAt: "2026-09-04T12:00:00.000Z",
    },
  };
}
