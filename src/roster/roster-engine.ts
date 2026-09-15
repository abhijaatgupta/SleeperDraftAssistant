import { buildDraftPickOwnership } from "../draft/pick-ownership";
import type { DraftPagePickOwnership } from "../shared/messages";
import type { ImportedPlayer } from "../types/board";
import type {
  DraftRosterSettings,
  DraftSnapshot,
  SleeperDraftPick,
  UserDraftIdentity,
} from "../types/draft";

export type StarterSlotKind =
  "QB" | "RB" | "WR" | "TE" | "FLEX" | "REC_FLEX" | "SUPER_FLEX" | "K" | "DEF";

export interface RosterPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  isKeeper: boolean;
  pickNumber: number;
}

export interface FilledStarterSlot {
  id: string;
  kind: StarterSlotKind;
  label: string;
  player: RosterPlayer | null;
}

export interface BuiltTeamRoster {
  starters: FilledStarterSlot[];
  bench: RosterPlayer[];
  configuredBenchSize: number;
  displayedBenchSize: number;
  ownedPlayerCount: number;
}

export function buildTeamRoster(
  snapshot: DraftSnapshot,
  identity: UserDraftIdentity,
  boardPlayers: ImportedPlayer[],
  pagePickOwnership: DraftPagePickOwnership | null = null,
): BuiltTeamRoster {
  const starters = buildStarterSlots(snapshot.draft.rosterSettings);
  const configuredBenchSize =
    snapshot.draft.rosterSettings?.bench ?? Math.max(0, snapshot.draft.rounds - starters.length);
  const ownedPickNumbers = new Set(
    buildDraftPickOwnership(snapshot.draft, snapshot.tradedPicks, identity, pagePickOwnership).map(
      (pick) => pick.overallPick,
    ),
  );
  const pageKeeperPickNumbers = new Set(pagePickOwnership?.keeperPickNumbers ?? []);
  const boardBySleeperId = new Map(
    boardPlayers
      .filter((player) => player.sleeperPlayerId)
      .map((player) => [player.sleeperPlayerId as string, player]),
  );
  const ownedPlayers = snapshot.picks
    .map((pick) => ({
      pick,
      isKeeper:
        pick.isKeeper ||
        pageKeeperPickNumbers.has(pick.pickNumber) ||
        (snapshot.currentPick !== null && pick.pickNumber > snapshot.currentPick),
    }))
    .filter(({ pick }) => ownedPickNumbers.has(pick.pickNumber))
    .sort((left, right) =>
      left.isKeeper === right.isKeeper
        ? left.pick.pickNumber - right.pick.pickNumber
        : left.isKeeper
          ? -1
          : 1,
    )
    .map(({ pick, isKeeper }) => toRosterPlayer(pick, isKeeper, boardBySleeperId));
  const bench: RosterPlayer[] = [];

  for (const player of ownedPlayers) {
    const naturalSlot = starters.find(
      (slot) => slot.player === null && slot.kind === player.position,
    );
    const flexSlot = starters.find(
      (slot) => slot.player === null && isEligibleForSlot(player.position, slot.kind),
    );
    const destination = naturalSlot ?? flexSlot;
    if (destination) {
      destination.player = player;
    } else {
      bench.push(player);
    }
  }

  return {
    starters,
    bench,
    configuredBenchSize,
    displayedBenchSize: Math.max(configuredBenchSize, bench.length),
    ownedPlayerCount: ownedPlayers.length,
  };
}

function buildStarterSlots(settings: DraftRosterSettings | undefined): FilledStarterSlot[] {
  if (!settings) return [];

  const definitions: Array<[StarterSlotKind, string, number]> = [
    ["QB", "QB", settings.qb],
    ["RB", "RB", settings.rb],
    ["WR", "WR", settings.wr],
    ["TE", "TE", settings.te],
    ["FLEX", "FLEX", settings.flex],
    ["REC_FLEX", "REC FLEX", settings.receiverFlex],
    ["SUPER_FLEX", "SUPER FLEX", settings.superFlex],
    ["K", "K", settings.kicker],
    ["DEF", "DEF", settings.defense],
  ];

  return definitions.flatMap(([kind, label, count]) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${kind}-${index + 1}`,
      kind,
      label,
      player: null,
    })),
  );
}

function toRosterPlayer(
  pick: SleeperDraftPick,
  isKeeper: boolean,
  boardBySleeperId: Map<string, ImportedPlayer>,
): RosterPlayer {
  const boardPlayer = boardBySleeperId.get(pick.playerId);
  return {
    playerId: pick.playerId,
    name: boardPlayer?.name ?? pick.playerName ?? `Player ${pick.playerId}`,
    position: normalizePosition(boardPlayer?.position ?? pick.position ?? ""),
    team: boardPlayer?.team ?? pick.team ?? "",
    isKeeper,
    pickNumber: pick.pickNumber,
  };
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return ["DST", "D/ST", "DEFENSE"].includes(normalized) ? "DEF" : normalized;
}

function isEligibleForSlot(position: string, slot: StarterSlotKind): boolean {
  if (slot === "FLEX") return ["RB", "WR", "TE"].includes(position);
  if (slot === "REC_FLEX") return ["WR", "TE"].includes(position);
  if (slot === "SUPER_FLEX") return ["QB", "RB", "WR", "TE"].includes(position);
  return false;
}
