/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import { api } from '../api'
import Drawer from '../components/Drawer'

export default function Dashboard() {
    const { selectedProject, projects } = useProject()
    const navigate = useNavigate()
    const [experiments, setExperiments] = useState([])
    const [runs, setRuns] = useState([])
    const [services, setServices] = useState([])
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [drawerRuns, setDrawerRuns] = useState([])
    const [drawerExpName, setDrawerExpName] = useState('')
    const [sortCol, setSortCol] = useState('date')
    const [sortDir, setSortDir] = useState('desc')

    const project = projects.find((p) => p.name === selectedProject)
    const configuredExpNames = (project?.experiments || []).map((e) => e.name)

    useEffect(() => {
        if (!selectedProject) return
        const expNames = (project?.experiments || []).map((e) => e.name)
        api.listExperiments().then((allExps) => {
            if (expNames.length > 0) {
                setExperiments(allExps.filter((e) => expNames.includes(e.name)))
            } else {
                setExperiments(allExps)
            }
        }).catch(() => setExperiments([]))
        api.listServices(selectedProject).then(setServices).catch(() => setServices([]))
    }, [selectedProject, JSON.stringify(project?.experiments)])

    useEffect(() => {
        if (experiments.length === 0) { setRuns([]); return }
        Promise.all(experiments.map((ex) =>
            api.listRuns(ex.name).then((r) => r.map((run) => ({ ...run, experiment: ex.name }))).catch(() => [])
        )).then((all) => setRuns(all.flat()))
    }, [experiments])

    const openRunDrawer = (expName) => {
        setDrawerExpName(expName)
        setDrawerRuns(runs.filter((r) => r.experiment === expName))
        setDrawerOpen(true)
    }

    // Stats
    const totalRuns = runs.length
    const finishedRuns = runs.filter((r) => r.status === 'FINISHED' || r.status === 'finished').length
    const failedRuns = runs.filter((r) => r.status === 'FAILED' || r.status === 'failed').length

    // Collect all metric keys across runs
    const allMetricKeys = useMemo(() => {
        const keys = new Set()
        runs.forEach((r) => Object.keys(r.metrics || {}).forEach((k) => keys.add(k)))
        return [...keys]
    }, [runs])

    // Best run per experiment
    const bestRunsPerExp = useMemo(() => {
        return experiments.map((ex) => {
            const expRuns = runs.filter((r) => r.experiment === ex.name)
            if (expRuns.length === 0) return { experiment: ex.name, bestRun: null, runCount: 0 }
            const bestRun = expRuns.reduce((best, r) => {
                const metricKeys = Object.keys(r.metrics || {})
                if (metricKeys.length === 0) return best
                const mainKey = metricKeys[0]
                const val = r.metrics[mainKey]
                if (!best || val > (best.metrics?.[mainKey] ?? -Infinity)) return r
                return best
            }, null)
            return { experiment: ex.name, bestRun, runCount: expRuns.length }
        }).filter((e) => e.bestRun)
    }, [experiments, runs])

    // Sortable columns
    const sortableColumns = [
        { key: 'date', label: 'Date' },
        { key: 'experiment', label: 'Experiment' },
        { key: 'run', label: 'Run Name' },
        ...allMetricKeys.map((k) => ({ key: `metric:${k}`, label: k })),
    ]

    const sortedBestRuns = useMemo(() => {
        const arr = [...bestRunsPerExp]
        arr.sort((a, b) => {
            let va, vb
            if (sortCol === 'date') {
                va = a.bestRun?.timestamp || 0
                vb = b.bestRun?.timestamp || 0
            } else if (sortCol === 'experiment') {
                va = a.experiment.toLowerCase()
                vb = b.experiment.toLowerCase()
            } else if (sortCol === 'run') {
                va = (a.bestRun?.name || '').toLowerCase()
                vb = (b.bestRun?.name || '').toLowerCase()
            } else if (sortCol.startsWith('metric:')) {
                const mk = sortCol.slice(7)
                va = a.bestRun?.metrics?.[mk] ?? -Infinity
                vb = b.bestRun?.metrics?.[mk] ?? -Infinity
            } else {
                va = 0; vb = 0
            }
            if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
            return sortDir === 'asc' ? va - vb : vb - va
        })
        return arr
    }, [bestRunsPerExp, sortCol, sortDir])

    const toggleSort = (col) => {
        if (sortCol === col) {
            setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortCol(col)
            setSortDir('desc')
        }
    }

    const sortIcon = (col) => sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

    if (!selectedProject) {
        return (
            <div>
                <h2 className="page-title">Dashboard</h2>
                <div className="card"><div className="empty-state">
                    <div className="icon">📁</div>
                    <p>Select a project from the <strong>Projects</strong> page first</p>
                    <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/projects')}>Go to Projects</button>
                </div></div>
            </div>
        )
    }

    const dataSvcCount = services.filter((s) => s.step_type === 'data').length
    const expSvcCount = services.filter((s) => s.step_type === 'experiment').length
    const deploySvcCount = services.filter((s) => s.step_type === 'deployment').length

    return (
        <div>
            <h2 className="page-title">Dashboard</h2>

            {/* ── Project header + stats (compact) ────────────────────────── */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: '1 1 280px' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{project?.name || selectedProject}</div>
                        {project?.description && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{project.description}</div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--highlight)' }}>{experiments.length}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Experiments</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{totalRuns}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Runs</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)' }}>{finishedRuns}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Finished</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: failedRuns > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{failedRuns}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Failed</div>
                        </div>
                        <div style={{ width: '1px', height: '2.5rem', background: 'var(--border)' }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{dataSvcCount}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{expSvcCount}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Experiment</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{deploySvcCount}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deploy</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Best run per experiment ──────────────────────────────────── */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <span className="card-title">🏆 Best Run</span>
                    <span className="badge badge-info">{sortedBestRuns.length}</span>
                </div>
                {sortedBestRuns.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem' }}>
                        <p>No runs yet</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('experiment')}>Experiment{sortIcon('experiment')}</th>
                                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('run')}>Model{sortIcon('run')}</th>
                                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('date')}>Date{sortIcon('date')}</th>
                                    <th>Runs</th>
                                    {allMetricKeys.map((k) => (
                                        <th key={k} style={{ cursor: 'pointer', userSelect: 'none', fontFamily: 'monospace', fontSize: '0.75rem' }}
                                            onClick={() => toggleSort(`metric:${k}`)}>
                                            {k}{sortIcon(`metric:${k}`)}
                                        </th>
                                    ))}
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedBestRuns.map(({ experiment, bestRun, runCount }) => {
                                    const ts = bestRun?.timestamp
                                        ? new Date(bestRun.timestamp * 1000).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                                        : '—'
                                    return (
                                        <tr key={experiment} style={{ cursor: 'pointer' }} onClick={() => openRunDrawer(experiment)}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                title={experiment}>{experiment}</td>
                                            <td style={{ fontSize: '0.85rem' }}>{bestRun?.name || bestRun?.run_id?.slice(0, 8)}</td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ts}</td>
                                            <td><span className="badge badge-info">{runCount}</span></td>
                                            {allMetricKeys.map((k) => (
                                                <td key={k} style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600, color: 'var(--highlight)' }}>
                                                    {bestRun?.metrics?.[k] != null ? Number(bestRun.metrics[k]).toFixed(4) : '—'}
                                                </td>
                                            ))}
                                            <td style={{ textAlign: 'right' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>→</span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── ML Flow related experiments ─────────────────────────────── */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">🔄 ML Flow related experiments</span>
                    <span className="badge badge-info">{experiments.length}</span>
                </div>
                {experiments.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🧪</div>
                        <p>No experiments found</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                            {configuredExpNames.length > 0
                                ? 'Configured experiments have not been run yet'
                                : 'Run an ExperimentService to create experiments'}
                        </p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr><th>Name</th><th>Runs</th><th>Best Metric</th><th></th></tr>
                        </thead>
                        <tbody>
                            {experiments.map((ex) => {
                                const expRuns = runs.filter((r) => r.experiment === ex.name)
                                const runCount = expRuns.length
                                let bestMetric = '—'
                                if (expRuns.length > 0) {
                                    const firstRun = expRuns[0]
                                    const keys = Object.keys(firstRun.metrics || {})
                                    if (keys.length > 0) {
                                        const key = keys[0]
                                        const best = Math.max(...expRuns.map((r) => r.metrics?.[key] ?? -Infinity))
                                        bestMetric = `${key}: ${best.toFixed(4)}`
                                    }
                                }
                                return (
                                    <tr key={ex.name} style={{ cursor: 'pointer' }}
                                        onClick={() => openRunDrawer(ex.name)}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ex.name}</td>
                                        <td><span className="badge badge-info">{runCount} runs</span></td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{bestMetric}</td>
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

            {/* Runs drawer */}
            <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Runs: ${drawerExpName}`} width="560px">
                {drawerRuns.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem' }}>
                        <p>No runs for this experiment</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {drawerRuns.map((r) => (
                            <div key={r.run_id} className="card" style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name || r.run_id?.slice(0, 8)}</span>
                                    <span className={`badge ${r.status === 'FINISHED' || r.status === 'finished' ? 'badge-success' : 'badge-warning'}`}>{r.status}</span>
                                </div>
                                {(r.tags?.['pipelab.dataset_name']) && (
                                    <div style={{ marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dataset</span>
                                        <div style={{ marginTop: '0.15rem' }}>
                                            <span className="badge badge-info" style={{ fontSize: '0.78rem' }}>📊 {r.tags['pipelab.dataset_name']}</span>
                                        </div>
                                    </div>
                                )}
                                {Object.keys(r.metrics || {}).length > 0 && (
                                    <div style={{ marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Metrics</span>
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                            {Object.entries(r.metrics).map(([k, v]) => (
                                                <div key={k} style={{ fontSize: '0.8rem' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>{k}:</span>{' '}
                                                    <span style={{ fontWeight: 600, color: 'var(--highlight)' }}>{typeof v === 'number' ? v.toFixed(4) : v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {Object.keys(r.parameters || {}).length > 0 && (
                                    <div>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parameters</span>
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                            {Object.entries(r.parameters).map(([k, v]) => (
                                                <div key={k} style={{ fontSize: '0.8rem' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>{k}:</span>{' '}
                                                    <span style={{ fontWeight: 500 }}>{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Drawer>
        </div>
    )
}
