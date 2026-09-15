const DRAFT_PATH_PATTERN = /\/(?:draft|mock-draft)(?:\/[^/?#]+)?\/(\d{8,})(?:[/?#]|$)/i;

export function extractSleeperDraftId(value: string): string | null {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (!isSleeperHost(url.hostname)) {
    return null;
  }

  const match = url.pathname.match(DRAFT_PATH_PATTERN);
  return match?.[1] ?? null;
}

function isSleeperHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "sleeper.com" ||
    normalized.endsWith(".sleeper.com") ||
    normalized === "sleeper.app" ||
    normalized.endsWith(".sleeper.app")
  );
}
