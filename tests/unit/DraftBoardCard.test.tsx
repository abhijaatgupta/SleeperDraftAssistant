import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftBoardCard } from "../../src/sidepanel/components/DraftBoardCard";

describe("DraftBoardCard", () => {
  afterEach(cleanup);

  it("shows the scoring format selected from the connected draft", () => {
    render(
      <DraftBoardCard
        board={null}
        loading={false}
        importing={false}
        errors={[]}
        adpFormat="half_ppr"
        adpRefreshing={false}
        adpError={null}
        adpWarning={null}
        onImport={vi.fn()}
      />,
    );

    expect(screen.getByText("Sleeper ADP: Half-PPR")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows the inferred format and refresh status during a refresh", () => {
    render(
      <DraftBoardCard
        board={null}
        loading={false}
        importing={false}
        errors={[]}
        adpFormat="ppr"
        adpRefreshing
        adpError={null}
        adpWarning={null}
        onImport={vi.fn()}
      />,
    );

    expect(screen.getByText("Sleeper ADP: PPR")).toBeInTheDocument();
    expect(screen.getByText("Refreshing Sleeper ADP…")).toBeInTheDocument();
  });
});
