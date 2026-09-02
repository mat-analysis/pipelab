/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import { api } from '../api'
import Drawer from '../components/Drawer'

export default function ExperimentTrain() {
    const { selectedProject } = useProject()
    const navigate = useNavigate()
    const [services, setServices] = useState([])
    const [allExperiments, setAllExperiments] = useState([])
    const [expRunsMap, setExpRunsMap] = useState({})

    // Edit drawer
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editSvc, setEditSvc] = useState(null)
    const [editLabel, setEditLabel] = useState('')
    const [editDesc, setEditDesc] = useState('')
    const [editExps, setEditExps] = useState([])
    const [saving, setSaving] = useState(false)

    // Experiment detail view
    const [selectedExpName, setSelectedExpName] = useState(null)
    const [expRuns, setExpRuns] = useState([])
    const [expLoading, setExpLoading] = useState(false)

    // Run detail drawer
    const [runDrawerOpen, setRunDrawerOpen] = useState(false)
    const [selectedRun, setSelectedRun] = useState(null)
    const [runArtifacts, setRunArtifacts] = useState([])
    const [artifactsLoading, setArtifactsLoading] = useState(false)

    // Model detail drawer
    const [modelDrawerOpen, setModelDrawerOpen] = useState(false)
    const [selectedModelName, setSelectedModelName] = useState(null)
    const [modelVersions, setModelVersions] = useState([])
    const [modelsLoading, setModelsLoading] = useState(false)

    // Register-to-registry state (inside run drawer)
    const [regOpen, setRegOpen] = useState(false)
    const [regModels, setRegModels] = useState([])
    const [regMode, setRegMode] = useState('new') // 'new' | 'existing'
    const [regName, setRegName] = useState('')
    const [regExisting, setRegExisting] = useState('')
    const [regArtifact, setRegArtifact] = useState('model')
    const [regBusy, setRegBusy] = useState(false)
    const [regSuccess, setRegSuccess] = useState('')

    const loadData = () => {
        if (!selectedProject) return
        api.listServices(selectedProject).then((all) =>
            setServices(all.filter((s) => s.step_type === 'experiment'))
        ).catch(() => setServices([]))
        api.listExperiments().then(setAllExperiments).catch(() => setAllExperiments([]))
    }

    useEffect(() => { loadData() }, [selectedProject])

    // Load runs for all associated experiments
    useEffect(() => {
        const allAssoc = new Set()
        services.forEach((s) => (s.experiments || []).forEach((e) => allAssoc.add(e)))
        if (allAssoc.size === 0) { setExpRunsMap({}); return }
        Promise.all(
            [...allAssoc].map((expName) =>
                api.listRuns(expName).then((runs) => [expName, runs]).catch(() => [expName, []])
            )
        ).then((pairs) => {
            const map = {}
            pairs.forEach(([name, runs]) => { map[name] = runs })
            setExpRunsMap(map)
        })
    }, [services])

    const openEdit = (svc) => {
        setEditSvc(svc)
        setEditLabel(svc.label || '')
        setEditDesc(svc.description || svc.docstring || '')
        setEditExps(svc.experiments || [])
        setDrawerOpen(true)
    }

    const toggleExp = (expName) => {
        setEditExps((prev) => prev.includes(expName) ? prev.filter((n) => n !== expName) : [...prev, expName])
    }

    const handleSave = async () => {
        if (!editSvc || !selectedProject) return
        setSaving(true)
        try {
            await api.updateServiceMeta(selectedProject, editSvc.class_name, editLabel, editDesc, editExps)
            setDrawerOpen(false)
            loadData()
        } catch (e) { console.error(e) }
        finally { setSaving(false) }
    }

    // Find best run
    const findBestRun = (runs) => {
        if (!runs || runs.length === 0) return null
        let best = null, bestMetric = -Infinity
        for (const r of runs) {
            const val = Object.values(r.metrics || {})[0]
            if (val !== undefined && val > bestMetric) { best = r; bestMetric = val }
        }
        return best
    }

    // Click on experiment to show details
    const selectExperiment = useCallback(async (expName) => {
        setSelectedExpName(expName)
        setExpLoading(true)
        setExpRuns([])
        try {
            const runs = await api.listRuns(expName)
            setExpRuns(runs)
        } catch (e) { console.error(e) }
        finally { setExpLoading(false) }
    }, [])

    // Open run detail drawer with artifacts
    const openRunDrawer = useCallback(async (run) => {
        setSelectedRun(run)
        setRunArtifacts([])
        setRunDrawerOpen(true)
        setArtifactsLoading(true)
        setRegOpen(false)
        setRegSuccess('')
        try {
            const arts = await api.getRunArtifacts(run.run_id)
            setRunArtifacts(arts || [])
        } catch (e) { console.error(e); setRunArtifacts([]) }
        finally { setArtifactsLoading(false) }
    }, [])

    // Open model versions drawer
    const openModelDrawer = useCallback(async (modelName) => {
        setSelectedModelName(modelName)
        setModelVersions([])
        setModelDrawerOpen(true)
        setModelsLoading(true)
        try {
            const vs = await api.getModelVersions(modelName)
            setModelVersions(vs || [])
        } catch (e) { console.error(e); setModelVersions([]) }
        finally { setModelsLoading(false) }
    }, [])

    // Derive unique models from run artifacts
    const getModelsFromRuns = (runs) => {
        const models = new Set()
        for (const r of runs) {
            if (r.model_uri) {
                const parts = r.model_uri.split('/')
                const name = parts[parts.length - 1] || 'model'
                models.add(name)
            }
            (r.tags || {})['mlflow.runName'] && models.add(r.tags['mlflow.runName'])
        }
        return [...models]
    }

    const bestRunForExp = selectedExpName ? findBestRun(expRuns) : null

    if (!selectedProject) {
        return (
            <div>
                <h2 className="page-title">Model Providers</h2>
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
            <h2 className="page-title">Model Providers</h2>
            <p className="page-subtitle">Manage model providers for <strong>{selectedProject} experiments</strong></p>

            {/* Discovered ExperimentService classes */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <span className="card-title">Experiment Providers</span>
                    <span className="badge badge-info">{services.length}</span>
                </div>
                {services.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🧪</div>
                        <p>No ExperimentProvider classes found</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                            Create a class extending <code>ExperimentProvider</code> in <code>pipeline/</code>
                        </p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr><th>Class</th><th>Label</th><th>File</th><th>Experiments</th><th></th></tr>
                        </thead>
                        <tbody>
                            {services.map((s) => (
                                <tr key={s.class_name} style={{ cursor: 'pointer' }} onClick={() => openEdit(s)}>
                                    <td style={{ fontWeight: 600, color: 'var(--highlight)' }}>{s.class_name}</td>
                                    <td>{s.label || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.module_path}</td>
                                    <td>
                                        {(s.experiments || []).length > 0 ? (
                                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                                {s.experiments.map((e) => (
                                                    <span key={e} className="badge badge-success" style={{ fontSize: '0.65rem' }}>{e}</span>
                                                ))}
                                            </div>
                                        ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                            onClick={(e) => { e.stopPropagation(); openEdit(s) }}>✏️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* MLflow Experiments grouped by service */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <span className="card-title">ML Flow Experiments</span>
                </div>
                {services.every((s) => (s.experiments || []).length === 0) ? (
                    <div className="empty-state">
                        <div className="icon">🔬</div>
                        <p>No experiments associated yet</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Click an Experiment Provider above and assign MLflow experiments</p>
                    </div>
                ) : (
                    <div>
                        {services.filter((s) => (s.experiments || []).length > 0).map((svc) => (
                            <div key={svc.class_name} style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--highlight)' }}>{svc.class_name}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{svc.label}</span>
                                </div>
                                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                                    <thead><tr><th>Experiment</th><th>Runs</th><th>Best Run</th><th>Best Metric</th></tr></thead>
                                    <tbody>
                                        {svc.experiments.map((expName) => {
                                            const runs = expRunsMap[expName] || []
                                            const best = findBestRun(runs)
                                            const bestMetricEntry = best ? Object.entries(best.metrics || {})[0] : null
                                            return (
                                                <tr key={expName}
                                                    style={{ cursor: 'pointer', background: selectedExpName === expName ? 'var(--accent-alpha)' : undefined }}
                                                    onClick={() => selectExperiment(expName)}>
                                                    <td style={{ fontWeight: 600, color: selectedExpName === expName ? 'var(--highlight)' : 'var(--text-primary)' }}>{expName}</td>
                                                    <td><span className="badge badge-info">{runs.length}</span></td>
                                                    <td>{best ? (best.name || best.run_id.slice(0, 8)) : '—'}</td>
                                                    <td>
                                                        {bestMetricEntry ? (
                                                            <span style={{ fontFamily: 'monospace' }}>
                                                                {bestMetricEntry[0]}={typeof bestMetricEntry[1] === 'number' ? bestMetricEntry[1].toFixed(4) : bestMetricEntry[1]}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Experiment Detail Panel */}
            {selectedExpName && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-header">
                        <span className="card-title">📊 {selectedExpName}</span>
                        <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => { setSelectedExpName(null); setExpRuns([]) }}>✕ Close</button>
                    </div>

                    {expLoading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>⏳ Loading runs…</div>
                    ) : (
                        <>
                            {/* Stats row */}
                            <div className="card-grid" style={{ marginBottom: '1rem' }}>
                                <div className="card stat-card" style={{ boxShadow: 'none', border: '1px solid var(--border)' }}>
                                    <div className="stat-value">{expRuns.length}</div>
                                    <div className="stat-label">TOTAL RUNS</div>
                                </div>
                                <div className="card stat-card" style={{ boxShadow: 'none', border: '1px solid var(--border)' }}>
                                    <div className="stat-value">{expRuns.filter(r => r.status === 'finished').length}</div>
                                    <div className="stat-label">FINISHED</div>
                                </div>
                                {bestRunForExp && Object.entries(bestRunForExp.metrics || {}).map(([k, v]) => (
                                    <div key={k} className="card stat-card" style={{ boxShadow: 'none', border: '1px solid var(--border)' }}>
                                        <div className="stat-value" style={{ color: 'var(--highlight)' }}>{typeof v === 'number' ? v.toFixed(4) : v}</div>
                                        <div className="stat-label">BEST {k.toUpperCase()}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Runs table */}
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th>Run</th>
                                            <th>Dataset</th>
                                            <th>Status</th>
                                            <th>Metrics</th>
                                            <th>Parameters</th>
                                            <th>Model</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {expRuns.map((r) => {
                                            const isBest = bestRunForExp && r.run_id === bestRunForExp.run_id
                                            return (
                                                <tr key={r.run_id}
                                                    style={{
                                                        cursor: 'pointer',
                                                        background: isBest ? 'var(--accent-alpha)' : undefined,
                                                    }}
                                                    onClick={() => openRunDrawer(r)}>
                                                    <td style={{ width: '1.5rem', textAlign: 'center' }}>
                                                        {isBest && <span title="Best run" style={{ fontSize: '1rem' }}>🏆</span>}
                                                    </td>
                                                    <td style={{ fontWeight: 600, color: isBest ? 'var(--highlight)' : 'var(--text-primary)' }}>
                                                        {r.name || r.run_id.slice(0, 8)}
                                                    </td>
                                                    <td>
                                                        {r.tags?.['pipelab.dataset_name'] ? (
                                                            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>📊 {r.tags['pipelab.dataset_name']}</span>
                                                        ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>—</span>}
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${r.status === 'finished' ? 'badge-success' : 'badge-warning'}`}>{r.status}</span>
                                                    </td>
                                                    <td>
                                                        <code style={{ fontSize: '0.7rem' }}>
                                                            {Object.entries(r.metrics || {}).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(4) : v}`).join(', ')}
                                                        </code>
                                                    </td>
                                                    <td>
                                                        <code style={{ fontSize: '0.7rem' }}>
                                                            {Object.entries(r.parameters || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
                                                        </code>
                                                    </td>
                                                    <td>
                                                        {r.model_uri ? (
                                                            <span className="badge badge-info" style={{ fontSize: '0.6rem', cursor: 'pointer' }}
                                                                onClick={(e) => { e.stopPropagation(); openModelDrawer(r.model_uri.split('/').pop() || 'model') }}>
                                                                📦 {r.model_uri.split('/').pop()}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Edit Service Metadata Drawer */}
            <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Edit: ${editSvc?.class_name || ''}`} width="480px">
                {editSvc && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Class Name</span>
                            <div style={{ fontWeight: 600, color: 'var(--highlight)', marginTop: '0.25rem' }}>{editSvc.class_name}</div>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>File</span>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', marginTop: '0.25rem' }}>{editSvc.module_path}</div>
                        </div>
                        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />
                        <div>
                            <label className="form-label">Label</label>
                            <input className="form-input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="e.g. RF 5-Fold CV" />
                        </div>
                        <div>
                            <label className="form-label">Description</label>
                            <textarea className="form-input" rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Describe what this service does..." />
                        </div>
                        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />
                        <div>
                            <label className="form-label">Associated MLflow Experiments</label>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Select which experiments this provider produces</p>
                            {allExperiments.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No MLflow experiments found</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
                                    {allExperiments.map((exp) => (
                                        <label key={exp.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.35rem 0.5rem', borderRadius: '0.25rem', background: editExps.includes(exp.name) ? 'var(--accent-alpha)' : 'transparent' }}>
                                            <input type="checkbox" checked={editExps.includes(exp.name)} onChange={() => toggleExp(exp.name)} />
                                            <span style={{ fontWeight: editExps.includes(exp.name) ? 600 : 400 }}>{exp.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                            <button className="btn btn-ghost" onClick={() => setDrawerOpen(false)}>Cancel</button>
                        </div>
                    </div>
                )}
            </Drawer>

            {/* Run Detail Drawer */}
            <Drawer open={runDrawerOpen} onClose={() => setRunDrawerOpen(false)} title={`Run: ${selectedRun?.name || selectedRun?.run_id?.slice(0, 8) || ''}`} width="520px">
                {selectedRun && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Run ID</span>
                                <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', marginTop: '0.25rem', wordBreak: 'break-all' }}>{selectedRun.run_id}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</span>
                                <div style={{ marginTop: '0.25rem' }}>
                                    <span className={`badge ${selectedRun.status === 'finished' ? 'badge-success' : 'badge-warning'}`}>{selectedRun.status}</span>
                                    {bestRunForExp && selectedRun.run_id === bestRunForExp.run_id && <span style={{ marginLeft: '0.5rem' }}>🏆 Best</span>}
                                </div>
                            </div>
                        </div>

                        {/* Dataset */}
                        {selectedRun.tags?.['pipelab.dataset_name'] && (
                            <div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dataset</span>
                                <div style={{ marginTop: '0.25rem' }}>
                                    <span className="badge badge-info" style={{ fontSize: '0.85rem' }}>📊 {selectedRun.tags['pipelab.dataset_name']}</span>
                                </div>
                            </div>
                        )}

                        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />

                        {/* Metrics */}
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Metrics</span>
                            <div style={{ marginTop: '0.25rem' }}>
                                {Object.entries(selectedRun.metrics || {}).map(([k, v]) => (
                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ fontWeight: 600 }}>{k}</span>
                                        <span style={{ fontFamily: 'monospace', color: 'var(--highlight)' }}>{typeof v === 'number' ? v.toFixed(6) : v}</span>
                                    </div>
                                ))}
                                {Object.keys(selectedRun.metrics || {}).length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No metrics</p>}
                            </div>
                        </div>

                        {/* Parameters */}
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parameters</span>
                            <div style={{ marginTop: '0.25rem' }}>
                                {Object.entries(selectedRun.parameters || {}).map(([k, v]) => (
                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ fontWeight: 600 }}>{k}</span>
                                        <span style={{ fontFamily: 'monospace' }}>{v}</span>
                                    </div>
                                ))}
                                {Object.keys(selectedRun.parameters || {}).length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No parameters</p>}
                            </div>
                        </div>

                        {/* Tags */}
                        {Object.keys(selectedRun.tags || {}).length > 0 && (
                            <div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tags</span>
                                <div style={{ marginTop: '0.25rem' }}>
                                    {Object.entries(selectedRun.tags).map(([k, v]) => (
                                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', fontSize: '0.8rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Model URI */}
                        {selectedRun.model_uri && (
                            <div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Model</span>
                                <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{selectedRun.model_uri}</span>
                                    <button className="btn btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                        onClick={() => openModelDrawer('model')}>View Versions</button>
                                </div>
                            </div>
                        )}

                        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />

                        {/* Register to Model Registry */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Model Registry</span>
                                <button className="btn btn-primary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                                    onClick={async () => {
                                        setRegOpen(!regOpen)
                                        setRegSuccess('')
                                        if (!regOpen) {
                                            try { const m = await api.listModels(); setRegModels(m) } catch { setRegModels([]) }
                                        }
                                    }}>
                                    {regOpen ? '✕ Cancel' : '📦 Register to Registry'}
                                </button>
                            </div>
                            {regSuccess && (
                                <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--accent-muted)', borderRadius: '6px', border: '1px solid var(--accent-muted)', fontSize: '0.8rem', color: 'var(--highlight)' }}>
                                    {regSuccess}
                                </div>
                            )}
                            {regOpen && (
                                <div className="card" style={{ marginTop: '0.5rem', padding: '0.75rem', border: '1px solid var(--accent)' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                        <button className={`btn ${regMode === 'new' ? 'btn-primary' : 'btn-ghost'}`}
                                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                                            onClick={() => setRegMode('new')}>New Entry</button>
                                        <button className={`btn ${regMode === 'existing' ? 'btn-primary' : 'btn-ghost'}`}
                                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                                            onClick={() => setRegMode('existing')}>Existing Entry</button>
                                    </div>
                                    {regMode === 'new' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <div>
                                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Model Name *</label>
                                                <input className="form-input" placeholder="e.g. iris-classifier"
                                                    value={regName} onChange={(e) => setRegName(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Artifact Path</label>
                                                <input className="form-input" placeholder="model"
                                                    value={regArtifact} onChange={(e) => setRegArtifact(e.target.value)} />
                                            </div>
                                            <button className="btn btn-primary" disabled={regBusy || !regName.trim()}
                                                style={{ fontSize: '0.8rem' }}
                                                onClick={async () => {
                                                    setRegBusy(true)
                                                    try {
                                                        const res = await api.registerModel(selectedRun.run_id, regName.trim(), regArtifact || 'model')
                                                        setRegSuccess(`Registered "${regName.trim()}" v${res.version}`)
                                                        setRegOpen(false)
                                                        setRegName('')
                                                    } catch (e) { alert('Failed: ' + e.message) }
                                                    setRegBusy(false)
                                                }}>
                                                {regBusy ? '⏳ Registering…' : '📦 Register as Version 1'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {regModels.length === 0 ? (
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No existing models in the registry</p>
                                            ) : (
                                                <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    {regModels.map((m) => {
                                                        const sel = regExisting === m.name
                                                        const latest = (m.latest_versions || []).sort((a, b) => Number(b.version) - Number(a.version))[0]
                                                        return (
                                                            <label key={m.name} style={{
                                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                                padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer',
                                                                border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                                                                background: sel ? 'var(--accent-alpha)' : 'transparent',
                                                            }}>
                                                                <input type="radio" checked={sel} onChange={() => setRegExisting(m.name)}
                                                                    style={{ accentColor: 'var(--accent)' }} />
                                                                <div>
                                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: sel ? 'var(--highlight)' : 'var(--text-primary)' }}>{m.name}</div>
                                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                                        {latest ? `Latest: v${latest.version} (${latest.status})` : 'No versions'}
                                                                    </div>
                                                                </div>
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                            <div>
                                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Artifact Path</label>
                                                <input className="form-input" placeholder="model"
                                                    value={regArtifact} onChange={(e) => setRegArtifact(e.target.value)} />
                                            </div>
                                            <button className="btn btn-primary" disabled={regBusy || !regExisting}
                                                style={{ fontSize: '0.8rem' }}
                                                onClick={async () => {
                                                    setRegBusy(true)
                                                    try {
                                                        const res = await api.registerModel(selectedRun.run_id, regExisting, regArtifact || 'model')
                                                        setRegSuccess(`Added v${res.version} to "${regExisting}"`)
                                                        setRegOpen(false)
                                                        setRegExisting('')
                                                    } catch (e) { alert('Failed: ' + e.message) }
                                                    setRegBusy(false)
                                                }}>
                                                {regBusy ? '⏳ Adding…' : `+ Add as New Version`}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />

                        {/* Artifacts */}
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Artifacts</span>
                            {artifactsLoading ? (
                                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>⏳ Loading artifacts…</p>
                            ) : runArtifacts.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>No artifacts found</p>
                            ) : (
                                <div style={{ marginTop: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                                    {runArtifacts.map((art, i) => (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            padding: '0.4rem 0.75rem', borderBottom: i < runArtifacts.length - 1 ? '1px solid var(--border)' : 'none',
                                            fontSize: '0.8rem',
                                        }}>
                                            <span style={{ fontSize: '1rem' }}>
                                                {(art.path || art.name || '').match(/\.(png|jpg|jpeg|gif|svg)$/i) ? '🖼️' :
                                                 (art.path || art.name || '').match(/\.(csv|tsv)$/i) ? '📊' :
                                                 (art.path || art.name || '').match(/\.(pkl|pth|h5|model)$/i) ? '📦' :
                                                 (art.path || art.name || '').match(/\.(json|yaml|yml|txt|log)$/i) ? '📄' : '📁'}
                                            </span>
                                            <span style={{ fontFamily: 'monospace', flex: 1 }}>{art.path || art.name || JSON.stringify(art)}</span>
                                            {art.file_size != null && (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                                    {art.file_size > 1024 * 1024 ? `${(art.file_size / 1024 / 1024).toFixed(1)} MB` :
                                                     art.file_size > 1024 ? `${(art.file_size / 1024).toFixed(1)} KB` :
                                                     `${art.file_size} B`}
                                                </span>
                                            )}
                                            {art.is_dir && <span className="badge badge-info" style={{ fontSize: '0.6rem' }}>DIR</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Drawer>

            {/* Model Details Drawer */}
            <Drawer open={modelDrawerOpen} onClose={() => setModelDrawerOpen(false)} title={`Model: ${selectedModelName || ''}`} width="480px">
                {modelsLoading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>⏳ Loading versions…</div>
                ) : modelVersions.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📦</div>
                        <p>No registered versions for this model</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Register models from the Governance pages</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {modelVersions.map((v, i) => (
                            <div key={i} className="card" style={{ padding: '0.75rem', boxShadow: 'none', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: 700 }}>Version {v.version}</span>
                                    <span className={`badge ${v.status === 'production' ? 'badge-success' : v.status === 'approved' ? 'badge-info' : 'badge-warning'}`}>
                                        {v.status}
                                    </span>
                                </div>
                                {v.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{v.description}</p>}
                                <div style={{ fontSize: '0.75rem' }}>
                                    {v.run_id && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Run ID</span>
                                            <span style={{ fontFamily: 'monospace' }}>{v.run_id.slice(0, 12)}…</span>
                                        </div>
                                    )}
                                    {v.source && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Source</span>
                                            <span style={{ fontFamily: 'monospace', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.source}</span>
                                        </div>
                                    )}
                                    {v.created_at && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Created</span>
                                            <span>{new Date(v.created_at).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Drawer>
        </div>
    )
}
