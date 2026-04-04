import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import api from '../api/client.js';

/**
 * Searchable list of catalog tests with type "text" (qualitative).
 */
export function LabQualitativeTestNameSearch({ testName, onChange, disabled = false }) {
  const wrapRef = useRef(null);
  const testNameRef = useRef(testName);
  const [catalog, setCatalog] = useState(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    testNameRef.current = testName;
  }, [testName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/lab/catalog');
        if (!cancelled) setCatalog(data.categories || []);
      } catch {
        if (!cancelled) setCatalog([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const textTests = useMemo(() => {
    if (!catalog?.length) return [];
    const out = [];
    for (const cat of catalog) {
      for (const t of cat.tests || []) {
        if (t.type === 'text') {
          out.push({
            _id: t._id,
            name: t.name,
            categoryName: cat.name,
          });
        }
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = (testName || '').trim().toLowerCase();
    if (!q) return textTests.slice(0, 60);
    return textTests.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 60);
  }, [textTests, testName]);

  useEffect(() => {
    const onDocDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const pick = (t) => {
    onChange({ test: String(t._id), test_name: t.name });
    setOpen(false);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      const v = String(testNameRef.current || '').trim();
      if (!v) {
        onChange({ test: undefined, test_name: '' });
        return;
      }
      const exact = textTests.find((t) => t.name.toLowerCase() === v.toLowerCase());
      if (exact) {
        onChange({ test: String(exact._id), test_name: exact.name });
      } else {
        onChange({ test: undefined, test_name: v });
      }
    }, 120);
  };

  return (
    <div ref={wrapRef} className="lab-q-search">
      <input
        className="input"
        value={testName ?? ''}
        disabled={disabled || !catalog}
        placeholder={catalog ? 'Search test name…' : 'Loading catalog…'}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ test_name: v, test: undefined });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && filtered.length > 0 ? (
        <ul className="lab-q-search__list" role="listbox">
          {filtered.map((t) => (
            <li key={t._id}>
              <button
                type="button"
                className="lab-q-search__option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(t)}
              >
                <span className="lab-q-search__option-name">{t.name}</span>
                <span className="lab-q-search__option-cat muted">{t.categoryName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
