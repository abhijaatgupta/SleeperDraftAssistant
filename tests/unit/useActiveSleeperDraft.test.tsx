import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useActiveSleeperDraft } from "../../src/sidepanel/hooks/useActiveSleeperDraft";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useActiveSleeperDraft", () => {
  it("detects the draft ID directly from the active tab", async () => {
    const addActivated = vi.fn();
    const removeActivated = vi.fn();
    const addUpdated = vi.fn();
    const removeUpdated = vi.fn();
    const addMessage = vi.fn();
    const removeMessage = vi.fn();
    const addStorageChanged = vi.fn();
    const removeStorageChanged = vi.fn();
    const query = vi.fn(async () => [
      { id: 7, url: "https://sleeper.com/draft/nfl/123456789", active: true },
    ]);
    vi.stubGlobal("chrome", {
      tabs: {
        query,
        sendMessage: vi.fn(async () => ({
          url: "https://sleeper.com/draft/nfl/123456789",
          draftId: "123456789",
          pickOwnership: {
            ownedPickNumbers: [11, 30],
            tradedPickNumbers: [18, 23],
            keeperPickNumbers: [18],
          },
        })),
        onActivated: { addListener: addActivated, removeListener: removeActivated },
        onUpdated: { addListener: addUpdated, removeListener: removeUpdated },
      },
      runtime: {
        onMessage: { addListener: addMessage, removeListener: removeMessage },
      },
      storage: {
        session: { get: vi.fn(async () => ({})) },
        onChanged: { addListener: addStorageChanged, removeListener: removeStorageChanged },
      },
    });

    const { result, unmount } = renderHook(() => useActiveSleeperDraft());

    await waitFor(() => expect(result.current.draftId).toBe("123456789"));
    expect(result.current.tabId).toBe(7);
    expect(result.current.pickOwnership).toEqual({
      ownedPickNumbers: [11, 30],
      tradedPickNumbers: [18, 23],
      keeperPickNumbers: [18],
    });
    expect(query).toHaveBeenCalledWith({ active: true, lastFocusedWindow: true });
    expect(addActivated).toHaveBeenCalledOnce();
    expect(addUpdated).toHaveBeenCalledOnce();
    expect(addMessage).toHaveBeenCalledOnce();
    expect(addStorageChanged).toHaveBeenCalledOnce();

    unmount();
    expect(removeActivated).toHaveBeenCalledOnce();
    expect(removeUpdated).toHaveBeenCalledOnce();
    expect(removeMessage).toHaveBeenCalledOnce();
    expect(removeStorageChanged).toHaveBeenCalledOnce();
  });

  it("falls back to the content-script context when Chrome does not expose the tab URL", async () => {
    vi.stubGlobal("chrome", {
      tabs: {
        query: vi.fn(async () => [{ id: 9, active: true }]),
        sendMessage: vi.fn(async () => ({
          url: "https://sleeper.com/draft/nfl/1401806993487896576?ftue=commish",
          draftId: "1401806993487896576",
          pickOwnership: null,
        })),
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      storage: {
        session: { get: vi.fn(async () => ({})) },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });

    const { result } = renderHook(() => useActiveSleeperDraft());

    await waitFor(() => expect(result.current.draftId).toBe("1401806993487896576"));
    expect(result.current.tabId).toBe(9);
  });
});
