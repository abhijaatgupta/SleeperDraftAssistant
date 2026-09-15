import { useEffect, useState } from "react";
import { buildDraftSnapshot } from "../../draft/draft-state";
import {
  fetchSleeperDraft,
  fetchSleeperDraftPicks,
  fetchSleeperDraftTradedPicks,
} from "../../sleeper/draft-api";
import type { DraftConnectionState, SleeperDraft, SleeperTradedPick } from "../../types/draft";

const LIVE_POLL_MS = 750;
const WAITING_POLL_MS = 5_000;
const TRADED_PICKS_REFRESH_MS = 10_000;
const LIVE_METADATA_REFRESH_MS = 30_000;
const WAITING_METADATA_REFRESH_MS = 5_000;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 60_000;

const IDLE_STATE: DraftConnectionState = {
  draftId: null,
  health: "idle",
  snapshot: null,
  error: null,
  diagnostics: { lastAttemptAt: null, consecutiveFailures: 0, nextRefreshMs: null },
};

export function useDraftSync(draftId: string | null): DraftConnectionState {
  const [state, setState] = useState<DraftConnectionState>(IDLE_STATE);

  useEffect(() => {
    if (!draftId) {
      setState(IDLE_STATE);
      return;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let draft: SleeperDraft | null = null;
    let tradedPicks: SleeperTradedPick[] = [];
    let metadataFetchedAt: number | null = null;
    let tradedPicksFetchedAt: number | null = null;
    let consecutiveFailures = 0;
    const controller = new AbortController();
    setState({
      draftId,
      health: "connecting",
      snapshot: null,
      error: null,
      diagnostics: { lastAttemptAt: null, consecutiveFailures: 0, nextRefreshMs: null },
    });

    const synchronize = async () => {
      const lastAttemptAt = new Date().toISOString();
      try {
        const now = Date.now();
        const metadataRefreshMs =
          draft?.status === "drafting" ? LIVE_METADATA_REFRESH_MS : WAITING_METADATA_REFRESH_MS;
        const refreshMetadata =
          !draft || metadataFetchedAt === null || now - metadataFetchedAt >= metadataRefreshMs;
        const refreshTradedPicks =
          tradedPicksFetchedAt === null || now - tradedPicksFetchedAt >= TRADED_PICKS_REFRESH_MS;

        const [draftResult, picksResult, tradedPicksResult] = await Promise.allSettled([
          refreshMetadata
            ? fetchSleeperDraft(draftId, fetch, controller.signal)
            : Promise.resolve(draft as SleeperDraft),
          fetchSleeperDraftPicks(draftId, fetch, controller.signal),
          refreshTradedPicks
            ? fetchSleeperDraftTradedPicks(draftId, fetch, controller.signal)
            : Promise.resolve(tradedPicks),
        ]);
        if (draftResult.status === "rejected") throw draftResult.reason;
        if (picksResult.status === "rejected") throw picksResult.reason;
        if (tradedPicksResult.status === "rejected") throw tradedPicksResult.reason;

        if (disposed) {
          return;
        }

        draft = draftResult.value;
        tradedPicks = tradedPicksResult.value;
        if (refreshMetadata) metadataFetchedAt = Date.now();
        if (refreshTradedPicks) tradedPicksFetchedAt = Date.now();
        consecutiveFailures = 0;

        const snapshot = buildDraftSnapshot(draft, picksResult.value, new Date(), tradedPicks);
        const nextRefreshMs =
          snapshot.currentPick === null
            ? null
            : draft.status === "drafting"
              ? LIVE_POLL_MS
              : WAITING_POLL_MS;
        setState({
          draftId,
          health: "live",
          snapshot,
          error: null,
          diagnostics: { lastAttemptAt, consecutiveFailures: 0, nextRefreshMs },
        });
        if (snapshot.currentPick !== null) {
          timer = setTimeout(() => void synchronize(), nextRefreshMs as number);
        }
      } catch (error) {
        if (disposed) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Sleeper draft synchronization failed.";
        consecutiveFailures += 1;
        const retryDelay = Math.min(RETRY_BASE_MS * 2 ** (consecutiveFailures - 1), RETRY_MAX_MS);
        setState((previous) => ({
          draftId,
          health: previous.snapshot ? "stale" : "error",
          snapshot: previous.snapshot,
          error: message,
          diagnostics: {
            lastAttemptAt,
            consecutiveFailures,
            nextRefreshMs: retryDelay,
          },
        }));
        timer = setTimeout(() => void synchronize(), retryDelay);
      }
    };

    void synchronize();
    return () => {
      disposed = true;
      controller.abort();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [draftId]);

  return state;
}
