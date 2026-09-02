/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState } from 'react'
import { api } from '../api'

export default function GovernanceSelection() {
    const [experiments, setExperiments] = useState([])
    const [selectedExp, setSelectedExp] = useState('')
    const [runs, setRuns] = useState([])
    const [msg, setMsg] = useState('')

    useEffect(() => { api.listExperiments().then(setExperiments).catch(() => { }) }, [])
    useEffect(() => {
        if (selectedExp) api.listRuns(selectedExp).then(setRuns).catch(() => setRuns([]))
    }, [selectedExp])

    const handleRegister = async (run) => {
        const modelName = prompt('Model name for registry:', `model_${run.run_id.slice(0, 6)}`)
        if (!modelName) return
        try {
            await api.registerModel({ run_id: run.run_id, model_name: modelName })
            setMsg(`Registered "${modelName}" from run ${run.run_id.slice(0, 8)}`)
        } catch (e) {
            setMsg(`Error: ${e.message}`)
        }
    }

    // Sort runs by first metric descending
    const sortedRuns = [...runs].sort((a, b) => {
        const ka = Object.keys(a.metrics)[0]
        if (!ka) return 0
        return (b.metrics[ka] || 0) - (a.metrics[ka] || 0)
    })

    return (
        <div>
            <h2 className="page-title">Model Selection</h2>
            <p className="page-subtitle">Select the best model from experiment runs and register it</p>

            {msg && (
                <div className="card" style={{ marginBottom: '1rem', background: 'var(--accent-muted)', borderColor: 'var(--success)' }}>
                    <p style={{ color: 'var(--success)', fontWeight: 500 }}>{msg}</p>
                </div>
            )}

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><span className="card-title">Select Experiment</span></div>
                <select className="form-input" value={selectedExp} onChange={(e) => setSelectedExp(e.target.value)}>
                    <option value="">Select an experiment…</option>
                    {experiments.map((ex) => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
                </select>
            </div>

            {sortedRuns.length > 0 && (
                <div className="card">
                    <div className="card-header"><span className="card-title">Runs (sorted by primary metric)</span></div>
                    <table className="data-table">
                        <thead><tr><th>#</th><th>Run</th><th>Metrics</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>
                            {sortedRuns.map((r, i) => (
                                <tr key={r.run_id}>
                                    <td>{i === 0 ? '🏆' : i + 1}</td>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name || r.run_id.slice(0, 8)}</td>
                                    <td><code style={{ fontSize: '0.75rem' }}>{Object.entries(r.metrics).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(4) : v}`).join(', ')}</code></td>
                                    <td><span className={`badge ${r.status === 'finished' ? 'badge-success' : 'badge-warning'}`}>{r.status}</span></td>
                                    <td><button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleRegister(r)}>Register</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
