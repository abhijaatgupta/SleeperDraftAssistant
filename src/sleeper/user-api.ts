import type { SleeperUserIdentity } from "../types/draft";

const USER_ENDPOINT = "https://api.sleeper.app/v1/user";

export async function fetchSleeperUser(
  usernameOrId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<SleeperUserIdentity> {
  const lookup = usernameOrId.trim();
  if (!lookup) {
    throw new Error("Enter a Sleeper username.");
  }

  const response = await fetchImplementation(`${USER_ENDPOINT}/${encodeURIComponent(lookup)}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "Sleeper could not find that username."
        : `Sleeper user request failed with HTTP ${response.status}.`,
    );
  }

  const value: unknown = await response.json();
  if (!value || typeof value !== "object") {
    throw new Error("Sleeper returned an invalid user response.");
  }

  const record = value as Record<string, unknown>;
  const userId = readText(record.user_id);
  const username = readText(record.username);
  const displayName = readText(record.display_name);
  if (!userId || !username) {
    throw new Error("Sleeper returned an invalid user response.");
  }

  return { userId, username, displayName: displayName || username };
}

function readText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}
