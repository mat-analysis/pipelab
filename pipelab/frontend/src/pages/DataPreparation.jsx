/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import { api } from '../api'
import Drawer from '../components/Drawer'

// Parameter definitions for built-in preparation methods
const PREP_METHOD_PARAMS = {
    TrainTestSplit: [
        { key: 'test_size', label: 'Test Size', type: 'number', default: 0.2, hint: 'Fraction of data for testing (0–1)' },
        { key: 'random_state', label: 'Random State', type: 'number', default: 42, hint: 'Seed for reproducibility' },
    ],
    KFoldCV: [
        { key: 'n_splits', label: 'Number of Folds', type: 'number', default: 5, hint: 'Number of cross-validation folds' },
        { key: 'shuffle', label: 'Shuffle', type: 'checkbox', default: true, hint: 'Shuffle data before splitting' },
        { key: 'random_state', label: 'Random State', type: 'number', default: 42, hint: 'Seed for reproducibility' },
    ],
}

export default function DataPreparation() {
    const { selectedProject } = useProject()
    const navigate = useNavigate()
    const [dataServices, setDataServices] = useState([])
    const [prepServices, setPrepServices] = useState([])
    const [configs, setConfigs] = useState([])

    // Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [form, setForm] = useState({ name: '', description: '', dataService: '', prepMethod: 'TrainTestSplit' })
    const [prepParams, setPrepParams] = useState({})
    const [saving, setSaving] = useState(false)

    const builtInMethods = [
        { class_name: 'TrainTestSplit', label: 'Train / Test Split', description: 'Split into training and test sets.', source: 'built-in' },
        { class_name: 'KFoldCV', label: 'K-Fold Cross-Validation', description: 'Generate K-Fold indices for cross-validation.', source: 'built-in' },
    ]

    const loadData = () => {
        if (!selectedProject) return
        api.listServices(selectedProject).then((all) => {
            setDataServices(all.filter((s) => s.step_type === 'data'))
            setPrepServices(all.filter((s) => s.step_type === 'preparation'))
        }).catch(() => { setDataServices([]); setPrepServices([]) })
        api.listDatasetConfigs(selectedProject).then(setConfigs).catch(() => setConfigs([]))
    }

    useEffect(() => { loadData() }, [selectedProject])

    const allPrepMethods = [
        ...builtInMethods,
        ...prepServices.map((s) => ({ ...s, source: 'custom' })),
    ]

    // Set default params when prep method changes
    const setMethodAndParams = (methodName) => {
        setForm((f) => ({ ...f, prepMethod: methodName }))
        const defs = PREP_METHOD_PARAMS[methodName]
        if (defs) {
            const p = {}
            defs.forEach((d) => { p[d.key] = d.default })
            setPrepParams(p)
        } else {
            setPrepParams({})
        }
    }

    const openCreateDrawer = (svc) => {
        setForm({ name: '', description: '', dataService: svc.class_name, prepMethod: 'TrainTestSplit' })
        // Init default params
        const p = {}
        PREP_METHOD_PARAMS['TrainTestSplit'].forEach((d) => { p[d.key] = d.default })
        setPrepParams(p)
        setDrawerOpen(true)
    }

    const handleCreate = async () => {
        if (!form.name || !form.dataService || !selectedProject) return
        setSaving(true)
        try {
            await api.createDatasetConfig(selectedProject, form.name, form.description, form.dataService, form.prepMethod, prepParams)
            setDrawerOpen(false)
            loadData()
        } catch (err) {
            alert('Error: ' + (err.message || 'Failed to save'))
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (index) => {
        if (!selectedProject || !confirm('Delete this dataset configuration?')) return
        await api.deleteDatasetConfig(selectedProject, index)
        loadData()
    }

    // Render parameter fields for current prep method
    const paramFields = PREP_METHOD_PARAMS[form.prepMethod] || []

    if (!selectedProject) {
        return (
            <div>
                <h2 className="page-title">Data Preparation</h2>
                <div className="card"><div className="empty-state">
                    <div className="icon">📁</div>
                    <p>Select a project from the <strong>Projects</strong> page first</p>
                    <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/projects')}>Go to Projects</button>
                </div></div>
            </div>
        )
    }

    return (
        <div>
            <h2 className="page-title">Data Preparation</h2>
            <p className="page-subtitle">Configure datasets for <strong>{selectedProject}</strong></p>

            {/* Select a Data Service to start */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <span className="card-title">Select a Data Service</span>
                    <span className="badge badge-info">{dataServices.length}</span>
                </div>
                {dataServices.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🔧</div>
                        <p>No DatasetService found in <code>pipeline/</code></p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {dataServices.map((s) => (
                            <div key={s.class_name} className="card" style={{
                                padding: '1rem', minWidth: '220px', flex: '1', cursor: 'pointer',
                                border: '2px solid transparent', transition: 'border-color 0.2s',
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                                onClick={() => openCreateDrawer(s)}>
                                <div style={{ fontWeight: 700, color: 'var(--highlight)', fontSize: '1rem' }}>{s.class_name}</div>
                                {s.label && <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}>{s.label}</div>}
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{s.description || s.docstring || '—'}</div>
                                <div style={{ marginTop: '0.75rem' }}>
                                    <span className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}>＋ Create Configuration</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Existing Dataset Configurations */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <span className="card-title">Dataset Configurations</span>
                    <span className="badge badge-info">{configs.length}</span>
                </div>
                {configs.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📋</div>
                        <p>No dataset configurations yet</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Click a Data Service above to create one</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead><tr><th>Name</th><th>Data Service</th><th>Preparation</th><th>Parameters</th><th></th></tr></thead>
                        <tbody>
                            {configs.map((c, i) => (
                                <tr key={i}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                                        {c.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.description}</div>}
                                    </td>
                                    <td><span style={{ fontWeight: 600, color: 'var(--highlight)' }}>{c.data_service}</span></td>
                                    <td><span className="badge badge-info">{c.preparation_method}</span></td>
                                    <td>
                                        {Object.entries(c.preparation_params || {}).map(([k, v]) => (
                                            <div key={k} style={{ fontSize: '0.75rem' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>{k}:</span> {String(v)}
                                            </div>
                                        ))}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: '#e55' }}
                                            onClick={() => handleDelete(i)}>🗑</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Preparation Methods Reference */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">Available Preparation Methods</span>
                    <span className="badge badge-info">{allPrepMethods.length}</span>
                </div>
                <table className="data-table">
                    <thead><tr><th>Method</th><th>Description</th><th>Source</th></tr></thead>
                    <tbody>
                        {allPrepMethods.map((m) => (
                            <tr key={m.class_name}>
                                <td style={{ fontWeight: 600, color: 'var(--highlight)' }}>{m.label || m.class_name}</td>
                                <td style={{ fontSize: '0.85rem' }}>{m.description || m.docstring || '—'}</td>
                                <td>
                                    <span className={`badge ${m.source === 'built-in' ? 'badge-success' : 'badge-warning'}`}>{m.source}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Dataset Config Drawer */}
            <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="New Dataset Configuration" width="480px">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Data Service (read-only) */}
                    <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Data Service</span>
                        <div style={{ fontWeight: 700, color: 'var(--highlight)', fontSize: '1.05rem', marginTop: '0.25rem' }}>{form.dataService}</div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />

                    <div>
                        <label className="form-label">Configuration Name</label>
                        <input className="form-input" value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. iris-80-20-split" />
                    </div>
                    <div>
                        <label className="form-label">Description</label>
                        <input className="form-input" value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            placeholder="Optional description" />
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />

                    {/* Preparation Method Selection */}
                    <div>
                        <label className="form-label">Preparation Method</label>
                        <select className="form-input" value={form.prepMethod} onChange={(e) => setMethodAndParams(e.target.value)}>
                            {allPrepMethods.map((m) => (
                                <option key={m.class_name} value={m.class_name}>
                                    {m.label || m.class_name} ({m.source})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Dynamic Parameters for selected method */}
                    {paramFields.length > 0 && (
                        <div style={{ background: 'var(--bg-card, #f8f9fa)', padding: '1rem', borderRadius: '0.5rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem' }}>
                                Parameters — {form.prepMethod}
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {paramFields.map((pf) => (
                                    <div key={pf.key}>
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>{pf.label}</label>
                                        {pf.type === 'checkbox' ? (
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={!!prepParams[pf.key]}
                                                    onChange={(e) => setPrepParams({ ...prepParams, [pf.key]: e.target.checked })} />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prepParams[pf.key] ? 'Yes' : 'No'}</span>
                                            </label>
                                        ) : (
                                            <input className="form-input" type="number" step="any"
                                                value={prepParams[pf.key] ?? pf.default}
                                                onChange={(e) => setPrepParams({ ...prepParams, [pf.key]: parseFloat(e.target.value) || 0 })} />
                                        )}
                                        {pf.hint && <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{pf.hint}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom method: raw JSON fallback */}
                    {paramFields.length === 0 && form.prepMethod !== 'TrainTestSplit' && form.prepMethod !== 'KFoldCV' && (
                        <div>
                            <label className="form-label">Parameters (JSON)</label>
                            <textarea className="form-input" rows={3}
                                value={JSON.stringify(prepParams, null, 2)}
                                onChange={(e) => {
                                    try { setPrepParams(JSON.parse(e.target.value)) } catch {}
                                }}
                                placeholder='{"key": "value"}' />
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                Parameters for the custom preparation method
                            </p>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !form.name}>
                            {saving ? 'Saving…' : 'Create Configuration'}
                        </button>
                        <button className="btn btn-ghost" onClick={() => setDrawerOpen(false)}>Cancel</button>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Saved to <code>pipelab.yaml</code>
                    </p>
                </div>
            </Drawer>
        </div>
    )
}
