import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveUserDraftIdentity } from "../../draft/pick-ownership";
import { fetchSleeperUser } from "../../sleeper/user-api";
import type { SleeperDraft, SleeperUserIdentity, UserDraftIdentity } from "../../types/draft";

const STORAGE_KEY = "sleeperUserIdentity";

export interface SleeperIdentityState {
  identity: UserDraftIdentity | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveUsername: (username: string) => Promise<void>;
}

export function useSleeperIdentity(draft: SleeperDraft | null): SleeperIdentityState {
  const [savedUser, setSavedUser] = useState<SleeperUserIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!globalThis.chrome?.storage?.local) {
      setLoading(false);
      return;
    }

    let active = true;
    void chrome.storage.local
      .get(STORAGE_KEY)
      .then((result) => {
        if (active && isSleeperUserIdentity(result[STORAGE_KEY])) {
          setSavedUser(result[STORAGE_KEY]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const saveUsername = useCallback(async (username: string) => {
    setSaving(true);
    setError(null);
    try {
      const user = await fetchSleeperUser(username);
      if (globalThis.chrome?.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: user });
      }
      setSavedUser(user);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Sleeper user lookup failed.");
    } finally {
      setSaving(false);
    }
  }, []);

  const identity = useMemo(
    () => (draft ? resolveUserDraftIdentity(draft, savedUser) : null),
    [draft, savedUser],
  );

  return { identity, loading, saving, error, saveUsername };
}

function isSleeperUserIdentity(value: unknown): value is SleeperUserIdentity {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<SleeperUserIdentity>;
  return (
    typeof record.userId === "string" &&
    typeof record.username === "string" &&
    typeof record.displayName === "string"
  );
}
