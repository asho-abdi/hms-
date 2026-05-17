import { useEffect, useMemo, useState } from 'react';
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
  const [search, setSearch] = useState('');

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

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);
  const searchQuery = search.trim().toLowerCase();

  const filteredCatalog = useMemo(() => {
    if (!catalog) return [];
    if (!searchQuery) return catalog;

    return catalog
      .map((cat) => {
        const tests = (Array.isArray(cat.tests) ? cat.tests : []).filter((t) => !t.parent_test);
        const categoryMatch = String(cat.name || '').toLowerCase().includes(searchQuery);
        const filteredTests = categoryMatch
          ? tests
          : tests.filter((t) => String(t.name || '').toLowerCase().includes(searchQuery));
        return { ...cat, tests: filteredTests };
      })
      .filter((cat) => (cat.tests || []).length > 0);
  }, [catalog, searchQuery]);

  if (!catalog) {
    return <p className="muted">Loading test catalog…</p>;
  }

  if (!catalog.length) {
    return <p className="muted">No tests in catalog.</p>;
  }

  return (
    <div className="lab-catalog-picker">
      <div className="lab-catalog-picker__search-wrap">
        <input
          type="search"
          className="input lab-catalog-picker__search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search test name or category…"
          autoComplete="off"
          disabled={disabled}
          aria-label="Search lab tests"
        />
      </div>

      {filteredCatalog.length === 0 ? <p className="muted lab-catalog-picker__empty">No tests match your search.</p> : null}

      {filteredCatalog.map((cat) => (
        <details key={cat._id} className="lab-catalog-picker__cat">
          <summary className="lab-catalog-picker__summary">{cat.name}</summary>
          <div className="lab-catalog-picker__tests" role="group" aria-label={cat.name}>
            {(cat.tests || []).map((t) => {
              const idStr = String(t._id);
              return (
                <label key={t._id} className="lab-catalog-picker__row">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(idStr)}
                    onChange={() => toggle(t._id)}
                    disabled={disabled}
                  />
                  <span className="lab-catalog-picker__name">
                    {t.name}
                    {t.normal_range || t.unit ? (
                      <span className="muted" style={{ display: 'block', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                        {t.normal_range ? `Range: ${t.normal_range}` : 'Range: —'}
                        {t.unit ? ` · Unit: ${t.unit}` : ''}
                      </span>
                    ) : null}
                  </span>
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
