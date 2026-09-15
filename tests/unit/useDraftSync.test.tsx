import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SleeperDraft } from "../../src/types/draft";

const api = vi.hoisted(() => ({
  fetchDraft: vi.fn(),
  fetchPicks: vi.fn(),
  fetchTradedPicks: vi.fn(),
}));

vi.mock("../../src/sleeper/draft-api", () => ({
  fetchSleeperDraft: api.fetchDraft,
  fetchSleeperDraftPicks: api.fetchPicks,
  fetchSleeperDraftTradedPicks: api.fetchTradedPicks,
}));

import { useDraftSync } from "../../src/sidepanel/hooks/useDraftSync";

beforeEach(() => {
  api.fetchDraft.mockReset();
  api.fetchPicks.mockReset();
  api.fetchTradedPicks.mockReset();
  api.fetchTradedPicks.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDraftSync", () => {
  it("loads metadata and the full pick snapshot", async () => {
    api.fetchDraft.mockResolvedValue(draft());
    api.fetchPicks.mockResolvedValue([
      { playerId: "10", pickNumber: 1, round: 1, draftSlot: 1, isKeeper: false },
    ]);

    const { result, unmount } = renderHook(() => useDraftSync("123456789"));

    await waitFor(() => expect(result.current.health).toBe("live"));
    expect(result.current.snapshot).toMatchObject({ currentPick: 2, draftedPlayerIds: ["10"] });
    expect(result.current.diagnostics).toMatchObject({
      consecutiveFailures: 0,
      nextRefreshMs: 750,
    });
    expect(api.fetchDraft).toHaveBeenCalledWith(
      "123456789",
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(api.fetchPicks).toHaveBeenCalledWith(
      "123456789",
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(api.fetchTradedPicks).toHaveBeenCalledWith(
      "123456789",
      expect.any(Function),
      expect.any(AbortSignal),
    );
    unmount();
  });

  it("retains the last snapshot and marks it stale after a polling failure", async () => {
    vi.useFakeTimers();
    api.fetchDraft.mockResolvedValue(draft());
    api.fetchPicks
      .mockResolvedValueOnce([
        { playerId: "10", pickNumber: 1, round: 1, draftSlot: 1, isKeeper: false },
      ])
      .mockRejectedValueOnce(new Error("offline"));

    const { result, unmount } = renderHook(() => useDraftSync("123456789"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.health).toBe("live");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750);
    });
    expect(result.current.health).toBe("stale");
    expect(result.current.snapshot?.draftedPlayerIds).toEqual(["10"]);
    expect(result.current.diagnostics).toMatchObject({
      consecutiveFailures: 1,
      nextRefreshMs: 5_000,
    });
    unmount();
  });

  it("surfaces an initial connection failure with automatic retry diagnostics", async () => {
    vi.useFakeTimers();
    api.fetchDraft.mockResolvedValue(draft());
    api.fetchPicks.mockRejectedValue(new Error("initial connection failed"));

    const { result, unmount } = renderHook(() => useDraftSync("123456789"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current).toMatchObject({
      health: "error",
      snapshot: null,
      error: "initial connection failed",
      diagnostics: { consecutiveFailures: 1, nextRefreshMs: 5_000 },
    });
    unmount();
  });

  it("polls picks quickly while caching trades and live metadata", async () => {
    vi.useFakeTimers();
    api.fetchDraft.mockResolvedValue(draft());
    api.fetchPicks.mockResolvedValue([]);

    const { unmount } = renderHook(() => useDraftSync("123456789"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(api.fetchDraft).toHaveBeenCalledTimes(1);
    expect(api.fetchPicks).toHaveBeenCalledTimes(1);
    expect(api.fetchTradedPicks).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_750);
    });
    expect(api.fetchPicks.mock.calls.length).toBeGreaterThan(10);
    expect(api.fetchDraft).toHaveBeenCalledTimes(1);
    expect(api.fetchTradedPicks).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750);
    });
    expect(api.fetchTradedPicks).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(19_500);
    });
    expect(api.fetchDraft).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("refreshes pre-draft metadata every five seconds", async () => {
    vi.useFakeTimers();
    api.fetchDraft.mockResolvedValue(draft({ status: "pre_draft" }));
    api.fetchPicks.mockResolvedValue([]);

    const { unmount } = renderHook(() => useDraftSync("123456789"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(api.fetchDraft).toHaveBeenCalledTimes(2);
    expect(api.fetchPicks).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("backs off exponentially after consecutive request failures", async () => {
    vi.useFakeTimers();
    api.fetchDraft.mockResolvedValue(draft());
    api.fetchPicks
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useDraftSync("123456789"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(750);
    });
    expect(api.fetchPicks).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_999);
    });
    expect(api.fetchPicks).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(api.fetchPicks).toHaveBeenCalledTimes(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_999);
    });
    expect(api.fetchPicks).toHaveBeenCalledTimes(3);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(api.fetchPicks).toHaveBeenCalledTimes(4);
    expect(result.current.health).toBe("live");
    expect(result.current.diagnostics.consecutiveFailures).toBe(0);
    unmount();
  });

  it("aborts outstanding requests when the draft connection closes", async () => {
    api.fetchDraft.mockResolvedValue(draft());
    api.fetchPicks.mockResolvedValue([]);

    const { unmount } = renderHook(() => useDraftSync("123456789"));
    await waitFor(() => expect(api.fetchPicks).toHaveBeenCalledOnce());
    const signal = api.fetchPicks.mock.calls[0]?.[2] as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("stops polling after every draft slot is occupied", async () => {
    vi.useFakeTimers();
    api.fetchDraft.mockResolvedValue(draft());
    api.fetchPicks.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        playerId: String(index + 1),
        pickNumber: index + 1,
        round: Math.ceil((index + 1) / 4),
        draftSlot: (index % 4) + 1,
        isKeeper: false,
      })),
    );

    const { result, unmount } = renderHook(() => useDraftSync("123456789"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(result.current.snapshot?.currentPick).toBeNull();
    expect(result.current.diagnostics.nextRefreshMs).toBeNull();
    expect(api.fetchPicks).toHaveBeenCalledTimes(1);
    unmount();
  });
});

function draft(overrides: Partial<SleeperDraft> = {}): SleeperDraft {
  return {
    draftId: "123456789",
    name: "Test Draft",
    status: "drafting",
    type: "snake",
    teams: 4,
    rounds: 3,
    draftOrder: {},
    slotToRosterId: {},
    creatorUserIds: [],
    ...overrides,
  };
}
