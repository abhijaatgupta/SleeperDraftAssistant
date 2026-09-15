import type { RankingLabel } from "../types/board";

export const REQUIRED_BOARD_FIELDS = ["name"] as const;

export const OPTIONAL_BOARD_FIELDS = [
  "position",
  "team",
  "modelPositionRank",
  "modelOverallAdp",
  "projectedPositionSos",
  "isTarget",
  "sleeperPlayerId",
] as const;

export type RequiredBoardField = (typeof REQUIRED_BOARD_FIELDS)[number];
export type OptionalBoardField = (typeof OPTIONAL_BOARD_FIELDS)[number];
export type BoardField = RequiredBoardField | OptionalBoardField;

export const FIELD_LABELS: Record<BoardField, string> = {
  name: "Player",
  position: "Pos",
  team: "Team",
  modelPositionRank: "Model Pos Rank",
  projectedPositionSos: "Projected Pos SOS",
  modelOverallAdp: "Expected Overall ADP",
  isTarget: "isTarget",
  sleeperPlayerId: "Sleeper Player ID",
};

const FIELD_ALIASES: Record<BoardField, string[]> = {
  name: ["player", "playername"],
  position: ["pos", "position"],
  team: ["team", "nflteam"],
  modelPositionRank: [
    "modelposrank",
    "modelpositionrank",
    "userposrank",
    "usersposrank",
    "userposadp",
    "usersposadp",
  ],
  projectedPositionSos: ["projectedpossos", "positionsos", "possos"],
  modelOverallAdp: ["expectedoveralladp", "modeloveralladp", "useroveralladp", "usersoveralladp"],
  isTarget: ["istarget", "target", "targets", "personaltarget"],
  sleeperPlayerId: ["sleeperplayerid", "sleeperid"],
};

const FIELD_BY_ALIAS = new Map<string, BoardField>();
const USER_POSITION_RANK_ALIASES = new Set([
  "userposrank",
  "usersposrank",
  "userposadp",
  "usersposadp",
]);

for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [BoardField, string[]][]) {
  for (const alias of aliases) {
    FIELD_BY_ALIAS.set(alias, field);
  }
}

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function resolveBoardField(value: unknown): BoardField | null {
  return FIELD_BY_ALIAS.get(normalizeHeader(value)) ?? null;
}

export function resolveRankingLabel(value: unknown): RankingLabel | null {
  const normalized = normalizeHeader(value);
  if (FIELD_BY_ALIAS.get(normalized) !== "modelPositionRank") return null;
  return USER_POSITION_RANK_ALIASES.has(normalized) ? "User" : "Model";
}
