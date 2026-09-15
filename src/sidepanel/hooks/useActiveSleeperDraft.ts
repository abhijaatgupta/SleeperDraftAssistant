import { useEffect, useState } from "react";
import { extractSleeperDraftId } from "../../content/draft-url-parser";
import {
  GET_DRAFT_PAGE_CONTEXT,
  isDraftPagePickOwnership,
  isDraftPageDetectedMessage,
  type DraftPagePickOwnership,
  type DraftPageContextResponse,
} from "../../shared/messages";

export interface ActiveSleeperDraft {
  tabId: number | null;
  draftId: string | null;
  url: string | null;
  pickOwnership: DraftPagePickOwnership | null;
}

const EMPTY_DRAFT: ActiveSleeperDraft = {
  tabId: null,
  draftId: null,
  url: null,
  pickOwnership: null,
};

export function useActiveSleeperDraft(): ActiveSleeperDraft {
  const [activeDraft, setActiveDraft] = useState<ActiveSleeperDraft>(EMPTY_DRAFT);

  useEffect(() => {
    if (!globalThis.chrome?.tabs) {
      return;
    }

    let mounted = true;
    const refresh = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!mounted) {
          return;
        }

        const directUrl = tab?.url ?? null;
        const pageContext = tab?.id === undefined ? null : await requestDraftPageContext(tab.id);
        const storedDraftPage =
          tab?.id === undefined ? null : await readStoredDraftPage(`draftPage:${tab.id}`);
        const url = pageContext?.url ?? directUrl ?? storedDraftPage?.url ?? null;
        setActiveDraft({
          tabId: tab?.id ?? null,
          draftId:
            pageContext?.draftId ??
            (directUrl ? extractSleeperDraftId(directUrl) : null) ??
            storedDraftPage?.draftId ??
            null,
          url,
          pickOwnership: pageContext?.pickOwnership ?? storedDraftPage?.pickOwnership ?? null,
        });
      } catch {
        if (mounted) {
          setActiveDraft(EMPTY_DRAFT);
        }
      }
    };
    const onActivated = () => void refresh();
    const onUpdated = (
      _tabId: number,
      changeInfo: { url?: string; status?: string },
      tab: chrome.tabs.Tab,
    ) => {
      if (tab.active && (changeInfo.url || changeInfo.status === "complete")) {
        void refresh();
      }
    };
    const onMessage = (message: unknown) => {
      if (isDraftPageDetectedMessage(message)) {
        void refresh();
      }
    };
    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (
        areaName === "session" &&
        Object.keys(changes).some((key) => key.startsWith("draftPage:"))
      ) {
        void refresh();
      }
    };

    void refresh();
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => {
      mounted = false;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
  }, []);

  return activeDraft;
}

async function requestDraftPageContext(tabId: number): Promise<DraftPageContextResponse | null> {
  try {
    const response: unknown = await chrome.tabs.sendMessage(tabId, {
      type: GET_DRAFT_PAGE_CONTEXT,
    });
    if (!response || typeof response !== "object") {
      return null;
    }

    const context = response as Partial<DraftPageContextResponse>;
    return typeof context.url === "string" &&
      (typeof context.draftId === "string" || context.draftId === null) &&
      isDraftPagePickOwnership(context.pickOwnership)
      ? { url: context.url, draftId: context.draftId, pickOwnership: context.pickOwnership }
      : null;
  } catch {
    // A tab loaded before an extension reload may not have the content script yet.
    return null;
  }
}

interface StoredDraftPage {
  url: string;
  draftId: string | null;
  pickOwnership: DraftPagePickOwnership | null;
}

async function readStoredDraftPage(key: string): Promise<StoredDraftPage | null> {
  const result = await chrome.storage.session.get(key);
  const value = result[key];
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<StoredDraftPage>;
  return typeof record.url === "string" &&
    (typeof record.draftId === "string" || record.draftId === null) &&
    isDraftPagePickOwnership(record.pickOwnership)
    ? { url: record.url, draftId: record.draftId, pickOwnership: record.pickOwnership }
    : null;
}
