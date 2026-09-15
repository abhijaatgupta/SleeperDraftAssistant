import { extractSleeperDraftId } from "./draft-url-parser";
import { readDraftPagePickOwnership } from "./draft-page-ownership";
import {
  DRAFT_PAGE_DETECTED,
  isGetDraftPageContextMessage,
  type DraftPageContextResponse,
  type DraftPageDetectedMessage,
} from "../shared/messages";

let lastReportedFingerprint = "";
let reportTimer: ReturnType<typeof setTimeout> | undefined;

function reportDraftPage(): void {
  const url = window.location.href;
  const pickOwnership = readDraftPagePickOwnership(document);
  const fingerprint = JSON.stringify({ url, pickOwnership });
  if (fingerprint === lastReportedFingerprint) {
    return;
  }

  lastReportedFingerprint = fingerprint;
  const message: DraftPageDetectedMessage = {
    type: DRAFT_PAGE_DETECTED,
    url,
    draftId: extractSleeperDraftId(url),
    detectedAt: new Date().toISOString(),
    pickOwnership,
  };

  void chrome.runtime.sendMessage(message).catch(() => {
    // The extension may be reloading while the page remains open.
  });
}

function scheduleDraftPageReport(): void {
  if (reportTimer) return;
  reportTimer = setTimeout(() => {
    reportTimer = undefined;
    reportDraftPage();
  }, 100);
}

reportDraftPage();
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isGetDraftPageContextMessage(message)) {
    return;
  }

  const response: DraftPageContextResponse = {
    url: window.location.href,
    draftId: extractSleeperDraftId(window.location.href),
    pickOwnership: readDraftPagePickOwnership(document),
  };
  sendResponse(response);
});
window.addEventListener("popstate", reportDraftPage);
window.addEventListener("hashchange", reportDraftPage);
window.addEventListener("pageshow", reportDraftPage);

const navigationObserver = new MutationObserver(scheduleDraftPageReport);
navigationObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
