/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import { api } from '../api'

// ── Pipeline Step Progress Bar ───────────────────────────────────────────────

function PipelineProgress({ steps, running, currentPhase }) {
    // Expected phases in pipeline order
    const phases = [
        { key: 'data', label: 'Data Loading', icon: '📥' },
        { key: 'preparation', label: 'Preparation', icon: '🔧' },
        { key: 'experiment', label: 'Experiment', icon: '🧪' },
    ]

    const getPhaseStatus = (phase) => {
        if (!steps && !running) return 'idle'
        if (running && !steps) {
            const idx = phases.findIndex(p => p.key === phase.key)
            const currentIdx = phases.findIndex(p => p.key === currentPhase)
            if (idx < currentIdx) return 'done'
            if (idx === currentIdx) return 'running'
            return 'pending'
        }
        if (steps) {
            const phaseSteps = steps.filter(s => s.step_type === phase.key)
            if (phaseSteps.length === 0) {
                // preparation may not appear if no prep method
                if (phase.key === 'preparation') return 'skipped'
                return 'idle'
            }
            if (phaseSteps.every(s => s.status === 'success')) return 'done'
            if (phaseSteps.some(s => s.status === 'failed')) return 'failed'
            return 'running'
        }
        return 'idle'
    }

    const statusColors = {
        idle: 'var(--border)',
        pending: 'var(--text-muted)',
        running: 'var(--highlight)',
        done: 'var(--success)',
        failed: 'var(--danger)',
        skipped: 'var(--text-muted)',
    }

    const statusIcons = {
        idle: '○',
        pending: '○',
        running: '◉',
        done: '✓',
        failed: '✗',
        skipped: '—',
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', margin: '1.5rem 0' }}>
            {phases.map((phase, idx) => {
                const status = getPhaseStatus(phase)
                const color = statusColors[status]
                const isActive = status === 'running'
                return (
                    <div key={phase.key} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: status === 'done' ? 'var(--success)' : status === 'failed' ? 'var(--danger)' : status === 'running' ? 'var(--highlight)' : 'var(--bg-secondary)',
                                border: `2px solid ${color}`,
                                color: ['done', 'failed', 'running'].includes(status) ? '#fff' : 'var(--text-muted)',
                                fontWeight: 700, fontSize: '1rem',
                                transition: 'all 0.3s ease',
                                animation: isActive ? 'pulse 1.5s infinite' : 'none',
                            }}>
                                {status === 'running' ? (
                                    <span style={{ fontSize: '1.1rem' }}>{phase.icon}</span>
                                ) : (
                                    <span>{statusIcons[status]}</span>
                                )}
                            </div>
                            <div style={{
                                marginTop: '0.5rem', fontSize: '0.7rem', fontWeight: 600,
                                color: isActive ? 'var(--highlight)' : status === 'done' ? 'var(--success)' : status === 'failed' ? 'var(--danger)' : 'var(--text-muted)',
                                textTransform: 'uppercase', letterSpacing: '0.02em',
                            }}>
                                {phase.label}
                            </div>
                            {steps && (() => {
                                const phaseSteps = steps.filter(s => s.step_type === phase.key)
                                if (phaseSteps.length > 0) {
                                    const totalTime = phaseSteps.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
                                    return (
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                            {totalTime.toFixed(2)}s
                                        </div>
                                    )
                                }
                                return null
                            })()}
                        </div>
                        {idx < phases.length - 1 && (
                            <div style={{
                                width: '60px', height: '2px', margin: '0 0.25rem',
                                marginBottom: steps ? '1.5rem' : '1rem',
                                background: getPhaseStatus(phases[idx + 1]) === 'done' || getPhaseStatus(phases[idx + 1]) === 'running'
                                    ? 'var(--success)' : 'var(--border)',
                                transition: 'background 0.3s ease',
                            }} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Pipelines() {
    const { selectedProject, refresh } = useProject()
    const navigate = useNavigate()
    const [services, setServices] = useState([])
    const [datasetConfigs, setDatasetConfigs] = useState([])
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState(null)
    const [currentPhase, setCurrentPhase] = useState(null)
    const [elapsedTime, setElapsedTime] = useState(0)
    const timerRef = useRef(null)

    // Selected items (single selection)
    const [selectedDataConfig, setSelectedDataConfig] = useState(null)
    const [selectedExp, setSelectedExp] = useState(null)

    useEffect(() => {
        if (selectedProject) {
            api.listServices(selectedProject).then(setServices).catch(() => setServices([]))
            api.listDatasetConfigs(selectedProject).then(setDatasetConfigs).catch(() => setDatasetConfigs([]))
            setResult(null)
            setSelectedDataConfig(null)
            setSelectedExp(null)
        } else {
            setServices([])
            setDatasetConfigs([])
        }
    }, [selectedProject])

    const expServices = services.filter((s) => s.step_type === 'experiment')

    const handleRun = async () => {
        if (!selectedProject || !selectedDataConfig || !selectedExp) return
        setRunning(true)
        setResult(null)
        setElapsedTime(0)
        setCurrentPhase('data')

        // Start elapsed timer
        const startTime = Date.now()
        timerRef.current = setInterval(() => {
            setElapsedTime(((Date.now() - startTime) / 1000).toFixed(1))
        }, 100)

        // Simulate phase progression (best estimate since backend is synchronous)
        const phaseTimer = setTimeout(() => setCurrentPhase('preparation'), 1500)
        const phaseTimer2 = setTimeout(() => setCurrentPhase('experiment'), 3000)

        try {
            const config = datasetConfigs.find(d => d.name === selectedDataConfig)
            const dataServiceName = config?.data_service
            if (!dataServiceName) throw new Error('No data service found for the selected dataset config')

            const res = await api.runPipeline(
                selectedProject,
                [dataServiceName],
                [selectedExp],
                [],
                selectedDataConfig,
            )
            setResult(res)
            setCurrentPhase(null)
            if (res.status === 'completed') {
                await refresh()
            }
        } catch (e) {
            setResult({ status: 'error', error: e.message })
            setCurrentPhase(null)
        }

        clearTimeout(phaseTimer)
        clearTimeout(phaseTimer2)
        clearInterval(timerRef.current)
        timerRef.current = null
        setRunning(false)
    }

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [])

    if (!selectedProject) {
        return (
            <div>
                <h2 className="page-title">Train Pipelines</h2>
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
            <h2 className="page-title">Train Pipelines</h2>
            <p className="page-subtitle">Select a dataset configuration and an experiment to run for <strong>{selectedProject}</strong></p>

            {/* 2-column layout: Dataset Config → Experiment */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

                {/* ── Dataset Config Column ─────────────────────────────── */}
                <div className="card" style={{ flex: 1, minWidth: '280px' }}>
                    <div className="card-header">
                        <span className="card-title">📥 Dataset Configuration</span>
                        <span className="badge badge-info">{datasetConfigs.length}</span>
                    </div>
                    {datasetConfigs.length === 0 ? (
                        <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                            <p style={{ fontSize: '0.85rem' }}>No dataset configs</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Add configs in the <strong>Data Providers</strong> page
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem 0' }}>
                            {datasetConfigs.map((cfg) => {
                                const isSelected = selectedDataConfig === cfg.name
                                return (
                                    <label key={cfg.name}
                                        style={{
                                            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                                            padding: '0.75rem 1rem',
                                            background: isSelected ? 'var(--accent-alpha)' : 'transparent',
                                            borderRadius: '8px', cursor: 'pointer',
                                            border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                            transition: 'all 0.2s ease',
                                        }}>
                                        <input type="radio" name="dataConfig"
                                            checked={isSelected}
                                            onChange={() => setSelectedDataConfig(cfg.name)}
                                            style={{ accentColor: 'var(--accent)', marginTop: '0.15rem' }} />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? 'var(--highlight)' : 'var(--text-primary)' }}>
                                                {cfg.name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                {cfg.data_service} → {cfg.preparation_method}
                                            </div>
                                            {cfg.description && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                                    {cfg.description}
                                                </div>
                                            )}
                                            {cfg.preparation_params && Object.keys(cfg.preparation_params).length > 0 && (
                                                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                                    {Object.entries(cfg.preparation_params).map(([k, v]) => (
                                                        <span key={k} className="badge badge-info" style={{ fontSize: '0.6rem' }}>
                                                            {k}={String(v)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Arrow */}
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '2rem', color: 'var(--text-muted)', padding: '2rem 0' }}>→</div>

                {/* ── Experiment Service Column ────────────────────────── */}
                <div className="card" style={{ flex: 1, minWidth: '280px' }}>
                    <div className="card-header">
                        <span className="card-title">🧪 Experiment Providers</span>
                        <span className="badge badge-info">{expServices.length}</span>
                    </div>
                    {expServices.length === 0 ? (
                        <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                            <p style={{ fontSize: '0.85rem' }}>No experiment providers</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Create a class extending <code>ExperimentService</code> in <code>pipeline/</code>
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem 0' }}>
                            {expServices.map((s) => {
                                const isSelected = selectedExp === s.class_name
                                return (
                                    <label key={s.class_name}
                                        style={{
                                            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                                            padding: '0.75rem 1rem',
                                            background: isSelected ? 'var(--secondary-muted)' : 'transparent',
                                            borderRadius: '8px', cursor: 'pointer',
                                            border: `1px solid ${isSelected ? 'var(--secondary)' : 'var(--border)'}`,
                                            transition: 'all 0.2s ease',
                                        }}>
                                        <input type="radio" name="expService"
                                            checked={isSelected}
                                            onChange={() => setSelectedExp(s.class_name)}
                                            style={{ accentColor: 'var(--secondary)', marginTop: '0.15rem' }} />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? 'var(--secondary)' : 'var(--text-primary)' }}>
                                                {s.class_name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                {s.description || s.docstring || s.module_path}
                                            </div>
                                        </div>
                                    </label>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Run button */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <button className="btn btn-primary"
                    onClick={handleRun}
                    disabled={running || !selectedDataConfig || !selectedExp}
                    style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
                    {running ? '⏳ Running…' : '▶ Run Pipeline'}
                </button>
                {(!selectedDataConfig || !selectedExp) && !running && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Select one dataset configuration and one experiment provider
                    </p>
                )}
            </div>

            {/* ── Progress Bar ─────────────────────────────────────────── */}
            {(running || result) && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-header">
                        <span className="card-title">Pipeline Execution</span>
                        {running && (
                            <span className="badge badge-info" style={{ animation: 'pulse 1.5s infinite' }}>
                                {elapsedTime}s elapsed
                            </span>
                        )}
                        {result && (
                            <span className={`badge ${result.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                                {result.status === 'completed' ? '✓ Completed' : result.status === 'error' ? '✗ Error' : '✗ Failed'}
                            </span>
                        )}
                    </div>

                    <PipelineProgress
                        steps={result?.steps || null}
                        running={running}
                        currentPhase={currentPhase}
                    />

                    {/* Running info */}
                    {running && (
                        <div style={{ textAlign: 'center', padding: '0 1rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Executing pipeline: <strong>{selectedDataConfig}</strong> → <strong>{selectedExp}</strong>
                        </div>
                    )}

                    {/* Total time summary */}
                    {result?.steps && (
                        <div style={{
                            display: 'flex', justifyContent: 'center', gap: '1.5rem',
                            padding: '0.75rem 1rem', borderTop: '1px solid var(--border)',
                            fontSize: '0.8rem', color: 'var(--text-muted)'
                        }}>
                            <span>Steps: <strong>{result.steps.length}</strong></span>
                            <span>Total: <strong>{result.steps.reduce((s, r) => s + (r.duration_seconds || 0), 0).toFixed(2)}s</strong></span>
                            <span>Success: <strong>{result.steps.filter(s => s.status === 'success').length}/{result.steps.length}</strong></span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Results Detail ───────────────────────────────────────── */}
            {result && result.steps && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Step Details</span>
                    </div>

                    {/* Experiment association notice */}
                    {result.experiment_names && result.experiment_names.length > 0 && (
                        <div style={{ padding: '0.75rem 1rem', margin: '0.5rem 1rem', background: 'var(--accent-muted)', borderRadius: '8px', border: '1px solid var(--accent-muted)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', fontWeight: 600 }}>
                                Experiments Associated to {selectedExp}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {result.experiment_names.map((name) => (
                                    <span key={name} className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                                        🧪 {name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Steps table */}
                    <div style={{ padding: '0.5rem 0' }}>
                        {result.steps.map((s, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.6rem 1rem',
                                borderBottom: i < result.steps.length - 1 ? '1px solid var(--border)' : 'none',
                            }}>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: s.status === 'success' ? 'var(--success)' : 'var(--danger)',
                                    color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                                }}>
                                    {s.status === 'success' ? '✓' : '✗'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.class_name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        <span className="badge badge-info" style={{ fontSize: '0.6rem', marginRight: '0.5rem' }}>{s.step_type}</span>
                                        {s.step_name}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace' }}>
                                        {s.duration_seconds != null ? `${s.duration_seconds}s` : '—'}
                                    </div>
                                </div>
                                {s.error && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--danger)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {s.error}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error display */}
            {result && !result.steps && result.error && (
                <div className="card">
                    <div className="empty-state">
                        <p style={{ color: 'var(--danger)' }}>{result.error}</p>
                    </div>
                </div>
            )}

            {/* CSS keyframe for pulse animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    )
}
