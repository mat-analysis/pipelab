/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState } from 'react'
import { api } from '../api'

export default function GovernanceAlerts() {
    const [alerts, setAlerts] = useState([])
    const [form, setForm] = useState({ severity: 'warning', message: '', metric_key: '', threshold: '' })
    const [filter, setFilter] = useState(null) // null = all

    const load = () => api.listAlerts(filter).then(setAlerts).catch(() => { })
    useEffect(() => { load() }, [filter])

    const handleCreate = async (e) => {
        e.preventDefault()
        await api.createAlert({
            severity: form.severity,
            message: form.message,
            metric_key: form.metric_key || null,
            threshold: form.threshold ? parseFloat(form.threshold) : null,
        })
        setForm({ severity: 'warning', message: '', metric_key: '', threshold: '' })
        load()
    }

    return (
        <div>
            <h2 className="page-title">ML Lab Alerts</h2>
            <p className="page-subtitle">Manage alert rules and view triggered alerts</p>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><span className="card-title">Create Alert</span></div>
                <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
                    <div>
                        <label className="form-label">Severity</label>
                        <select className="form-input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <label className="form-label">Message</label>
                        <input className="form-input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
                    </div>
                    <div>
                        <label className="form-label">Metric Key</label>
                        <input className="form-input" value={form.metric_key} onChange={(e) => setForm({ ...form, metric_key: e.target.value })} />
                    </div>
                    <div>
                        <label className="form-label">Threshold</label>
                        <input className="form-input" type="number" step="any" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
                    </div>
                    <button type="submit" className="btn btn-primary">Create</button>
                </form>
            </div>

            <div className="card">
                <div className="card-header">
                    <span className="card-title">Alerts</span>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button className={`btn ${filter === null ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => setFilter(null)}>All</button>
                        <button className={`btn ${filter === false ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => setFilter(false)}>Active</button>
                        <button className={`btn ${filter === true ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => setFilter(true)}>Resolved</button>
                    </div>
                </div>
                {alerts.length === 0 ? (
                    <div className="empty-state"><div className="icon">🔔</div><p>No alerts</p></div>
                ) : (
                    <table className="data-table">
                        <thead><tr><th>Severity</th><th>Message</th><th>Metric</th><th>Threshold</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            {alerts.map((a) => (
                                <tr key={a.id}>
                                    <td>
                                        <span className={`badge ${a.severity === 'critical' ? 'badge-danger' : a.severity === 'warning' ? 'badge-warning' : 'badge-info'}`}>
                                            {a.severity}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-primary)' }}>{a.message}</td>
                                    <td>{a.metric_key || '—'}</td>
                                    <td>{a.threshold ?? '—'}</td>
                                    <td>{a.triggered_at ? new Date(a.triggered_at * 1000).toLocaleString() : '—'}</td>
                                    <td><span className={`badge ${a.resolved ? 'badge-success' : 'badge-warning'}`}>{a.resolved ? 'Resolved' : 'Active'}</span></td>
                                    <td>
                                        {!a.resolved && (
                                            <button className="btn btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                                onClick={() => api.resolveAlert(a.id).then(load)}>Resolve</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
