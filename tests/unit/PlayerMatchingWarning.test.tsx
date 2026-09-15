import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerMatchingWarning } from "../../src/sidepanel/components/PlayerMatchingWarning";
import type { PlayerMatchIssue } from "../../src/types/sleeper";
import type { StoredBoard } from "../../src/types/board";

describe("PlayerMatchingWarning", () => {
  it("renders nothing when every player matched", () => {
    const { container } = render(
      <PlayerMatchingWarning
        board={makeBoard([])}
        error={null}
        staleCatalogWarning={null}
        onRetry={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("consolidates unmatched players into one warning", () => {
    render(
      <PlayerMatchingWarning
        board={makeBoard([
          makeIssue("John Doe", "WR"),
          makeIssue("Jane Doe", "RB"),
          makeIssue("Bill Jones", "TE"),
        ])}
        error={null}
        staleCatalogWarning={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByText("Sleeper player matching is incomplete.")).toBeInTheDocument();
    expect(screen.getByText(/John Doe, Jane Doe, and Bill Jones/)).toBeInTheDocument();
  });

  it("provides a retry action when the catalog cannot be loaded", () => {
    const onRetry = vi.fn();
    render(
      <PlayerMatchingWarning
        board={makeBoard([])}
        error="offline"
        staleCatalogWarning={null}
        onRetry={onRetry}
      />,
    );

    screen.getByRole("button", { name: "Retry" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

function makeBoard(issues: PlayerMatchIssue[]): StoredBoard {
  return {
    boardId: "board:test",
    metadata: {
      boardId: "board:test",
      fileName: "test.xlsx",
      fileHash: "test",
      importedAt: "2026-09-04T12:00:00.000Z",
      playerCount: issues.length,
      targetCount: 0,
      warningCount: 0,
    },
    players: [],
    warnings: [],
    matching: {
      matcherVersion: 1,
      catalogFetchedAt: "2026-09-04T12:00:00.000Z",
      matchedAt: "2026-09-04T12:01:00.000Z",
      matchedCount: 0,
      unmatchedCount: issues.length,
      ambiguousCount: 0,
      invalidProvidedIdCount: 0,
      issues,
    },
  };
}

function makeIssue(name: string, position: PlayerMatchIssue["position"]): PlayerMatchIssue {
  return {
    kind: "unmatched",
    boardPlayerId: `${position}:${name.toLowerCase()}`,
    name,
    position,
    team: "FA",
    candidates: [],
  };
}
