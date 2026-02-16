import type { CardSetSummary } from "../../phaser/api/ApiManager";
import { normalizeSetId } from "./utils";

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
  onSave,
}: Props) {
  return (
    <header className="deck-setup-topbar">
      <div className="deck-setup-toprow">
        <div className="deck-setup-title">
          <button
            className="deck-setup-back"
            type="button"
            onClick={() => {
              window.location.href = "/lobby";
            }}
          >
            Back
          </button>
          <div className="deck-setup-heading">
            <h1>Setup Deck</h1>
            <span className="deck-setup-subtitle">Pick an epic, browse cards, build your deck.</span>
          </div>
        </div>

        <div className="deck-setup-savewrap">
          {saveNote && (
            <span className={`deck-setup-savenote ${saveNoteIsError ? "is-error" : ""}`}>{saveNote}</span>
          )}
          <button type="button" className="deck-setup-save" onClick={onSave} disabled={saveDisabled}>
            {saveLabel}
          </button>
        </div>
      </div>

      <div className="deck-setup-controls">
        <label className="deck-setup-control">
          <span>Epic</span>
          <select value={selectedSet} onChange={(e) => onSelectedSetChange(normalizeSetId(e.target.value))}>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
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

