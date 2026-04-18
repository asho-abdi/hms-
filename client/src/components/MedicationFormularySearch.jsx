import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import './medication-formulary-search.css';

/**
 * Searchable formulary: selecting a row fills medication + dosing (sig) on the visit.
 * @param {(preset: { id: string, medication: string, sig: string, label: string }) => void} onSelect
 */
export function MedicationFormularySearch({ onSelect }) {
  const [items, setItems] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/visits/medication-presets');
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setLoadError(true);
          toast.error('Could not load medication formulary');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered =
    !q || !items.length
      ? items
      : items.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            p.medication.toLowerCase().includes(q) ||
            p.sig.toLowerCase().includes(q)
        );

  return (
    <div ref={wrapRef} className="patient-combobox med-formulary">
      <input
        className="input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search by drug name, strength, or schedule…"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        role="combobox"
        disabled={loadError && items.length === 0}
      />
      <p className="muted med-formulary__hint">
        Selecting an item adds a medication line.
      </p>
      {open && items.length > 0 && filtered.length > 0 ? (
        <ul className="patient-combobox__list med-formulary__list" role="listbox" aria-label="Medication formulary">
          {filtered.map((p) => (
            <li key={p.id} role="presentation">
              <button
                type="button"
                className="patient-combobox__option med-formulary__option"
                role="option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(p);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <span className="med-formulary__name">{p.medication}</span>
                <span className="muted med-formulary__sig">{p.sig}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && items.length > 0 && q && filtered.length === 0 ? (
        <p className="patient-combobox__empty muted">No match. Enter manually.</p>
      ) : null}
    </div>
  );
}
