import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/sidepanel/App";

describe("App", () => {
  it("renders the side-panel setup state", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Draft workspace" })).toBeInTheDocument();
    expect(screen.getByText("No draft connected")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "No board imported" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Import draft board" })).toBeEnabled();
    });
    expect(screen.getByText("Import a draft board to rank players.")).toBeInTheDocument();
  });
});
