import { DraftBoardCard } from "./components/DraftBoardCard";
import { DraftStatusCard } from "./components/DraftStatusCard";
import { PersonalTargetsPanel } from "./components/PersonalTargetsPanel";
import { PlayerMatchingWarning } from "./components/PlayerMatchingWarning";
import { PlayerSearchCard } from "./components/PlayerSearchCard";
import { RecommendationsPanel } from "./components/RecommendationsPanel";
import { TeamRosterCard } from "./components/TeamRosterCard";
import { UpcomingPicksCard } from "./components/UpcomingPicksCard";
import { useActiveSleeperDraft } from "./hooks/useActiveSleeperDraft";
import { useDraftBoard } from "./hooks/useDraftBoard";
import { useDraftSync } from "./hooks/useDraftSync";
import { useSleeperIdentity } from "./hooks/useSleeperIdentity";

export function App() {
  const activeDraft = useActiveSleeperDraft();
  const draftConnection = useDraftSync(activeDraft.draftId);
  const identityState = useSleeperIdentity(draftConnection.snapshot?.draft ?? null);
  const {
    board,
    loading,
    importing,
    matchingError,
    matchingWarning,
    adpFormat,
    adpRefreshing,
    adpError,
    adpWarning,
    errors,
    importBoard,
    retryPlayerMatching,
  } = useDraftBoard(
    draftConnection.snapshot?.draft.season,
    draftConnection.snapshot?.draft.scoringFormat,
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Sleeper Draft Assistant</p>
          <h1>Draft workspace</h1>
        </div>
        <span className={`status-badge ${board ? "status-badge-ready" : ""}`}>
          {board ? "Board ready" : "Setup required"}
        </span>
      </header>

      <DraftStatusCard activeDraft={activeDraft} connection={draftConnection} />

      <DraftBoardCard
        board={board}
        loading={loading}
        importing={importing}
        errors={errors}
        adpFormat={adpFormat}
        adpRefreshing={adpRefreshing}
        adpError={adpError}
        adpWarning={adpWarning}
        onImport={() => void importBoard()}
      />

      {board && (
        <PlayerMatchingWarning
          board={board}
          error={matchingError}
          staleCatalogWarning={matchingWarning}
          onRetry={() => void retryPlayerMatching()}
        />
      )}

      <PlayerSearchCard board={board} snapshot={draftConnection.snapshot} />

      <RecommendationsPanel board={board} snapshot={draftConnection.snapshot} />

      <PersonalTargetsPanel
        board={board}
        snapshot={draftConnection.snapshot}
        identity={identityState.identity}
        pagePickOwnership={activeDraft.pickOwnership}
      />

      <UpcomingPicksCard
        snapshot={draftConnection.snapshot}
        pagePickOwnership={activeDraft.pickOwnership}
        identityState={identityState}
      />

      <TeamRosterCard
        board={board}
        snapshot={draftConnection.snapshot}
        identity={identityState.identity}
        pagePickOwnership={activeDraft.pickOwnership}
      />
    </main>
  );
}
