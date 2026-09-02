/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import { api } from '../api'
import Drawer from '../components/Drawer'

const SCATTER_VARS = ['--secondary', '--warning', '--chart-3', '--danger', '--chart-5', '--chart-6', '--chart-7', '--chart-8']

function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
}

function ScatterPlot({ pair, width = 260, height = 200 }) {
    const canvasRef = useRef(null)
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !pair) return
        const ctx = canvas.getContext('2d')
        const dpr = window.devicePixelRatio || 1
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)
        canvas.style.width = width + 'px'
        canvas.style.height = height + 'px'
        const pad = { top: 20, right: 10, bottom: 26, left: 34 }
        const pw = width - pad.left - pad.right, ph = height - pad.top - pad.bottom
        ctx.clearRect(0, 0, width, height)
        const colors = SCATTER_VARS.map((v, i) => cssVar(v, ['#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'][i]))
        const xs = pair.x, ys = pair.y, pointColors = pair.color
        const xMin = Math.min(...xs), xMax = Math.max(...xs)
        const yMin = Math.min(...ys), yMax = Math.max(...ys)
        const xRange = xMax - xMin || 1, yRange = yMax - yMin || 1
        ctx.strokeStyle = cssVar('--border', '#e2e8f0'); ctx.lineWidth = 0.5
        for (let i = 0; i <= 4; i++) {
            const gx = pad.left + (pw * i / 4), gy = pad.top + (ph * i / 4)
            ctx.beginPath(); ctx.moveTo(gx, pad.top); ctx.lineTo(gx, pad.top + ph); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(pad.left + pw, gy); ctx.stroke()
        }
        for (let i = 0; i < xs.length; i++) {
            const px = pad.left + ((xs[i] - xMin) / xRange) * pw
            const py = pad.top + ph - ((ys[i] - yMin) / yRange) * ph
            const ci = pointColors ? (pointColors[i] % colors.length) : 0
            ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2)
            ctx.fillStyle = colors[ci]; ctx.globalAlpha = 0.7; ctx.fill()
        }
        ctx.globalAlpha = 1
        ctx.fillStyle = cssVar('--text-muted', '#6b7280'); ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(pair.x_col, pad.left + pw / 2, height - 4)
        ctx.save(); ctx.translate(10, pad.top + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(pair.y_col, 0, 0); ctx.restore()
    }, [pair, width, height])
    return <canvas ref={canvasRef} style={{ borderRadius: '0.5rem', border: '1px solid var(--border)' }} />
}

