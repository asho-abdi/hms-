import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import './lab-catalog-picker.css';

/**
 * Loads `/lab/catalog` and lets the user pick tests by category (checkboxes).
 * @param {string[]} selectedIds - LabTest _id strings
 * @param {(ids: string[]) => void} onChange
 */
export function LabCatalogPicker({ selectedIds, onChange, disabled = false }) {
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/lab/catalog');
        if (!cancelled) setCatalog(data.categories || []);
      } catch {
        if (!cancelled) {
          setCatalog([]);
          toast.error('Could not load test catalog');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id) => {
    if (disabled) return;
    const idStr = String(id);
    const cur = selectedIds.map(String);
    const i = cur.indexOf(idStr);
    if (i >= 0) onChange([...cur.slice(0, i), ...cur.slice(i + 1)]);
    else onChange([...cur, idStr]);
  };

  if (!catalog) {
    return <p className="muted">Loading test catalog…</p>;
  }

  if (!catalog.length) {
    return <p className="muted">No tests in catalog. Ensure the server has run at least once to seed categories.</p>;
  }

  return (
    <div className="lab-catalog-picker">
      {catalog.map((cat) => (
        <details key={cat._id} className="lab-catalog-picker__cat" open>
          <summary className="lab-catalog-picker__summary">{cat.name}</summary>
          <div className="lab-catalog-picker__tests" role="group" aria-label={cat.name}>
            {(cat.tests || []).map((t) => {
              const idStr = String(t._id);
              return (
                <label key={t._id} className="lab-catalog-picker__row">
                  <input
                    type="checkbox"
                    checked={selectedIds.map(String).indexOf(idStr) >= 0}
                    onChange={() => toggle(t._id)}
                    disabled={disabled}
                  />
                  <span className="lab-catalog-picker__name">{t.name}</span>
                  <span className="muted lab-catalog-picker__type">{t.type}</span>
                </label>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
