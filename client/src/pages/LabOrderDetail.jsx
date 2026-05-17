import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES, LAB_ORDER_STATUS } from '../constants/roles.js';
import { isDisplayableImageUrl } from '../utils/mediaUrl.js';
import { LabQualitativeTestNameSearch } from '../components/LabQualitativeTestNameSearch.jsx';
import './lab-results-entry.css';

const QUALITATIVE_RESULT_OPTIONS = [
  { value: '', label: 'Select result' },
  { value: 'Positive', label: 'Positive' },
  { value: 'Negative', label: 'Negative' },
];

function emptyNumeric() {
  return { type: 'numeric', parameter: '', value: '', unit: '', normal_range: '' };
}

function emptyText() {
  return { type: 'text', test_name: '', result: '' };
}

function emptyImaging() {
  return { type: 'imaging', test_name: '', report: '', image_url: '' };
}

function imagingAttachmentName(url) {
  if (!url) return '';
  const t = String(url).trim();
  const base = t.split('/').pop() || t;
  return base.length > 42 ? `${base.slice(0, 20)}…${base.slice(-16)}` : base;
}

function resultsFromOrder(data) {
  if (data.results?.length) {
    return data.results.map((r) => {
      if (r.type === 'numeric') {
        return { ...r, value: r.value !== undefined && r.value !== null ? String(r.value) : '' };
      }
      if (r.type === 'boolean') {
        return { ...r, value_boolean: r.value_boolean ?? null };
      }
      if (r.type === 'panel') {
        return { ...r, sub_results: Array.isArray(r.panel_values) ? r.panel_values : r.sub_results || [] };
      }
      return { ...r };
    });
  }
  const reqs = data.requested_tests || [];
  if (reqs.length) {
    return reqs.map((line) => {
      const t = line.test;
      if (!t || !t._id) return emptyText();
      const tid = t._id;
      const rt = t.result_type || (t.type === 'numeric' ? 'number' : t.type === 'imaging' ? 'imaging' : 'text');
      if (rt === 'number') {
        return {
          type: 'numeric',
          result_type: 'number',
          test: tid,
          parameter: t.name,
          value: '',
          unit: t.unit || '',
          normal_range: t.normal_range || '',
        };
      }
      if (rt === 'boolean') {
        return { type: 'boolean', result_type: 'boolean', test: tid, test_name: t.name, value_boolean: null };
      }
      if (rt === 'panel') {
        return {
          type: 'panel',
          result_type: 'panel',
          test: tid,
          test_name: t.name,
          sub_results: ((t.child_tests && t.child_tests.length ? t.child_tests : t.panel_subtests) || []).map((s, i) => ({
            test: s._id || null,
            key: s.key || `sub-${i}`,
            name: s.name,
            result_type: s.result_type || 'number',
            value_number: null,
            value_text: '',
            value_boolean: null,
            unit: s.unit || '',
            normal_range: (s.normal_ranges && s.normal_ranges[0] && s.normal_ranges[0].text) || s.normal_range || '',
          })),
        };
      }
      if (rt === 'text') {
        return { type: 'text', test: tid, test_name: t.name, result: '' };
      }
      return { type: 'imaging', test: tid, test_name: t.name, report: '', image_url: '' };
    });
  }
  const legacy = data.test_requests || [];
  if (legacy.length) {
    return legacy.map((name) => ({
      type: 'numeric',
      parameter: String(name).trim(),
      value: '',
      unit: '',
      normal_range: '',
    }));
  }
  return [emptyNumeric()];
}

function entryTitle(order) {
  const rt = order.requested_tests || [];
  if (rt.length) {
    const names = rt.map((l) => l.test?.name).filter(Boolean);
    if (names.length) {
      const head = names.length === 1 ? names[0] : `${names[0]} +${names.length - 1} more`;
      return `${head} – Results Entry`;
    }
  }
  const r = order.test_requests || [];
  if (!r.length) return 'Lab test – Results Entry';
  const head = r.length === 1 ? r[0] : r.join(', ');
  return `${head} – Results Entry`;
}

function requestedSummary(order) {
  const rt = order.requested_tests || [];
  if (rt.length) {
    return rt
      .map((l) => l.test?.name)
      .filter(Boolean)
      .join(', ');
  }
  return (order.test_requests || []).join(', ') || '—';
}

