import type {
  DraftSnapshot,
  SleeperDraft,
  SleeperDraftPick,
  SleeperTradedPick,
} from "../types/draft";

export function buildDraftSnapshot(
  draft: SleeperDraft,
  picks: SleeperDraftPick[],
  syncedAt = new Date(),
  tradedPicks: SleeperTradedPick[] = [],
): DraftSnapshot {
  const totalPicks = draft.teams * draft.rounds;
  const occupiedPickNumbers = new Set(
    picks
      .map((pick) => pick.pickNumber)
      .filter((pickNumber) => pickNumber >= 1 && pickNumber <= totalPicks),
  );
  const currentPick = findFirstOpenPick(occupiedPickNumbers, totalPicks);
  const completedPickCount =
    currentPick === null
      ? occupiedPickNumbers.size
      : [...occupiedPickNumbers].filter((pickNumber) => pickNumber < currentPick).length;
  const futureKeeperCount =
    currentPick === null ? 0 : picks.filter((pick) => pick.pickNumber > currentPick).length;

  return {
    draft,
    picks,
    draftedPlayerIds: [...new Set(picks.map((pick) => pick.playerId))],
    totalPicks,
    currentPick,
    completedPickCount,
    futureKeeperCount,
    tradedPicks,
    lastSuccessfulSyncAt: syncedAt.toISOString(),
  };
}

function findFirstOpenPick(occupiedPickNumbers: Set<number>, totalPicks: number): number | null {
  for (let pickNumber = 1; pickNumber <= totalPicks; pickNumber += 1) {
    if (!occupiedPickNumbers.has(pickNumber)) {
      return pickNumber;
    }
  }
  return null;
}
