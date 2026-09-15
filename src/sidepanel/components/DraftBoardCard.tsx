import type { ImportIssue, StoredBoard } from "../../types/board";
import type { SleeperAdpFormat } from "../../types/sleeper";

interface DraftBoardCardProps {
  board: StoredBoard | null;
  loading: boolean;
  importing: boolean;
  errors: ImportIssue[];
  adpFormat: SleeperAdpFormat;
  adpRefreshing: boolean;
  adpError: string | null;
  adpWarning: string | null;
  onImport: () => void;
}

export function DraftBoardCard({
  board,
  loading,
  importing,
  errors,
  adpFormat,
  adpRefreshing,
  adpError,
  adpWarning,
  onImport,
}: DraftBoardCardProps) {
  const buttonLabel = importing
    ? "Importing…"
    : board
      ? "Replace draft board"
      : "Import draft board";

  return (
    <section className="draft-board-card" aria-labelledby="draft-board-title">
      <div className="draft-board-heading">
        <div>
          <p className="section-label">Draft board</p>
          <h2 id="draft-board-title">
            {loading ? "Loading saved board…" : (board?.metadata.fileName ?? "No board imported")}
          </h2>
          {!loading && !board && (
            <p>Select the model-generated Excel workbook used for this draft.</p>
          )}
          {board && <p>Imported {formatImportTime(board.metadata.importedAt)}.</p>}
        </div>
        <div className="draft-board-actions">
          <button type="button" onClick={onImport} disabled={loading || importing}>
            {buttonLabel}
          </button>
          <span className="adp-format-readonly">Sleeper ADP: {formatAdpLabel(adpFormat)}</span>
          {adpRefreshing && <span className="adp-refresh-status">Refreshing Sleeper ADP…</span>}
        </div>
      </div>

      {adpError && (
        <p className="adp-refresh-error" role="alert">
          {adpError}
        </p>
      )}
      {adpWarning && (
        <p className="adp-refresh-warning" role="status">
          {adpWarning}
        </p>
      )}

      {board && (
        <div className="import-summary" aria-label="Draft board import summary">
          <SummaryMetric label="Players" value={board.metadata.playerCount} />
          <SummaryMetric label="Targets" value={board.metadata.targetCount} />
          <SummaryMetric label="Warnings" value={board.metadata.warningCount} />
        </div>
      )}

      {errors.length > 0 && (
        <div className="import-errors" role="alert">
          <strong>Draft board was not replaced</strong>
          <ul>
            {errors.slice(0, 6).map((error, index) => (
              <li key={`${error.code}:${error.row ?? "none"}:${index}`}>
                {error.row ? `Row ${error.row}: ` : ""}
                {error.message}
              </li>
            ))}
          </ul>
          {errors.length > 6 && <p>{errors.length - 6} additional errors were found.</p>}
        </div>
      )}

      {board && board.warnings.length > 0 && (
        <details className="import-warnings">
          <summary>Review {board.warnings.length} import warning(s)</summary>
          <ul>
            {board.warnings.slice(0, 8).map((warning, index) => (
              <li key={`${warning.code}:${warning.row ?? "none"}:${index}`}>
                {warning.row ? `Row ${warning.row}: ` : ""}
                {warning.message}
              </li>
            ))}
          </ul>
          {board.warnings.length > 8 && (
            <p>{board.warnings.length - 8} additional warnings are stored with this import.</p>
          )}
        </details>
      )}
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function formatImportTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAdpLabel(format: SleeperAdpFormat): string {
  const labels: Record<SleeperAdpFormat, string> = {
    standard: "Standard",
    half_ppr: "Half-PPR",
    ppr: "PPR",
    "2qb": "2QB",
  };
  return labels[format];
}