export default function DataIngestion() {
    const { selectedProject } = useProject()
    const navigate = useNavigate()
    const [services, setServices] = useState([])
    const [datasets, setDatasets] = useState([])

    // Edit metadata drawer state
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editService, setEditService] = useState(null)
    const [editLabel, setEditLabel] = useState('')
    const [editDesc, setEditDesc] = useState('')
    const [saving, setSaving] = useState(false)

    // EDA state
    const [edaService, setEdaService] = useState(null)
    const [eda, setEda] = useState(null)
    const [edaLoading, setEdaLoading] = useState(false)
    const [edaError, setEdaError] = useState('')

    const loadServices = () => {
        if (selectedProject) {
            api.listServices(selectedProject).then((all) =>
                setServices(all.filter((s) => s.step_type === 'data'))
            ).catch(() => setServices([]))
            api.listDatasets().then(setDatasets).catch(() => setDatasets([]))
        }
    }

    useEffect(() => { loadServices() }, [selectedProject])

    const openEdit = (svc, e) => {
        if (e) e.stopPropagation()
        setEditService(svc)
        setEditLabel(svc.label || '')
        setEditDesc(svc.description || svc.docstring || '')
        setDrawerOpen(true)
    }

    const handleSaveMeta = async () => {
        if (!editService || !selectedProject) return
        setSaving(true)
        try {
            await api.updateServiceMeta(selectedProject, editService.class_name, editLabel, editDesc)
            setDrawerOpen(false)
            loadServices()
        } catch (e) { console.error(e) }
        finally { setSaving(false) }
    }

    // EDA: load data from a DatasetService
    const loadEda = async (svc) => {
        setEdaService(svc)
        setEda(null)
        setEdaError('')
        setEdaLoading(true)
        try {
            const data = await api.edaLoadDataset(selectedProject, svc.class_name)
            setEda(data)
        } catch (err) {
            setEdaError(err.message || 'Failed to load dataset')
        } finally {
            setEdaLoading(false)
        }
    }

    if (!selectedProject) {
        return (
            <div>
                <h2 className="page-title">Data Providers</h2>
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
            <h2 className="page-title">Data Providers</h2>
            <p className="page-subtitle">Manage datasets for <strong>{selectedProject}</strong></p>

            {/* Discovered DatasetService classes */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <span className="card-title">Discovered Data Providers</span>
                    <span className="badge badge-info">{services.length}</span>
                </div>
                {services.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📥</div>
                        <p>No DatasetProvider classes found</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                            Create a class extending <code>DatasetProvider</code> in the project's <code>pipeline/</code> directory
                        </p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr><th>Class</th><th>Label</th><th>File</th><th>Description</th><th></th></tr>
                        </thead>
                        <tbody>
                            {services.map((s) => (
                                <tr key={s.class_name} style={{ cursor: 'pointer' }} onClick={() => loadEda(s)}>
                                    <td style={{ fontWeight: 600, color: edaService?.class_name === s.class_name ? 'var(--highlight)' : 'var(--text-primary)' }}>
                                        {s.class_name}
                                    </td>
                                    <td>{s.label || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.module_path}</td>
                                    <td>{s.description || s.docstring || '—'}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                            onClick={(e) => openEdit(s, e)}>✏️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* EDA Loading/Error */}
            {edaLoading && (
                <div className="card" style={{ textAlign: 'center', padding: '2rem', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
                    <p>Loading data from <strong>{edaService?.class_name}</strong>…</p>
                </div>
            )}
            {edaError && (
                <div className="card" style={{ borderLeft: '4px solid var(--danger)', padding: '1rem', marginBottom: '1.5rem' }}>
                    <strong>Error:</strong> {edaError}
                </div>
            )}

            {/* EDA Results */}
            {eda && !edaLoading && (
                <>
                    {/* Stats */}
                    <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
                        <div className="card stat-card">
                            <div className="stat-value">{eda.shape.rows}</div>
                            <div className="stat-label">ROWS</div>
                        </div>
                        <div className="card stat-card">
                            <div className="stat-value">{eda.shape.columns}</div>
                            <div className="stat-label">COLUMNS</div>
                        </div>
                        <div className="card stat-card">
                            <div className="stat-value">{edaService?.class_name}</div>
                            <div className="stat-label">DATA PROVIDER</div>
                        </div>
                    </div>

                    {/* Data Head */}
                    <div className="card" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
                        <div className="card-header"><span className="card-title">Data Head (first 10 rows)</span></div>
                        <table className="data-table" style={{ fontSize: '0.8rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ color: 'var(--text-muted)', width: '2rem' }}>#</th>
                                    {eda.columns.map((col) => <th key={col}>{col}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {eda.head.map((row, i) => (
                                    <tr key={i}>
                                        <td style={{ color: 'var(--text-muted)' }}>{i}</td>
                                        {eda.columns.map((col) => (
                                            <td key={col} style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                {typeof row[col] === 'number' ? row[col].toFixed(4) : String(row[col] ?? '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Columns & Types */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header"><span className="card-title">Columns & Data Types</span></div>
                        <table className="data-table" style={{ fontSize: '0.85rem' }}>
                            <thead><tr><th>Column</th><th>Type</th></tr></thead>
                            <tbody>
                                {Object.entries(eda.dtypes).map(([col, dt]) => (
                                    <tr key={col}>
                                        <td style={{ fontWeight: 600 }}>{col}</td>
                                        <td><span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{dt}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Descriptive Statistics */}
                    <div className="card" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
                        <div className="card-header"><span className="card-title">Descriptive Statistics</span></div>
                        {(() => {
                            const statCols = Object.keys(eda.describe || {})
                            const statRows = statCols.length > 0 ? Object.keys(eda.describe[statCols[0]] || {}) : []
                            return (
                                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                                    <thead><tr><th></th>{statCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                                    <tbody>
                                        {statRows.map((stat) => (
                                            <tr key={stat}>
                                                <td style={{ fontWeight: 600 }}>{stat}</td>
                                                {statCols.map((c) => (
                                                    <td key={c} style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                        {typeof eda.describe[c][stat] === 'number' ? eda.describe[c][stat].toFixed(4) : eda.describe[c][stat]}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        })()}
                    </div>

                    {/* Pairwise Scatter Plots */}
                    {eda.scatter_pairs?.length > 0 && (
                        <div className="card" style={{ marginBottom: '1.5rem' }}>
                            <div className="card-header">
                                <span className="card-title">Pairwise Scatter Plots</span>
                                {eda.scatter_pairs[0].color && (
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.7rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Colored by target</span>
                                        {[...new Set(eda.scatter_pairs[0].color)].slice(0, 6).map((c, i) => (
                                            <span key={c} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: `var(${SCATTER_VARS[i % SCATTER_VARS.length]})` }} />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {eda.scatter_pairs.map((pair, i) => <ScatterPlot key={i} pair={pair} />)}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Edit Service Metadata Drawer */}
            <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Edit: ${editService?.class_name || ''}`} width="420px">
                {editService && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Class Name</span>
                            <div style={{ fontWeight: 600, color: 'var(--highlight)', marginTop: '0.25rem' }}>{editService.class_name}</div>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>File</span>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', marginTop: '0.25rem' }}>{editService.module_path}</div>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Docstring</span>
                            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>{editService.docstring || '—'}</div>
                        </div>
                        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />
                        <div>
                            <label className="form-label">Label</label>
                            <input className="form-input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="e.g. Iris Dataset Loader" />
                        </div>
                        <div>
                            <label className="form-label">Description</label>
                            <textarea className="form-input" rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Describe what this service does..." />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button className="btn btn-primary" onClick={handleSaveMeta} disabled={saving}>
                                {saving ? 'Saving…' : 'Save Metadata'}
                            </button>
                            <button className="btn btn-ghost" onClick={() => setDrawerOpen(false)}>Cancel</button>
                        </div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Metadata is saved to the project's <code>pipelab.yaml</code>
                        </p>
                    </div>
                )}
            </Drawer>
        </div>
    )
}
