import type { BoardPosition } from "./board";

export const SLEEPER_ADP_FORMATS = ["standard", "half_ppr", "ppr", "2qb"] as const;
export type SleeperAdpFormat = (typeof SLEEPER_ADP_FORMATS)[number];

export interface SleeperAdpPlayer {
  playerId: string;
  position: BoardPosition;
  fantasyPositions: BoardPosition[];
  overallAdp: number;
}

export interface SleeperAdpSnapshot {
  season: string;
  format: SleeperAdpFormat;
  fetchedAt: string;
  players: SleeperAdpPlayer[];
}

export const SLEEPER_CATALOG_ID = "nfl-active-offense";

export interface SleeperPlayer {
  playerId: string;
  name: string;
  normalizedName: string;
  position: BoardPosition;
  fantasyPositions: BoardPosition[];
  team?: string;
  active: boolean;
  searchRank?: number;
}

export interface SleeperPlayerCatalog {
  catalogId: typeof SLEEPER_CATALOG_ID;
  fetchedAt: string;
  expiresAt: string;
  players: SleeperPlayer[];
}

export type PlayerMatchMethod = "provided-id" | "exact-name" | "name-without-suffix";
export type PlayerMatchIssueKind = "unmatched" | "ambiguous" | "invalid-provided-id";

export interface PlayerMatchCandidate {
  playerId: string;
  name: string;
  position: BoardPosition;
  team?: string;
}

export interface PlayerMatchIssue {
  kind: PlayerMatchIssueKind;
  boardPlayerId: string;
  name: string;
  position: BoardPosition;
  team: string;
  providedSleeperPlayerId?: string;
  candidates: PlayerMatchCandidate[];
}

export interface BoardMatchSummary {
  matcherVersion: number;
  catalogFetchedAt: string;
  matchedAt: string;
  matchedCount: number;
  unmatchedCount: number;
  ambiguousCount: number;
  invalidProvidedIdCount: number;
  issues: PlayerMatchIssue[];
}

export interface CatalogLoadResult {
  catalog: SleeperPlayerCatalog;
  source: "cache" | "network" | "stale-cache";
  warning?: string;
}
