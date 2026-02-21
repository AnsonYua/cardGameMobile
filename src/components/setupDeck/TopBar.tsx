import type { CardSetSummary, TopDeckItem } from "../../phaser/api/ApiManager";
import { normalizeSetId } from "./utils";
import { TopDeckPicker } from "./TopDeckPicker";

type Props = {
  sets: CardSetSummary[];
  selectedSet: string;
  onSelectedSetChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  saveDisabled: boolean;
  saveLabel: string;
  saveNote: string | null;
  saveNoteIsError: boolean;
  topDecks: TopDeckItem[];
  topDeckOpen: boolean;
  topDeckStatus: "idle" | "loading" | "error";
  topDeckError: string | null;
  onTopDeckToggle: () => void;
  onTopDeckSelect: (deck: TopDeckItem) => void;
  onSave: () => void;
};

export function TopBar({
  sets,
  selectedSet,
  onSelectedSetChange,
  search,
  onSearchChange,
  saveDisabled,
  saveLabel,
  saveNote,
  saveNoteIsError,
  topDecks,
  topDeckOpen,
  topDeckStatus,
  topDeckError,
  onTopDeckToggle,
  onTopDeckSelect,
  onSave,
}: Props) {
  const getSetLabel = (set: CardSetSummary) => {
    const raw = set as CardSetSummary & Record<string, unknown>;
    const candidates = [raw.name, raw.setName, raw.displayName, raw.title, raw.deckName, set.id];
    const cardCountOnly = /^\s*\d+\s*cards?\s*$/i;
    for (const value of candidates) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (!cardCountOnly.test(trimmed)) return trimmed;
    }
    return set.id;
  };

  return (
    <header className="deck-setup-topbar">
      <div className="deck-setup-toprow">
        <div className="deck-setup-title">
          <div className="deck-setup-heading">
            <h1>Setup Deck</h1>
            <span className="deck-setup-subtitle">Pick an epic, browse cards, build your deck.</span>
          </div>
        </div>

        <div className="deck-setup-savewrap">
          <div className="deck-setup-saveactions">
            <TopDeckPicker
              topDecks={topDecks}
              topDeckOpen={topDeckOpen}
              topDeckStatus={topDeckStatus}
              onTopDeckToggle={onTopDeckToggle}
              onTopDeckSelect={onTopDeckSelect}
            />
            <button type="button" className="deck-setup-save" onClick={onSave} disabled={saveDisabled}>
              {saveLabel}
            </button>
          </div>
          {saveNote && <span className={`deck-setup-savenote ${saveNoteIsError ? "is-error" : ""}`}>{saveNote}</span>}
        </div>
      </div>

      {topDeckError && <div className="deck-setup-topdeck-error">{topDeckError}</div>}

      <div className="deck-setup-controls">
        <label className="deck-setup-control">
          <span>Epic</span>
          <select value={selectedSet} onChange={(e) => onSelectedSetChange(normalizeSetId(e.target.value))}>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {getSetLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="deck-setup-control">
          <span>Search</span>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Name or ID (ex: Gundam, ST01-001)"
          />
        </label>
      </div>
    </header>
  );
}