function entryStatusLabel(status) {
  if (status === LAB_ORDER_STATUS.COMPLETED) return 'Delivered';
  if (status === LAB_ORDER_STATUS.IN_PROGRESS) return 'In progress';
  return 'Pending';
}

function LabResultsTable({ results }) {
  if (!results.length) {
    return <p className="muted">No result rows recorded.</p>;
  }
  const numeric = results.filter((r) => r.type === 'numeric');
  const text = results.filter((r) => r.type === 'text');
  const bools = results.filter((r) => r.type === 'boolean');
  const panels = results.filter((r) => r.type === 'panel');
  const imaging = results.filter((r) => r.type === 'imaging');
  const flagPill = (flag) => {
    const f = String(flag || '').toUpperCase();
    if (!f || f === 'NORMAL' || f === 'UNSET') return null;
    const bg = f === 'HIGH' || f === 'LOW' ? 'rgba(220, 38, 38, 0.12)' : 'rgba(245, 158, 11, 0.14)';
    const color = f === 'HIGH' || f === 'LOW' ? '#b91c1c' : '#b45309';
    return (
      <span style={{ marginLeft: '0.45rem', padding: '0.08rem 0.4rem', borderRadius: '999px', background: bg, color, fontSize: '0.72rem', fontWeight: 700 }}>
        {f}
      </span>
    );
  };
  return (
    <div className="lab-results-entry__table-wrap">
      {numeric.length > 0 && (
        <table className="lab-results-entry__table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Value</th>
              <th>Unit</th>
              <th>Normal Range</th>
            </tr>
          </thead>
          <tbody>
            {numeric.map((r, i) => (
              <tr key={`n-${i}`}>
                <td className="lab-results-entry__param">{r.parameter}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem' }}>
                  {r.value}
                  {flagPill(r.flag)}
                </td>
                <td className="lab-results-entry__unit">{r.unit || '—'}</td>
                <td className="lab-results-entry__unit">{r.normal_range || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {text.length > 0 && (
        <>
          <p className="lab-results-entry__section-label" style={{ marginTop: numeric.length ? '1.25rem' : 0 }}>
            Qualitative
          </p>
          <table className="lab-results-entry__table">
            <thead>
              <tr>
                <th>Test name</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {text.map((r, i) => (
                <tr key={`t-${i}`}>
                  <td className="lab-results-entry__param">{r.test_name}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem' }}>
                    {r.result}
                    {flagPill(r.flag)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {bools.length > 0 && (
        <>
          <p className="lab-results-entry__section-label" style={{ marginTop: numeric.length || text.length ? '1.25rem' : 0 }}>
            Boolean
          </p>
          <table className="lab-results-entry__table">
            <thead>
              <tr>
                <th>Test name</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {bools.map((r, i) => (
                <tr key={`b-${i}`}>
                  <td className="lab-results-entry__param">{r.test_name}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem' }}>
                    {r.value_boolean === true ? 'Positive' : r.value_boolean === false ? 'Negative' : '—'}
                    {flagPill(r.flag)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {panels.length > 0 && (
        <>
          <p className="lab-results-entry__section-label" style={{ marginTop: numeric.length || text.length || bools.length ? '1.25rem' : 0 }}>
            Panel tests
          </p>
          {panels.map((p, pi) => (
            <div key={`p-${pi}`} style={{ marginBottom: '0.75rem' }}>
              <p className="muted" style={{ margin: '0 0 0.35rem' }}>
                {p.test_name}
              </p>
              <table className="lab-results-entry__table">
                <thead>
                  <tr>
                    <th>Sub-test</th>
                    <th>Value</th>
                    <th>Unit</th>
                    <th>Normal Range</th>
                  </tr>
                </thead>
                <tbody>
                  {(p.panel_values || p.sub_results || []).map((s, si) => (
                    <tr key={`${pi}-${si}`}>
                      <td className="lab-results-entry__param">{s.name}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem' }}>
                        {s.result_type === 'number'
                          ? s.value_number ?? '—'
                          : s.result_type === 'boolean'
                            ? s.value_boolean === true
                              ? 'Positive'
                              : s.value_boolean === false
                                ? 'Negative'
                                : '—'
                            : s.value_text || '—'}
                        {flagPill(s.flag)}
                      </td>
                      <td className="lab-results-entry__unit">{s.unit || '—'}</td>
                      <td className="lab-results-entry__unit">{s.normal_range || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
      {imaging.length > 0 && (
        <>
          <p
            className="lab-results-entry__section-label"
            style={{ marginTop: numeric.length || text.length ? '1.25rem' : 0 }}
          >
            Imaging
          </p>
          <div className="lab-results-entry__imaging-list">
            {imaging.map((r, i) => (
              <div key={`img-${i}`} className="lab-results-entry__imaging-card">
                <div className="lab-results-entry__imaging-head">
                  <strong>{r.test_name}</strong>
                </div>
                <p className="lab-results-entry__imaging-report" style={{ whiteSpace: 'pre-wrap' }}>
                  {r.report || '—'}
                </p>
                {r.image_url && !isDisplayableImageUrl(r.image_url) ? (
                  <a href={r.image_url} target="_blank" rel="noreferrer" className="lab-results-entry__imaging-link">
                    Open image link
                  </a>
                ) : null}
                {r.image_url && isDisplayableImageUrl(r.image_url) ? (
                  <img className="lab-results-entry__imaging-img" src={String(r.image_url).trim()} alt="" />
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function LabOrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEdit = user.role === ROLES.LAB || user.role === ROLES.ADMIN;

  const [order, setOrder] = useState(null);
  const [results, setResults] = useState([]);
  const [uploadingImagingIdx, setUploadingImagingIdx] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/lab/orders/${id}`);
      if (canEdit && data.status === LAB_ORDER_STATUS.PENDING) {
        const { data: started } = await api.patch(`/lab/orders/${id}/start`);
        setOrder(started);
        setResults(resultsFromOrder(started));
        return;
      }
      setOrder(data);
      setResults(resultsFromOrder(data));
    } catch {
      toast.error('Lab order not found');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const updateRow = (idx, patch) => {
    const next = [...results];
    next[idx] = { ...next[idx], ...patch };
    setResults(next);
  };

  const removeRow = (idx) => {
    setResults(results.filter((_, i) => i !== idx));
  };

  const uploadImagingFile = async (idx, fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    setUploadingImagingIdx(idx);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post('/uploads/lab-imaging', formData, {
        transformRequest: [(data, headers) => {
          delete headers['Content-Type'];
          return data;
        }],
      });
      if (data?.url) {
        updateRow(idx, { image_url: data.url });
        toast.success('Image uploaded');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingImagingIdx(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const normalized = results.map((r) => {
      if (r.type === 'numeric') {
        const raw = String(r.value ?? '').trim();
        const num = raw === '' ? NaN : Number(raw);
        const base = {
          type: 'numeric',
          parameter: (r.parameter || '').trim(),
          value: num,
          unit: (r.unit || '').trim(),
          normal_range: (r.normal_range || '').trim(),
        };
        if (r.test) base.test = r.test;
        return base;
      }
      if (r.type === 'boolean') {
        const base = {
          result_type: 'boolean',
          test_name: (r.test_name || '').trim(),
          value_boolean: r.value_boolean === true ? true : r.value_boolean === false ? false : null,
        };
        if (r.test) base.test = r.test;
        return base;
      }
      if (r.type === 'panel') {
        const base = {
          result_type: 'panel',
          test_name: (r.test_name || '').trim(),
          sub_results: (r.sub_results || []).map((s) => ({
            test: s.test,
            key: s.key,
            name: s.name,
            result_type: s.result_type || 'number',
            value_number:
              s.result_type === 'number'
                ? (() => {
                    const rawNum = String(s.value_number ?? '').trim();
                    if (!rawNum) return null;
                    const n = Number(rawNum);
                    return Number.isNaN(n) ? null : n;
                  })()
                : null,
            value_text: s.result_type === 'text' ? String(s.value_text ?? '') : '',
            value_boolean:
              s.result_type === 'boolean'
                ? s.value_boolean === true || s.value_boolean === false
                  ? s.value_boolean
                  : String(s.value_text || '').toLowerCase() === 'positive'
                : null,
            unit: s.unit || '',
            normal_range: s.normal_range || '',
          })),
        };
        if (r.test) base.test = r.test;
        return base;
      }
      if (r.type === 'imaging') {
        const base = {
          type: 'imaging',
          result_type: 'imaging',
          test_name: (r.test_name || '').trim(),
          report: String(r.report ?? '').trim(),
          image_url: (r.image_url || '').trim(),
        };
        if (r.test) base.test = r.test;
        return base;
      }
      const tb = { result_type: 'text', test_name: (r.test_name || '').trim(), result: r.result ?? '' };
      if (r.test) tb.test = r.test;
      return tb;
    });

    const meaningful = [];
    for (const r of normalized) {
      if (r.type === 'numeric') {
        if (!r.parameter) continue;
        if (Number.isNaN(r.value)) {
          toast.error(`Enter a numeric value for ${r.parameter}`);
          return;
        }
        meaningful.push(r);
      } else if (r.result_type === 'boolean') {
        if (!r.test_name && !r.test) continue;
        if (!(r.value_boolean === true || r.value_boolean === false)) {
          toast.error(`Select boolean result for ${r.test_name || 'test'}`);
          return;
        }
        meaningful.push(r);
      } else if (r.result_type === 'panel') {
        if (!r.test_name && !r.test) continue;
        if (!Array.isArray(r.sub_results) || r.sub_results.length === 0) {
          toast.error('Panel rows need sub-test values');
          return;
        }
        for (const s of r.sub_results) {
          if (s.result_type === 'number' && (s.value_number === null || Number.isNaN(s.value_number))) {
            toast.error(`Enter numeric value for panel sub-test ${s.name}`);
            return;
          }
        }
        meaningful.push(r);
      } else if (r.type === 'imaging') {
        const hasName = Boolean(r.test_name);
        const hasReport = r.report !== undefined && String(r.report).trim() !== '';
        if (!hasName && !hasReport) continue;
        if (!hasName || !hasReport) {
          toast.error('Imaging rows need test name and report text');
          return;
        }
        meaningful.push(r);
      } else {
        const hasName = Boolean(r.test_name);
        const hasResult = r.result !== undefined && String(r.result).trim() !== '';
        if (!hasName && !hasResult) continue;
        if (!hasName || !hasResult) {
          toast.error('Qualitative rows need both test name and result');
          return;
        }
        meaningful.push({
          type: 'text',
          test_name: r.test_name,
          result: String(r.result).trim(),
          ...(r.test ? { test: r.test } : {}),
        });
      }
    }

    if (!meaningful.length) {
      toast.error('Add at least one complete result row');
      return;
    }
    try {
      await api.patch(`/lab/orders/${id}/results`, { results: meaningful });
      toast.success('Results saved — visit updated to LAB COMPLETED');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  if (!order) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const numericIndices = results.map((r, i) => (r.type === 'numeric' ? i : -1)).filter((i) => i >= 0);
  const textRows = results.map((r, i) => (r.type === 'text' ? i : -1)).filter((i) => i >= 0);
  const booleanRows = results.map((r, i) => (r.type === 'boolean' ? i : -1)).filter((i) => i >= 0);
  const panelRows = results.map((r, i) => (r.type === 'panel' ? i : -1)).filter((i) => i >= 0);
  const imagingRows = results.map((r, i) => (r.type === 'imaging' ? i : -1)).filter((i) => i >= 0);

  return (
    <>
      <div className="toolbar no-print">
        <Link to="/lab-requests">← Lab tests</Link>
        <div className="toolbar-spacer" />
        {order.lab_ref_no != null && <span className="muted">Lab ref #{order.lab_ref_no}</span>}
        {order.status === LAB_ORDER_STATUS.COMPLETED && (
          <Link to={`/lab/${id}/report`} className="btn btn-primary">
            Formal lab report
          </Link>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div>
            <div className="muted">Doctor</div>
            <strong>{order.doctor?.fullName}</strong>
          </div>
          <div>
            <div className="muted">Status</div>
            <StatusBadge type="lab" value={order.status} />
          </div>
          {order.visit && <Link to={`/visits/${order.visit._id || order.visit}`}>Open visit</Link>}
        </div>
      </div>

      {canEdit &&
        (order.status === LAB_ORDER_STATUS.PENDING || order.status === LAB_ORDER_STATUS.IN_PROGRESS) && (
        <form className="card lab-results-entry" onSubmit={submit}>
          <div className="lab-results-entry__head">
            <h2 className="lab-results-entry__title">{entryTitle(order)}</h2>
            <span className="lab-results-entry__status-badge">{entryStatusLabel(order.status)}</span>
          </div>
          <p className="lab-results-entry__patient">
            <strong>Patient:</strong> {order.patient?.full_name || '—'}
          </p>
          <p className="lab-results-entry__meta">
            <strong>Requested:</strong> {requestedSummary(order)}
            {order.notes ? (
              <>
                <br />
                <strong>Notes:</strong> {order.notes}
              </>
            ) : null}
          </p>

          <div className="lab-results-entry__table-wrap">
            <table className="lab-results-entry__table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Normal Range</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {numericIndices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted" style={{ padding: '1rem 0' }}>
                      No numeric rows — use “Add parameter” below.
                    </td>
                  </tr>
                ) : (
                  numericIndices.map((idx) => {
                    const row = results[idx];
                    return (
                      <tr key={idx}>
                        <td className="lab-results-entry__param">
                          <input
                            className="lab-results-entry__pill lab-results-entry__pill--wide"
                            value={row.parameter}
                            onChange={(e) => updateRow(idx, { parameter: e.target.value })}
                            placeholder=""
                            aria-label="Parameter"
                          />
                        </td>
                        <td>
                          <input
                            className="lab-results-entry__pill"
                            value={row.value}
                            onChange={(e) => updateRow(idx, { value: e.target.value })}
                            inputMode="decimal"
                            placeholder=""
                            aria-label="Value"
                          />
                        </td>
                        <td>
                          <input
                            className="lab-results-entry__pill lab-results-entry__pill--wide"
                            value={row.unit}
                            onChange={(e) => updateRow(idx, { unit: e.target.value })}
                            placeholder=""
                            aria-label="Unit"
                          />
                        </td>
                        <td>
                          <input
                            className="lab-results-entry__pill lab-results-entry__pill--wide"
                            value={row.normal_range}
                            onChange={(e) => updateRow(idx, { normal_range: e.target.value })}
                            placeholder=""
                            aria-label="Normal range"
                          />
                        </td>
                        <td className="lab-results-entry__actions-cell">
                          <button type="button" className="lab-results-entry__remove" onClick={() => removeRow(idx)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {textRows.length > 0 && (
            <>
              <p className="lab-results-entry__section-label">Qualitative tests</p>
              <div className="lab-results-entry__text-grid">
                {textRows.map((idx) => {
                  const row = results[idx];
                  return (
                    <div key={idx} className="lab-results-entry__text-row">
                      <div className="form-row" style={{ marginBottom: 0 }}>
                        <label>Test name</label>
                        <LabQualitativeTestNameSearch
                          testName={row.test_name}
                          onChange={(patch) => updateRow(idx, patch)}
                        />
                      </div>
                      <div className="form-row" style={{ marginBottom: 0 }}>
                        <label>Result</label>
                        {(() => {
                          const r = String(row.result ?? '').trim();
                          const presetVals = new Set(
                            QUALITATIVE_RESULT_OPTIONS.map((o) => o.value).filter(Boolean)
                          );
                          const selectVal = !r ? '' : presetVals.has(r) ? r : r;
                          return (
                            <select
                              className="select"
                              value={selectVal}
                              onChange={(e) => updateRow(idx, { result: e.target.value })}
                            >
                              {QUALITATIVE_RESULT_OPTIONS.map((o) => (
                                <option key={o.value || 'empty'} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                              {r && !presetVals.has(r) ? (
                                <option value={r}>{r} (saved)</option>
                              ) : null}
                            </select>
                          );
                        })()}
                      </div>
                      <button type="button" className="lab-results-entry__remove" onClick={() => removeRow(idx)}>
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {booleanRows.length > 0 && (
            <>
              <p className="lab-results-entry__section-label">Boolean tests</p>
              <div className="lab-results-entry__text-grid">
                {booleanRows.map((idx) => {
                  const row = results[idx];
                  const boolVal =
                    row.value_boolean === true
                      ? 'positive'
                      : row.value_boolean === false
                        ? 'negative'
                        : '';
                  return (
                    <div key={idx} className="lab-results-entry__text-row">
                      <div className="form-row" style={{ marginBottom: 0 }}>
                        <label>Test name</label>
                        <input
                          className="input"
                          value={row.test_name}
                          onChange={(e) => updateRow(idx, { test_name: e.target.value })}
                        />
                      </div>
                      <div className="form-row" style={{ marginBottom: 0 }}>
                        <label>Result</label>
                        <select
                          className="select"
                          value={boolVal}
                          onChange={(e) =>
                            updateRow(idx, {
                              value_boolean:
                                e.target.value === 'positive'
                                  ? true
                                  : e.target.value === 'negative'
                                    ? false
                                    : null,
                            })
                          }
                        >
                          <option value="">Select result</option>
                          <option value="negative">Negative</option>
                          <option value="positive">Positive</option>
                        </select>
                      </div>
                      <button type="button" className="lab-results-entry__remove" onClick={() => removeRow(idx)}>
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {panelRows.length > 0 && (
            <>
              <p className="lab-results-entry__section-label">Panel tests</p>
              <div className="lab-results-entry__text-grid">
                {panelRows.map((idx) => {
                  const row = results[idx];
                  return (
                    <div key={idx} className="lab-results-entry__text-row lab-results-entry__imaging-edit">
                      <div className="form-row" style={{ marginBottom: 0 }}>
                        <label>Panel name</label>
                        <input
                          className="input"
                          value={row.test_name}
                          onChange={(e) => updateRow(idx, { test_name: e.target.value })}
                        />
                      </div>
                      <div className="lab-results-entry__table-wrap" style={{ marginBottom: 0 }}>
                        <table className="lab-results-entry__table">
                          <thead>
                            <tr>
                              <th>Sub-test</th>
                              <th>Value</th>
                              <th>Unit</th>
                              <th>Normal Range</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(row.sub_results || []).map((s, si) => (
                              <tr key={`${idx}-${s.key || si}`}>
                                <td className="lab-results-entry__param">{s.name}</td>
                                <td>
                                  {s.result_type === 'number' ? (
                                    <input
                                      className="lab-results-entry__pill"
                                      inputMode="decimal"
                                      value={s.value_number ?? ''}
                                      onChange={(e) =>
                                        updateRow(idx, {
                                          sub_results: (row.sub_results || []).map((x, i) =>
                                            i === si ? { ...x, value_number: e.target.value } : x
                                          ),
                                        })
                                      }
                                    />
                                  ) : s.result_type === 'boolean' ? (
                                    <select
                                      className="select"
                                      value={
                                        s.value_boolean === true
                                          ? 'positive'
                                          : s.value_boolean === false
                                            ? 'negative'
                                            : ''
                                      }
                                      onChange={(e) =>
                                        updateRow(idx, {
                                          sub_results: (row.sub_results || []).map((x, i) =>
                                            i === si
                                              ? {
                                                  ...x,
                                                  value_boolean:
                                                    e.target.value === 'positive'
                                                      ? true
                                                      : e.target.value === 'negative'
                                                        ? false
                                                        : null,
                                                }
                                              : x
                                          ),
                                        })
                                      }
                                    >
                                      <option value="">Select result</option>
                                      <option value="negative">Negative</option>
                                      <option value="positive">Positive</option>
                                    </select>
                                  ) : (
                                    <input
                                      className="input"
                                      value={s.value_text ?? ''}
                                      onChange={(e) =>
                                        updateRow(idx, {
                                          sub_results: (row.sub_results || []).map((x, i) =>
                                            i === si ? { ...x, value_text: e.target.value } : x
                                          ),
                                        })
                                      }
                                    />
                                  )}
                                </td>
                                <td>{s.unit || '—'}</td>
                                <td>{s.normal_range || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button type="button" className="lab-results-entry__remove" onClick={() => removeRow(idx)}>
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {imagingRows.length > 0 && (
            <>
              <p className="lab-results-entry__section-label">Imaging</p>
              <div className="lab-results-entry__text-grid">
                {imagingRows.map((idx) => {
                  const row = results[idx];
                  return (
                    <div key={idx} className="lab-results-entry__text-row lab-results-entry__imaging-edit">
                      <div className="form-row" style={{ marginBottom: 0 }}>
                        <label>Study name</label>
                        <input
                          className="input"
                          value={row.test_name}
                          onChange={(e) => updateRow(idx, { test_name: e.target.value })}
                        />
                      </div>
                      <div className="form-row" style={{ marginBottom: 0 }}>
                        <label>Report</label>
                        <textarea
                          className="textarea"
                          rows={4}
                          value={row.report}
                          onChange={(e) => updateRow(idx, { report: e.target.value })}
                        />
                      </div>
                      <div className="form-row lab-results-entry__imaging-upload" style={{ marginBottom: 0 }}>
                        <span className="lab-results-entry__imaging-file-label">Image file</span>
                        <div className="lab-results-entry__file-shell">
                          <input
                            id={`imaging-file-${idx}`}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            className="lab-results-entry__file-input-sr"
                            tabIndex={-1}
                            aria-hidden
                            onChange={(e) => {
                              uploadImagingFile(idx, e.target.files);
                              e.target.value = '';
                            }}
                          />
                          <div className="lab-results-entry__file-bar">
                            <button
                              type="button"
                              className="lab-results-entry__file-pick"
                              disabled={uploadingImagingIdx === idx}
                              onClick={() => document.getElementById(`imaging-file-${idx}`)?.click()}
                            >
                              <span className="lab-results-entry__file-pick-icon" aria-hidden>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="17 8 12 3 7 8" />
                                  <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                              </span>
                              {uploadingImagingIdx === idx ? 'Uploading…' : 'Choose image'}
                            </button>
                            <div className="lab-results-entry__file-meta">
                              {uploadingImagingIdx === idx ? (
                                <span className="lab-results-entry__file-meta-primary">Sending to server…</span>
                              ) : row.image_url && isDisplayableImageUrl(row.image_url) ? (
                                <>
                                  <span
                                    className="lab-results-entry__file-meta-name"
                                    title={imagingAttachmentName(row.image_url)}
                                  >
                                    {imagingAttachmentName(row.image_url)}
                                  </span>
                                  <span className="lab-results-entry__file-meta-badge">Saved</span>
                                </>
                              ) : (
                                <span className="lab-results-entry__file-meta-hint">
                                  No file yet · JPEG, PNG, GIF, WebP · max 12 MB
                                </span>
                              )}
                            </div>
                            {row.image_url ? (
                              <button
                                type="button"
                                className="btn btn-ghost lab-results-entry__clear-img"
                                onClick={() => updateRow(idx, { image_url: '' })}
                              >
                                Remove image
                              </button>
                            ) : null}
                          </div>
                          {row.image_url && isDisplayableImageUrl(row.image_url) ? (
                            <img
                              className="lab-results-entry__imaging-preview"
                              src={String(row.image_url).trim()}
                              alt=""
                            />
                          ) : null}
                        </div>
                      </div>
                      <button type="button" className="lab-results-entry__remove" onClick={() => removeRow(idx)}>
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="lab-results-entry__footer-actions">
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              Enter results for the requested tests only.
            </span>
            <div className="toolbar-spacer" style={{ minWidth: '0.5rem' }} />
            <button type="submit" className="btn btn-primary">
              Save & complete order
            </button>
          </div>
        </form>
      )}

      {order.status === LAB_ORDER_STATUS.COMPLETED && (
        <div className="card lab-results-entry" style={{ marginTop: '1rem' }}>
          <div className="lab-results-entry__head">
            <h2 className="lab-results-entry__title">{entryTitle(order)}</h2>
            <span className={`lab-results-entry__status-badge lab-results-entry__status-badge--done`}>
              {entryStatusLabel(order.status)}
            </span>
          </div>
          <p className="lab-results-entry__patient">
            <strong>Patient:</strong> {order.patient?.full_name || '—'}
          </p>
          <h3 className="lab-results-entry__section-label" style={{ marginTop: 0 }}>
            Recorded results
          </h3>
          <LabResultsTable results={order.results || []} />
        </div>
      )}
    </>
  );
}
