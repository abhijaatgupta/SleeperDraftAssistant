import type { BoardMatchSummary, PlayerMatchMethod, SleeperAdpFormat } from "./sleeper";

export const BOARD_POSITIONS = ["QB", "RB", "WR", "TE"] as const;

export type BoardPosition = (typeof BOARD_POSITIONS)[number];
export type RankingLabel = "Model" | "User";

export interface ImportedPlayer {
  boardPlayerId: string;
  providedSleeperPlayerId?: string;
  sleeperPlayerId?: string;
  sleeperMatchMethod?: PlayerMatchMethod;
  sourceRow: number;
  name: string;
  normalizedName: string;
  position: BoardPosition;
  team: string;
  sourcePositionProvided?: boolean;
  modelPositionRankProvided?: boolean;
  modelOverallAdpProvided?: boolean;
  sleeperPositionAdp: number;
  modelPositionRank: number;
  projectedPositionSos?: number;
  sleeperOverallAdp: number;
  sleeperOverallRank?: number;
  modelOverallAdp: number;
  positionEdge: number;
  overallEdge: number;
  isTarget: boolean;
}

export interface ImportIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  row?: number;
}

export interface BoardMetadata {
  boardId: string;
  fileName: string;
  fileHash: string;
  importedAt: string;
  playerCount: number;
  targetCount: number;
  warningCount: number;
  rankingLabel?: RankingLabel;
  sleeperAdpFormat?: SleeperAdpFormat;
  sleeperAdpSeason?: string;
  sleeperAdpFetchedAt?: string;
}

export interface StoredBoard {
  boardId: string;
  metadata: BoardMetadata;
  players: ImportedPlayer[];
  warnings: ImportIssue[];
  matching?: BoardMatchSummary;
}

export interface BoardImportResult {
  board: StoredBoard;
  warnings: ImportIssue[];
}
