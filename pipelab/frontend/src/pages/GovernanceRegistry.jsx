/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState } from 'react'
import { useProject } from '../context/ProjectContext'
import { api } from '../api'
import Drawer from '../components/Drawer'

export default function GovernanceRegistry() {
    const { selectedProject, projects } = useProject()
    const project = projects.find((p) => p.name === selectedProject)

    const [models, setModels] = useState([])

    // Add-model drawer state
    const [addOpen, setAddOpen] = useState(false)
    const [addName, setAddName] = useState('')
    const [addDesc, setAddDesc] = useState('')
    const [addRunId, setAddRunId] = useState('')
    const [addArtifact, setAddArtifact] = useState('model')
    const [addBusy, setAddBusy] = useState(false)

    // Runs available for selection (from project experiments)
    const [availableRuns, setAvailableRuns] = useState([])
    const [runsLoading, setRunsLoading] = useState(false)

    // Detail drawer state
    const [detailModel, setDetailModel] = useState(null) // full model object
    const [detailVersions, setDetailVersions] = useState([])
    const [detailOpen, setDetailOpen] = useState(false)

    // Add-version inside detail drawer
    const [addVerOpen, setAddVerOpen] = useState(false)
    const [addVerRunId, setAddVerRunId] = useState('')
    const [addVerArtifact, setAddVerArtifact] = useState('model')
    const [addVerBusy, setAddVerBusy] = useState(false)

    const load = () => api.listModels().then(setModels).catch(() => setModels([]))
    useEffect(() => { load() }, [])

    // Load runs from project experiments when add drawer opens
    useEffect(() => {
        if (!addOpen && !addVerOpen) return
        const expNames = (project?.experiments || []).map((e) => e.name)
        if (expNames.length === 0) { setAvailableRuns([]); return }
        setRunsLoading(true)
        Promise.all(expNames.map((name) =>
            api.listRuns(name).then((runs) => runs.map((r) => ({ ...r, experiment: name }))).catch(() => [])
        )).then((all) => {
            setAvailableRuns(all.flat())
            setRunsLoading(false)
        })
    }, [addOpen, addVerOpen, JSON.stringify(project?.experiments)])

    // ── Add model to registry ────────────────────────────────────────
    const handleAdd = async () => {
        if (!addRunId || !addName.trim()) return
        setAddBusy(true)
        try {
            await api.registerModel(addRunId, addName.trim(), addArtifact || 'model')
            setAddOpen(false)
            setAddName('')
            setAddDesc('')
            setAddRunId('')
            setAddArtifact('model')
            await load()
        } catch (e) {
            alert('Failed to register model: ' + e.message)
        }
        setAddBusy(false)
    }

    // ── Open detail drawer ───────────────────────────────────────────
    const openDetail = async (model) => {
        setDetailModel(model)
        setDetailOpen(true)
        setAddVerOpen(false)
        try {
            const vers = await api.getModelVersions(model.name)
            setDetailVersions(vers)
        } catch {
            setDetailVersions([])
        }
    }

    const refreshDetailVersions = async () => {
        if (!detailModel) return
        try {
            const vers = await api.getModelVersions(detailModel.name)
            setDetailVersions(vers)
        } catch { /* */ }
    }

    // ── Stage transition ─────────────────────────────────────────────
    const handleTransition = async (ver, stage) => {
        if (!detailModel) return
        await api.transitionStage(detailModel.name, ver, stage)
        await refreshDetailVersions()
    }

    // ── Add new version to existing model ────────────────────────────
    const handleAddVersion = async () => {
        if (!addVerRunId || !detailModel) return
        setAddVerBusy(true)
        try {
            await api.registerModel(addVerRunId, detailModel.name, addVerArtifact || 'model')
            setAddVerOpen(false)
            setAddVerRunId('')
            setAddVerArtifact('model')
            await refreshDetailVersions()
            await load()
        } catch (e) {
            alert('Failed to add version: ' + e.message)
        }
        setAddVerBusy(false)
    }

    // ── Delete model ─────────────────────────────────────────────────
    const handleDelete = async (modelName) => {
        if (!confirm(`Delete model "${modelName}" and all its versions?`)) return
        try {
            await api.deleteModel(modelName)
            setDetailOpen(false)
            setDetailModel(null)
            await load()
        } catch (e) {
            alert('Failed to delete: ' + e.message)
        }
    }

    // ── Run selector component (shared) ──────────────────────────────
    const RunSelector = ({ value, onChange }) => (
        <div>
            {runsLoading ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading runs…</p>
            ) : availableRuns.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No runs found in project experiments</p>
            ) : (
                <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {availableRuns.map((r) => {
                        const selected = value === r.run_id
                        return (
                            <label key={r.run_id} style={{
                                display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                                padding: '0.5rem 0.75rem', borderRadius: '6px', cursor: 'pointer',
                                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                                background: selected ? 'var(--accent-alpha)' : 'transparent',
                            }}>
                                <input type="radio" checked={selected} onChange={() => onChange(r.run_id)}
                                    style={{ accentColor: 'var(--accent)', marginTop: '0.15rem' }} />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: selected ? 'var(--highlight)' : 'var(--text-primary)' }}>
                                        {r.name || r.run_id?.slice(0, 12)}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {r.experiment} · {r.status}
                                        {r.metrics && Object.keys(r.metrics).length > 0 && (
                                            <> · {Object.entries(r.metrics).slice(0, 3).map(([k, v]) => `${k}: ${Number(v).toFixed(4)}`).join(', ')}</>
                                        )}
                                    </div>
                                </div>
                            </label>
                        )
                    })}
                </div>
            )}
        </div>
    )

    return (
        <div>
            <h2 className="page-title">Model Registry</h2>
            <p className="page-subtitle">Browse registered models, versions, and manage stages</p>

            {/* ── Registered models table ─────────────────────────────── */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">📦 Registered Models</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className="badge badge-info">{models.length}</span>
                        <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => { setAddOpen(true); setAddName(''); setAddDesc(''); setAddRunId('') }}>
                            + Add Model
                        </button>
                    </div>
                </div>
                {models.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📦</div>
                        <p>No registered models</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Click <strong>+ Add Model</strong> to register a model from an experiment run
                        </p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr><th>Name</th><th>Latest Version</th><th>Status</th><th>Description</th><th></th></tr>
                        </thead>
                        <tbody>
                            {models.map((m) => {
                                const latest = (m.latest_versions || []).sort((a, b) => Number(b.version) - Number(a.version))[0]
                                return (
                                    <tr key={m.name} style={{ cursor: 'pointer' }} onClick={() => openDetail(m)}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</td>
                                        <td>{latest ? `v${latest.version}` : '—'}</td>
                                        <td>
                                            {latest ? (
                                                <span className={`badge ${latest.status === 'production' ? 'badge-success' : latest.status === 'archived' ? 'badge-danger' : 'badge-info'}`}>
                                                    {latest.status}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {m.description || '—'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>→</span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Add Model Drawer ────────────────────────────────────── */}
            <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="Register New Model" width="520px">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label className="form-label">Model Name *</label>
                        <input className="form-input" placeholder="e.g. iris-classifier"
                            value={addName} onChange={(e) => setAddName(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">Description</label>
                        <textarea className="form-input" rows={2} placeholder="Optional description"
                            value={addDesc} onChange={(e) => setAddDesc(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">Artifact Path</label>
                        <input className="form-input" placeholder="model"
                            value={addArtifact} onChange={(e) => setAddArtifact(e.target.value)} />
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            The artifact path under the run (default: "model")
                        </p>
                    </div>
                    <div>
                        <label className="form-label">Select a Run *</label>
                        <RunSelector value={addRunId} onChange={setAddRunId} />
                    </div>
                    <button className="btn btn-primary" disabled={addBusy || !addName.trim() || !addRunId}
                        onClick={handleAdd} style={{ marginTop: '0.5rem' }}>
                        {addBusy ? '⏳ Registering…' : '📦 Register as Version 1'}
                    </button>
                </div>
            </Drawer>

            {/* ── Detail Drawer ───────────────────────────────────────── */}
            <Drawer open={detailOpen} onClose={() => { setDetailOpen(false); setAddVerOpen(false) }}
                title={detailModel?.name || 'Model Details'} width="580px">
                {detailModel && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Model info */}
                        <div className="card" style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{detailModel.name}</div>
                                    {detailModel.description && (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{detailModel.description}</div>
                                    )}
                                </div>
                                <button className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                    onClick={() => handleDelete(detailModel.name)}>
                                    🗑 Delete
                                </button>
                            </div>
                            {detailModel.tags && Object.keys(detailModel.tags).length > 0 && (
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                    {Object.entries(detailModel.tags).map(([k, v]) => (
                                        <span key={k} className="badge badge-info" style={{ fontSize: '0.7rem' }}>{k}={v}</span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Version history */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                Version History ({detailVersions.length})
                            </span>
                            <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                onClick={() => setAddVerOpen(!addVerOpen)}>
                                {addVerOpen ? '✕ Cancel' : '+ New Version'}
                            </button>
                        </div>

                        {/* Add version form (inline) */}
                        {addVerOpen && (
                            <div className="card" style={{ padding: '1rem', border: '1px solid var(--accent)' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--highlight)' }}>
                                    Add New Version
                                </div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label className="form-label">Artifact Path</label>
                                    <input className="form-input" placeholder="model"
                                        value={addVerArtifact} onChange={(e) => setAddVerArtifact(e.target.value)} />
                                </div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label className="form-label">Select a Run</label>
                                    <RunSelector value={addVerRunId} onChange={setAddVerRunId} />
                                </div>
                                <button className="btn btn-primary" disabled={addVerBusy || !addVerRunId}
                                    onClick={handleAddVersion} style={{ width: '100%' }}>
                                    {addVerBusy ? '⏳ Adding…' : '+ Add Version'}
                                </button>
                            </div>
                        )}

                        {/* Version list */}
                        {detailVersions.length === 0 ? (
                            <div className="empty-state" style={{ padding: '1.5rem' }}>
                                <p>No versions found</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {detailVersions
                                    .sort((a, b) => Number(b.version) - Number(a.version))
                                    .map((v) => (
                                        <div key={v.version} className="card" style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>v{v.version}</span>
                                                    <span className={`badge ${v.status === 'production' ? 'badge-success' : v.status === 'archived' ? 'badge-danger' : 'badge-info'}`}>
                                                        {v.status}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                    {v.status !== 'production' && (
                                                        <button className="btn btn-primary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}
                                                            onClick={() => handleTransition(v.version, 'production')}>→ Prod</button>
                                                    )}
                                                    {v.status !== 'archived' && (
                                                        <button className="btn btn-ghost" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}
                                                            onClick={() => handleTransition(v.version, 'archived')}>Archive</button>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)' }}>Run ID: </span>
                                                    <code style={{ fontSize: '0.75rem' }}>{v.run_id?.slice(0, 12) || '—'}</code>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)' }}>Created: </span>
                                                    {v.created_at ? new Date(v.created_at * 1000).toLocaleString() : '—'}
                                                </div>
                                                {v.source && (
                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>Source: </span>
                                                        <span title={v.source}>{v.source}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {v.description && (
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{v.description}</div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}
            </Drawer>
        </div>
    )
}
