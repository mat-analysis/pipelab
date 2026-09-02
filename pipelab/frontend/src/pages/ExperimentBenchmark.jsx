/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import { api } from '../api'
import Drawer from '../components/Drawer'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Legend, RadarChart, PolarGrid, PolarAngleAxis,
    PolarRadiusAxis, Radar, LineChart, Line, Cell,
} from 'recharts'

/* ── Theme colours ─────────────────────────────────────────────────────────── */
function useThemeColors() {
    const [c, setC] = useState({})
    useEffect(() => {
        const u = () => {
            const s = getComputedStyle(document.documentElement)
            const get = (name, fallback) => s.getPropertyValue(name).trim() || fallback
            setC({
                grid: get('--chart-grid', 'rgba(148,163,184,.18)'),
                text: get('--chart-text', '#64748b'),
                tooltipBg: get('--tooltip-bg', '#fff'),
                tooltipBorder: get('--tooltip-border', '#e2e8f0'),
                textPrimary: get('--text-primary', '#0f172a'),
                textSecondary: get('--text-secondary', '#475569'),
                palette: PALETTE_VARS.map((v, i) => get(v, PALETTE_FALLBACKS[i])),
            })
        }
        u()
        const obs = new MutationObserver(u)
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
        return () => obs.disconnect()
    }, [])
    return c
}

const PALETTE_VARS = [
    '--secondary', '--accent', '--warning', '--danger', '--chart-5',
    '--chart-6', '--chart-8', '--chart-3', '--chart-7', '--chart-5',
    '--chart-6', '--chart-3',
]
const PALETTE_FALLBACKS = [
    '#EE72F8', '#31EC56', '#f59e0b', '#EF036C', '#a78bfa',
    '#06b6d4', '#ec4899', '#10b981', '#f97316', '#8b5cf6',
    '#0ea5e9', '#84cc16',
]

/* ── Helpers ───────────────────────────────────────────────────────────────── */
const fmt = (v, d = 4) => (v != null ? Number(v).toFixed(d) : '—')

