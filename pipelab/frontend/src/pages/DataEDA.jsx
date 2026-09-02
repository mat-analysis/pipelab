/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import { api } from '../api'

// Color palette for scatter points by target class (CSS variable names)
const SCATTER_VARS = ['--secondary', '--warning', '--chart-3', '--danger', '--chart-5', '--chart-6', '--chart-7', '--chart-8']

function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
}

function ScatterPlot({ pair, width = 280, height = 220 }) {
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

        const pad = { top: 24, right: 12, bottom: 28, left: 36 }
        const pw = width - pad.left - pad.right
        const ph = height - pad.top - pad.bottom

        // Resolve theme colors for canvas (canvas doesn't support var())
        const colors = SCATTER_VARS.map((v, i) => cssVar(v, ['#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'][i]))

        ctx.clearRect(0, 0, width, height)

        // Background
        ctx.fillStyle = cssVar('--bg-card', '#fff')
        ctx.fillRect(0, 0, width, height)

        const xs = pair.x, ys = pair.y, pointColors = pair.color
        const xMin = Math.min(...xs), xMax = Math.max(...xs)
        const yMin = Math.min(...ys), yMax = Math.max(...ys)
        const xRange = xMax - xMin || 1, yRange = yMax - yMin || 1

        // Grid lines
        ctx.strokeStyle = cssVar('--border', '#e2e8f0')
        ctx.lineWidth = 0.5
        for (let i = 0; i <= 4; i++) {
            const gx = pad.left + (pw * i / 4)
            const gy = pad.top + (ph * i / 4)
            ctx.beginPath(); ctx.moveTo(gx, pad.top); ctx.lineTo(gx, pad.top + ph); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(pad.left + pw, gy); ctx.stroke()
        }

        // Points
        for (let i = 0; i < xs.length; i++) {
            const px = pad.left + ((xs[i] - xMin) / xRange) * pw
            const py = pad.top + ph - ((ys[i] - yMin) / yRange) * ph
            const ci = pointColors ? (pointColors[i] % colors.length) : 0
            ctx.beginPath()
            ctx.arc(px, py, 2.5, 0, Math.PI * 2)
            ctx.fillStyle = colors[ci]
            ctx.globalAlpha = 0.7
            ctx.fill()
        }
        ctx.globalAlpha = 1

        // Axis labels
        ctx.fillStyle = cssVar('--text-muted', '#6b7280')
        ctx.font = '10px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(pair.x_col, pad.left + pw / 2, height - 4)
        ctx.save()
        ctx.translate(10, pad.top + ph / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(pair.y_col, 0, 0)
        ctx.restore()
    }, [pair, width, height])

    return <canvas ref={canvasRef} style={{ borderRadius: '0.5rem', border: '1px solid var(--border)' }} />
}

export default function DataEDA() {
    const { selectedProject } = useProject()
    const navigate = useNavigate()
    const [configs, setConfigs] = useState([])
    const [selectedIdx, setSelectedIdx] = useState(null)
    const [eda, setEda] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (selectedProject) {
            api.listDatasetConfigs(selectedProject).then(setConfigs).catch(() => setConfigs([]))
        }
    }, [selectedProject])

    const loadEda = useCallback(async (idx) => {
        setSelectedIdx(idx)
        setEda(null)
        setError('')
        setLoading(true)
        try {
            const cfg = configs[idx]
            const data = await api.edaLoadDataset(selectedProject, cfg.data_service)
            setEda(data)
        } catch (err) {
            setError(err.message || 'Failed to load dataset')
        } finally {
            setLoading(false)
        }
    }, [configs, selectedProject])

    const selectedCfg = selectedIdx !== null ? configs[selectedIdx] : null

    if (!selectedProject) {
        return (
            <div>
                <h2 className="page-title">Exploratory Data Analysis</h2>
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
            <h2 className="page-title">Exploratory Data Analysis</h2>
            <p className="page-subtitle">Explore datasets for <strong>{selectedProject}</strong></p>

            {/* Dataset Configs */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <span className="card-title">Dataset Configurations</span>
                    <span className="badge badge-info">{configs.length}</span>
                </div>
                {configs.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📋</div>
                        <p>No dataset configurations</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Create one in the Data Preparation page first</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {configs.map((c, i) => (
                            <div key={i} className="card" style={{
                                padding: '0.75rem 1rem', minWidth: '200px', cursor: 'pointer',
                                border: selectedIdx === i ? '2px solid var(--accent)' : '2px solid transparent',
                                transition: 'border-color 0.2s',
                            }}
                                onClick={() => loadEda(i)}>
                                <div style={{ fontWeight: 700, color: selectedIdx === i ? 'var(--highlight)' : 'var(--text-primary)' }}>{c.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{c.data_service}</div>
                                <div style={{ marginTop: '0.25rem' }}>
                                    <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{c.preparation_method}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Loading / Error */}
            {loading && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
                    <p>Loading dataset from <strong>{selectedCfg?.data_service}</strong>…</p>
                </div>
            )}
            {error && (
                <div className="card" style={{ borderLeft: '4px solid var(--danger)', padding: '1rem' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {/* EDA Results */}
            {eda && !loading && (
                <>
                    {/* Shape & Info */}
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
                            <div className="stat-value">{eda.scatter_pairs?.length || 0}</div>
                            <div className="stat-label">SCATTER PAIRS</div>
                        </div>
                        <div className="card stat-card">
                            <div className="stat-value">{selectedCfg?.preparation_method}</div>
                            <div className="stat-label">PREP METHOD</div>
                        </div>
                    </div>

                    {/* Data Head */}
                    <div className="card" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
                        <div className="card-header">
                            <span className="card-title">Data Head (first 10 rows)</span>
                        </div>
                        <table className="data-table" style={{ fontSize: '0.8rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ color: 'var(--text-muted)', width: '2rem' }}>#</th>
                                    {eda.columns.map((col) => (
                                        <th key={col}>{col}</th>
                                    ))}
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

                    {/* Column Types */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header">
                            <span className="card-title">Columns & Data Types</span>
                        </div>
                        <table className="data-table" style={{ fontSize: '0.85rem' }}>
                            <thead><tr><th>Column</th><th>Type</th></tr></thead>
                            <tbody>
                                {Object.entries(eda.dtypes).map(([col, dt]) => (
                                    <tr key={col}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{col}</td>
                                        <td><span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{dt}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Descriptive Statistics */}
                    <div className="card" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
                        <div className="card-header">
                            <span className="card-title">Descriptive Statistics</span>
                        </div>
                        {(() => {
                            const statCols = Object.keys(eda.describe || {})
                            const statRows = statCols.length > 0 ? Object.keys(eda.describe[statCols[0]] || {}) : []
                            return (
                                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr>
                                            <th></th>
                                            {statCols.map((c) => <th key={c}>{c}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {statRows.map((stat) => (
                                            <tr key={stat}>
                                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stat}</td>
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
                    {eda.scatter_pairs && eda.scatter_pairs.length > 0 && (
                        <div className="card" style={{ marginBottom: '1.5rem' }}>
                            <div className="card-header">
                                <span className="card-title">Pairwise Scatter Plots</span>
                                {eda.scatter_pairs[0].color && (
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.7rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Colored by target</span>
                                        {[...new Set(eda.scatter_pairs[0].color)].slice(0, 6).map((c, i) => (
                                            <span key={c} style={{
                                                display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                                                background: `var(${SCATTER_VARS[i % SCATTER_VARS.length]})`, verticalAlign: 'middle',
                                            }} />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {eda.scatter_pairs.map((pair, i) => (
                                    <ScatterPlot key={i} pair={pair} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
