import { isDraftPageDetectedMessage } from "../shared/messages";

async function configureSidePanel(): Promise<void> {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

chrome.runtime.onInstalled.addListener(() => {
  void configureSidePanel();
});

chrome.runtime.onStartup.addListener(() => {
  void configureSidePanel();
});

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (!isDraftPageDetectedMessage(message) || sender.tab?.id === undefined) {
    return;
  }

  const storageKey = `draftPage:${sender.tab.id}`;
  void chrome.storage.session.set({
    [storageKey]: {
      url: message.url,
      draftId: message.draftId,
      detectedAt: message.detectedAt,
      pickOwnership: message.pickOwnership,
    },
  });
});

void configureSidePanel();