/* ── Main ──────────────────────────────────────────────────────────────────── */
export default function ExperimentBenchmark() {
    const { selectedProject } = useProject()
    const navigate = useNavigate()
    const tc = useThemeColors()

    // ── Experiment list ──────────────────────────────────────────────────
    const [projectExperiments, setProjectExperiments] = useState([])   // names from YAML
    const [selectedExps, setSelectedExps] = useState([])               // checked experiments
    const [loadingExps, setLoadingExps] = useState(false)

    // ── Benchmark results ────────────────────────────────────────────────
    const [models, setModels] = useState([])
    const [benchLoading, setBenchLoading] = useState(false)

    // ── Model selection for charts ───────────────────────────────────────
    const [checkedModels, setCheckedModels] = useState([])

    // ── Chart mode ───────────────────────────────────────────────────────
    const [chartMode, setChartMode] = useState('bar')

    // ── Drawer ───────────────────────────────────────────────────────────
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [drawerModel, setDrawerModel] = useState(null)
    const [drawerArtifacts, setDrawerArtifacts] = useState([])
    const [artsLoading, setArtsLoading] = useState(false)

    /* ── Load experiments associated to project ───────────────────────── */
    useEffect(() => {
        if (!selectedProject) return
        setLoadingExps(true)
        api.listServices(selectedProject).then((all) => {
            const names = new Set()
            all.filter(s => s.step_type === 'experiment')
               .forEach(s => (s.experiments || []).forEach(e => names.add(e)))
            setProjectExperiments([...names].sort())
        }).catch(() => setProjectExperiments([]))
          .finally(() => setLoadingExps(false))
        setSelectedExps([]); setModels([]); setCheckedModels([])
    }, [selectedProject])

    /* ── Toggle experiment checkbox ────────────────────────────────────── */
    const toggleExp = (name) =>
        setSelectedExps(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])

    /* ── Load benchmark for selected experiments ──────────────────────── */
    const loadBenchmark = useCallback(async () => {
        if (selectedExps.length === 0) return
        setBenchLoading(true)
        setModels([]); setCheckedModels([])
        try {
            const data = await api.benchmarkModels(selectedExps)
            setModels(data)
            setCheckedModels(data.map(m => m.model_name))
        } catch (e) { console.error(e); setModels([]) }
        finally { setBenchLoading(false) }
    }, [selectedExps])

    /* ── Model chart toggle ───────────────────────────────────────────── */
    const toggleModelCheck = (name) =>
        setCheckedModels(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])

    /* ── Filtered models for charts ───────────────────────────────────── */
    const chartModels = useMemo(
        () => models.filter(m => checkedModels.includes(m.model_name)),
        [models, checkedModels]
    )

    /* ── Metric / param keys ──────────────────────────────────────────── */
    const metricKeys = useMemo(() => {
        const ks = new Set()
        chartModels.forEach(m => Object.keys(m.metrics || {}).forEach(k => ks.add(k)))
        return [...ks].sort()
    }, [chartModels])

    const paramKeys = useMemo(() => {
        const ks = new Set()
        chartModels.forEach(m => Object.keys(m.parameters || {}).forEach(k => ks.add(k)))
        return [...ks].sort()
    }, [chartModels])

    /* ── Chart data ───────────────────────────────────────────────────── */
    const barData = useMemo(() =>
        metricKeys.map(metric => {
            const e = { metric }
            chartModels.forEach(m => { e[m.model_name] = m.metrics[metric]?.mean ?? 0 })
            return e
        }), [metricKeys, chartModels])

    const radarData = useMemo(() => {
        const maxV = {}
        metricKeys.forEach(k => {
            let mx = 0
            chartModels.forEach(m => { const v = m.metrics[k]?.mean || 0; if (v > mx) mx = v })
            maxV[k] = mx || 1
        })
        return metricKeys.map(metric => {
            const e = { metric }
            chartModels.forEach(m => { e[m.model_name] = (m.metrics[metric]?.mean || 0) / maxV[metric] })
            return e
        })
    }, [metricKeys, chartModels])

    const kfoldData = useMemo(() => {
        if (chartModels.length === 0 || metricKeys.length === 0) return { data: [], metric: '' }
        const mk = metricKeys[0]
        let maxF = 0
        chartModels.forEach(m => { const v = m.metrics[mk]?.values || []; if (v.length > maxF) maxF = v.length })
        const data = []
        for (let i = 0; i < maxF; i++) {
            const e = { fold: `Fold ${i + 1}` }
            chartModels.forEach(m => { e[m.model_name] = (m.metrics[mk]?.values || [])[i] ?? null })
            data.push(e)
        }
        return { data, metric: mk }
    }, [metricKeys, chartModels])

    /* ── Open drawer ──────────────────────────────────────────────────── */
    const openDetail = useCallback(async (model) => {
        setDrawerModel(model); setDrawerOpen(true); setDrawerArtifacts([])
        if (model.run_ids?.length) {
            setArtsLoading(true)
            try { const a = await api.getRunArtifacts(model.run_ids[0]); setDrawerArtifacts(a || []) }
            catch { setDrawerArtifacts([]) }
            finally { setArtsLoading(false) }
        }
    }, [])

    /* ── Render ────────────────────────────────────────────────────────── */
    if (!selectedProject) {
        return (
            <div>
                <h2 className="page-title">Benchmark</h2>
                <div className="card"><div className="empty-state">
                    <div className="icon">📁</div>
                    <p>Select a project from the <strong>Projects</strong> page first</p>
                    <button className="btn btn-primary" style={{ marginTop: '1rem' }}
                        onClick={() => navigate('/projects')}>Go to Projects</button>
                </div></div>
            </div>
        )
    }

    return (
        <div>
            <h2 className="page-title">Benchmark</h2>
            <p className="page-subtitle">Compare models across experiments in <strong>{selectedProject}</strong></p>

            {/* ═══════════════════════════════════════════════════════════════
                EXPERIMENT SELECTION TABLE  (Data-Ingestion style)
               ═══════════════════════════════════════════════════════════════ */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <span className="card-title">MLflow Experiments</span>
                    <span className="badge badge-info">{projectExperiments.length}</span>
                </div>

                {loadingExps ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>⏳</span>
                        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
                    </div>
                ) : projectExperiments.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🔬</div>
                        <p>No experiments associated with this project</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                            Assign MLflow experiments via the <strong>Experiment Train</strong> page
                        </p>
                    </div>
                ) : (
                    <>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '2rem' }}></th>
                                    <th>Experiment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectExperiments.map(name => {
                                    const checked = selectedExps.includes(name)
                                    return (
                                        <tr key={name} style={{ cursor: 'pointer' }} onClick={() => toggleExp(name)}>
                                            <td>
                                                <input type="checkbox" checked={checked} readOnly
                                                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                                            </td>
                                            <td style={{
                                                fontWeight: checked ? 700 : 400,
                                                color: checked ? 'var(--highlight)' : 'var(--text-primary)',
                                            }}>
                                                {name}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        <div style={{ padding: '0.75rem 0 0.25rem', display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary" disabled={selectedExps.length === 0 || benchLoading}
                                onClick={loadBenchmark}>
                                {benchLoading ? '⏳ Loading…' : '🔬 Load Benchmark'}
                            </button>
                            {selectedExps.length > 0 && (
                                <button className="btn btn-ghost" onClick={() => {
                                    setSelectedExps([]); setModels([]); setCheckedModels([])
                                }}>Clear Selection</button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                BENCHMARK RESULTS
               ═══════════════════════════════════════════════════════════════ */}
            {benchLoading && (
                <div className="card" style={{ textAlign: 'center', padding: '2rem', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
                    <p>Loading benchmark data…</p>
                </div>
            )}

            {!benchLoading && models.length > 0 && (
                <>
                    {/* ── Summary Stats ───────────────────────────────────── 
                    <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
                        <div className="card stat-card">
                            <div className="stat-value">{models.length}</div>
                            <div className="stat-label">MODELS</div>
                        </div>
                        <div className="card stat-card">
                            <div className="stat-value">{models.reduce((s, m) => s + m.run_count, 0)}</div>
                            <div className="stat-label">TOTAL RUNS</div>
                        </div>
                        <div className="card stat-card">
                            <div className="stat-value">{metricKeys.length}</div>
                            <div className="stat-label">METRICS</div>
                        </div>
                        <div className="card stat-card">
                            <div className="stat-value">{selectedExps.length}</div>
                            <div className="stat-label">EXPERIMENTS</div>
                        </div>
                    </div> */}
                    {/* ── Project header + stats (compact) ────────────────────────── */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ flex: '1 1 280px' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Experiment Comparison</div>
                            </div>
                            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--highlight)' }}>{models.length}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>MODELS</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{models.reduce((s, m) => s + m.run_count, 0)}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL RUNS</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metricKeys.length}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>METRICS</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedExps.length}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EXPERIMENTS</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Model Statistics Table ──────────────────────────── */}
                    <div className="card" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
                        <div className="card-header">
                            <span className="card-title">Model Statistics</span>
                        </div>
                        <table className="data-table" style={{ fontSize: '0.82rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '2rem' }}></th>
                                    <th>Model</th>
                                    <th>Experiment</th>
                                    <th style={{ textAlign: 'center' }}>Runs</th>
                                    {metricKeys.map(k => (
                                        <th key={k} style={{ textAlign: 'center' }}>{k}</th>
                                    ))}
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {models.map((m, idx) => {
                                    const color = (tc.palette || PALETTE_FALLBACKS)[idx % (tc.palette || PALETTE_FALLBACKS).length]
                                    const checked = checkedModels.includes(m.model_name)
                                    const isKfold = m.run_count > 1

                                    // Find best per metric
                                    const bests = {}
                                    metricKeys.forEach(k => {
                                        let best = -Infinity
                                        models.forEach(om => {
                                            const v = om.metrics[k]?.mean
                                            if (v != null && v > best) best = v
                                        })
                                        bests[k] = best
                                    })

                                    return (
                                        <tr key={m.model_name}
                                            style={{ borderLeft: `3px solid ${color}` }}>
                                            <td>
                                                <input type="checkbox" checked={checked}
                                                    onChange={() => toggleModelCheck(m.model_name)}
                                                    style={{ accentColor: color, cursor: 'pointer' }} />
                                            </td>
                                            <td style={{ fontWeight: 700, color }}>{m.model_name}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.experiment_name}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="badge badge-info">{m.run_count}</span>
                                                {isKfold && (
                                                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: '0.3rem' }}>
                                                        k-fold
                                                    </span>
                                                )}
                                            </td>
                                            {metricKeys.map(k => {
                                                const ms = m.metrics[k]
                                                if (!ms) return <td key={k} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                                                const isBest = ms.mean === bests[k]
                                                return (
                                                    <td key={k} style={{
                                                        textAlign: 'center', fontFamily: 'monospace',
                                                        background: isBest ? 'var(--accent-alpha)' : undefined,
                                                    }}>
                                                        <span style={{
                                                            fontWeight: isBest ? 700 : 400,
                                                            color: isBest ? 'var(--highlight)' : 'var(--text-primary)',
                                                        }}>
                                                            {fmt(ms.mean)}
                                                        </span>
                                                        {isKfold && (
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: '0.2rem' }}>
                                                                ±{fmt(ms.std)}
                                                            </span>
                                                        )}
                                                        {isBest && <span style={{ marginLeft: '0.2rem' }}>🏆</span>}
                                                    </td>
                                                )
                                            })}
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="btn btn-ghost"
                                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                                    onClick={() => openDetail(m)}>
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Parameters Table ──────────────────────────────── */}
                    {paramKeys.length > 0 && (
                        <div className="card" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
                            <div className="card-header">
                                <span className="card-title">Parameters</span>
                            </div>
                            <table className="data-table" style={{ fontSize: '0.82rem' }}>
                                <thead>
                                    <tr>
                                        <th>Parameter</th>
                                        {chartModels.map((m, i) => (
                                            <th key={m.model_name} style={{ textAlign: 'center', color: (tc.palette || PALETTE_FALLBACKS)[models.indexOf(m) % (tc.palette || PALETTE_FALLBACKS).length] }}>
                                                {m.model_name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paramKeys.map(p => (
                                        <tr key={p}>
                                            <td style={{ fontWeight: 600 }}>{p}</td>
                                            {chartModels.map(m => (
                                                <td key={m.model_name} style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                    {m.parameters[p] ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── Charts ──────────────────────────────────────── */}
                    {chartModels.length > 0 && metricKeys.length > 0 && (
                        <div className="card" style={{ marginBottom: '1.5rem' }}>
                            <div className="card-header">
                                <span className="card-title">Charts</span>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    {[
                                        { k: 'bar', l: '📊 Bar', },
                                        { k: 'radar', l: '🕸️ Radar' },
                                        { k: 'kfold', l: '📉 K-Fold' },
                                    ].map(mode => (
                                        <button key={mode.k}
                                            className={`btn ${chartMode === mode.k ? 'btn-primary' : 'btn-ghost'}`}
                                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                            onClick={() => setChartMode(mode.k)}>
                                            {mode.l}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Bar */}
                            {chartMode === 'bar' && (
                                <div style={{ width: '100%', height: 340 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={tc.grid} />
                                            <XAxis dataKey="metric" stroke={tc.text} tick={{ fontSize: 11 }} />
                                            <YAxis stroke={tc.text} tick={{ fontSize: 11 }} />
                                            <Tooltip contentStyle={{ background: tc.tooltipBg, border: `1px solid ${tc.tooltipBorder}`, borderRadius: 8, fontSize: '0.8rem' }}
                                                labelStyle={{ color: tc.textPrimary, fontWeight: 600 }}
                                                itemStyle={{ color: tc.textSecondary }} />
                                            <Legend />
                                            {chartModels.map(m => (
                                                <Bar key={m.model_name} dataKey={m.model_name}
                                                    fill={(tc.palette || PALETTE_FALLBACKS)[models.indexOf(m) % (tc.palette || PALETTE_FALLBACKS).length]}
                                                    radius={[4, 4, 0, 0]} />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Radar */}
                            {chartMode === 'radar' && (
                                <div style={{ width: '100%', height: 380 }}>
                                    <ResponsiveContainer>
                                        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                                            <PolarGrid stroke={tc.grid} />
                                            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: tc.text }} />
                                            <PolarRadiusAxis tick={{ fontSize: 9, fill: tc.text }} domain={[0, 1]} />
                                            <Tooltip contentStyle={{ background: tc.tooltipBg, border: `1px solid ${tc.tooltipBorder}`, borderRadius: 8, fontSize: '0.8rem' }} />
                                            {chartModels.map(m => (
                                                <Radar key={m.model_name} name={m.model_name}
                                                    dataKey={m.model_name}
                                                    stroke={(tc.palette || PALETTE_FALLBACKS)[models.indexOf(m) % (tc.palette || PALETTE_FALLBACKS).length]}
                                                    fill={(tc.palette || PALETTE_FALLBACKS)[models.indexOf(m) % (tc.palette || PALETTE_FALLBACKS).length]}
                                                    fillOpacity={0.15} strokeWidth={2} />
                                            ))}
                                            <Legend />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* K-Fold Line */}
                            {chartMode === 'kfold' && (
                                kfoldData.data.length > 0 ? (
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem 0 0' }}>
                                            Metric: <strong>{kfoldData.metric}</strong> per fold
                                        </p>
                                        <div style={{ width: '100%', height: 340 }}>
                                            <ResponsiveContainer>
                                                <LineChart data={kfoldData.data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke={tc.grid} />
                                                    <XAxis dataKey="fold" stroke={tc.text} tick={{ fontSize: 11 }} />
                                                    <YAxis stroke={tc.text} tick={{ fontSize: 11 }} />
                                                    <Tooltip contentStyle={{ background: tc.tooltipBg, border: `1px solid ${tc.tooltipBorder}`, borderRadius: 8, fontSize: '0.8rem' }} />
                                                    <Legend />
                                                    {chartModels.map(m => (
                                                        <Line key={m.model_name} type="monotone" dataKey={m.model_name}
                                                            stroke={(tc.palette || PALETTE_FALLBACKS)[models.indexOf(m) % (tc.palette || PALETTE_FALLBACKS).length]}
                                                            strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="empty-state" style={{ padding: '2rem' }}>
                                        <p style={{ color: 'var(--text-muted)' }}>No k-fold data — selected models have single runs</p>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </>
            )}

            {!benchLoading && models.length === 0 && selectedExps.length > 0 && (
                <div className="card"><div className="empty-state">
                    <div className="icon">🧪</div>
                    <p>No models found — click <strong>Load Benchmark</strong> above</p>
                </div></div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                MODEL DETAIL DRAWER
               ═══════════════════════════════════════════════════════════════ */}
            <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
                title={`Model: ${drawerModel?.model_name || ''}`} width="560px">
                {drawerModel && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Overview row */}
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Experiment</span>
                                <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{drawerModel.experiment_name}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Runs</span>
                                <div style={{ marginTop: '0.2rem' }}><span className="badge badge-info">{drawerModel.run_count}</span></div>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</span>
                                <div style={{ marginTop: '0.2rem' }}>
                                    <span className={`badge ${drawerModel.status === 'finished' ? 'badge-success' : 'badge-warning'}`}>{drawerModel.status}</span>
                                </div>
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

                        {/* Metrics */}
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                Metrics {drawerModel.run_count > 1 ? '(Mean ± Std)' : ''}
                            </span>
                            <div style={{ marginTop: '0.25rem' }}>
                                {Object.entries(drawerModel.metrics).map(([k, v]) => (
                                    <div key={k} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '0.35rem 0', borderBottom: '1px solid var(--border)',
                                    }}>
                                        <span style={{ fontWeight: 600 }}>{k}</span>
                                        <div style={{ fontFamily: 'monospace', textAlign: 'right' }}>
                                            <span style={{ color: 'var(--highlight)', fontWeight: 600 }}>{fmt(v.mean, 6)}</span>
                                            {v.count > 1 && (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.3rem' }}>
                                                    ± {fmt(v.std, 6)}
                                                </span>
                                            )}
                                            {v.count > 1 && (
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                    [{v.values.map(x => fmt(x)).join(', ')}]
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Parameters */}
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parameters</span>
                            <div style={{ marginTop: '0.25rem' }}>
                                {Object.entries(drawerModel.parameters).map(([k, v]) => (
                                    <div key={k} style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        padding: '0.3rem 0', borderBottom: '1px solid var(--border)',
                                    }}>
                                        <span style={{ fontWeight: 600 }}>{k}</span>
                                        <span style={{ fontFamily: 'monospace' }}>{v}</span>
                                    </div>
                                ))}
                                {Object.keys(drawerModel.parameters).length === 0 &&
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No parameters logged</p>}
                            </div>
                        </div>

                        {/* Run IDs */}
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Run IDs</span>
                            <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', maxHeight: '100px', overflowY: 'auto' }}>
                                {drawerModel.run_ids.map(rid => (
                                    <span key={rid} style={{
                                        fontFamily: 'monospace', fontSize: '0.7rem',
                                        padding: '0.15rem 0.4rem', borderRadius: '0.25rem',
                                        background: 'var(--bg-secondary, rgba(0,0,0,0.04))',
                                    }}>{rid}</span>
                                ))}
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

                        {/* Artifacts */}
                        <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Artifacts (first run)</span>
                            {artsLoading ? (
                                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>⏳ Loading…</p>
                            ) : drawerArtifacts.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>No artifacts</p>
                            ) : (
                                <div style={{ marginTop: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                                    {drawerArtifacts.map((art, i) => (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            padding: '0.35rem 0.75rem',
                                            borderBottom: i < drawerArtifacts.length - 1 ? '1px solid var(--border)' : 'none',
                                            fontSize: '0.8rem',
                                        }}>
                                            <span style={{ fontSize: '1rem' }}>
                                                {(art.path || '').match(/\.(png|jpg|jpeg|gif|svg)$/i) ? '🖼️' :
                                                 (art.path || '').match(/\.(csv|tsv)$/i) ? '📊' :
                                                 (art.path || '').match(/\.(json|yaml|yml|txt|log)$/i) ? '📄' : '📁'}
                                            </span>
                                            <span style={{ fontFamily: 'monospace', flex: 1 }}>{art.path || art.name || JSON.stringify(art)}</span>
                                            {art.file_size != null && (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                                                    {art.file_size > 1048576 ? `${(art.file_size / 1048576).toFixed(1)} MB` :
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
        </div>
    )
}
