import type { SleeperAdpFormat } from "./sleeper";

export type SleeperDraftStatus = "pre_draft" | "drafting" | "paused" | "complete" | "unknown";

export interface DraftRosterSettings {
  qb: number;
  rb: number;
  wr: number;
  te: number;
  flex: number;
  receiverFlex: number;
  superFlex: number;
  kicker: number;
  defense: number;
  bench: number;
}

export interface SleeperDraft {
  draftId: string;
  name: string;
  status: SleeperDraftStatus;
  type: string;
  season?: string;
  scoringFormat?: SleeperAdpFormat;
  teams: number;
  rounds: number;
  pickTimerSeconds?: number;
  rosterSettings?: DraftRosterSettings;
  draftOrder: Record<string, number>;
  slotToRosterId: Record<number, number>;
  creatorUserIds: string[];
}

export interface SleeperTradedPick {
  round: number;
  originalRosterId: number;
  previousOwnerId: number;
  ownerId: number;
}

export interface SleeperDraftPick {
  playerId: string;
  pickNumber: number;
  round: number;
  draftSlot: number;
  rosterId?: string;
  pickedBy?: string;
  playerName?: string;
  position?: string;
  team?: string;
  isKeeper: boolean;
}

export interface DraftSnapshot {
  draft: SleeperDraft;
  picks: SleeperDraftPick[];
  draftedPlayerIds: string[];
  totalPicks: number;
  currentPick: number | null;
  completedPickCount: number;
  futureKeeperCount: number;
  tradedPicks: SleeperTradedPick[];
  lastSuccessfulSyncAt: string;
}

export interface SleeperUserIdentity {
  userId: string;
  username: string;
  displayName: string;
}

export interface UserDraftIdentity {
  user: SleeperUserIdentity;
  draftSlot: number;
  rosterId: number | null;
  automatic: boolean;
}

export interface OwnedDraftPick {
  overallPick: number;
  round: number;
  pickInRound: number;
  draftSlot: number;
  originalRosterId: number | null;
  ownerRosterId: number | null;
  acquired: boolean;
}

export type DraftConnectionHealth = "idle" | "connecting" | "live" | "stale" | "error";

export interface DraftConnectionDiagnostics {
  lastAttemptAt: string | null;
  consecutiveFailures: number;
  nextRefreshMs: number | null;
}

export interface DraftConnectionState {
  draftId: string | null;
  health: DraftConnectionHealth;
  snapshot: DraftSnapshot | null;
  error: string | null;
  diagnostics: DraftConnectionDiagnostics;
}
