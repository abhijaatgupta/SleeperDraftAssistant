import type { StoredBoard } from "../../types/board";

interface PlayerMatchingWarningProps {
  board: StoredBoard;
  error: string | null;
  staleCatalogWarning: string | null;
  onRetry: () => void;
}

export function PlayerMatchingWarning({
  board,
  error,
  staleCatalogWarning,
  onRetry,
}: PlayerMatchingWarningProps) {
  if (error) {
    return (
      <section className="matching-alert matching-alert-error" role="alert">
        <div>
          <strong>Sleeper player matching is temporarily unavailable.</strong>
          <p>Live player availability may be incomplete until the Sleeper catalog can be loaded.</p>
        </div>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </section>
    );
  }

  const issues = board.matching?.issues ?? [];
  if (issues.length > 0) {
    const playerNames = issues.map((issue) => issue.name);
    return (
      <section className="matching-alert" role="alert">
        <strong>Sleeper player matching is incomplete.</strong>
        <p>
          Unable to match the following draft-board players to Sleeper: {formatNames(playerNames)}.
          Live availability for these players may be inaccurate. Review their names, positions,
          teams, or Sleeper Player IDs and re-import the board.
        </p>
      </section>
    );
  }

  if (staleCatalogWarning) {
    return (
      <section className="matching-alert" role="status">
        <strong>Using a cached Sleeper player catalog.</strong>
        <p>{staleCatalogWarning}</p>
      </section>
    );
  }

  return null;
}

function formatNames(names: string[]): string {
  const visibleNames = names.slice(0, 12);
  const remainingCount = names.length - visibleNames.length;
  const formattedNames = new Intl.ListFormat(undefined, {
    style: "long",
    type: "conjunction",
  }).format(visibleNames);

  return remainingCount > 0
    ? `${formattedNames}, and ${remainingCount} additional player${remainingCount === 1 ? "" : "s"}`
    : formattedNames;
}
