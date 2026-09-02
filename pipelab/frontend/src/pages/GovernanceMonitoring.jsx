/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../api'

function useThemeColors() {
    const [colors, setColors] = useState({})
    useEffect(() => {
        const update = () => {
            const s = getComputedStyle(document.documentElement)
            setColors({
                grid: s.getPropertyValue('--chart-grid').trim() || 'rgba(148,163,184,.2)',
                text: s.getPropertyValue('--chart-text').trim() || '#64748b',
                tooltipBg: s.getPropertyValue('--tooltip-bg').trim() || '#fff',
                tooltipBorder: s.getPropertyValue('--tooltip-border').trim() || '#e2e8f0',
                secondary: s.getPropertyValue('--secondary').trim() || '#EE72F8',
                accent: s.getPropertyValue('--accent').trim() || '#31EC56',
                warning: s.getPropertyValue('--warning').trim() || '#f59e0b',
            })
        }
        update()
        const observer = new MutationObserver(update)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
        return () => observer.disconnect()
    }, [])
    return colors
}

export default function GovernanceMonitoring() {
    const [deployments, setDeployments] = useState([])
    const [selectedDep, setSelectedDep] = useState('')
    const [records, setRecords] = useState([])
    const tc = useThemeColors()

    useEffect(() => { api.listDeployments().then(setDeployments).catch(() => { }) }, [])
    useEffect(() => {
        if (selectedDep) api.listRecords(selectedDep).then(setRecords).catch(() => setRecords([]))
    }, [selectedDep])

    const chartData = records.map((r) => ({
        time: new Date(r.timestamp * 1000).toLocaleTimeString(),
        predictions: r.prediction_count,
        latency: r.avg_latency_ms || 0,
        drift: r.drift_score || 0,
    }))

    return (
        <div>
            <h2 className="page-title">Model Monitoring Adapters</h2>
            <p className="page-subtitle">Track prediction statistics and drift indicators</p>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><span className="card-title">Select Deployment</span></div>
                <select className="form-input" value={selectedDep}
                    onChange={(e) => setSelectedDep(e.target.value)}>
                    <option value="">Select a deployment…</option>
                    {deployments.map((d) => (
                        <option key={`${d.model_name}-${d.version}`} value={`${d.model_name}-${d.version}`}>
                            {d.model_name} v{d.version} ({d.status})
                        </option>
                    ))}
                </select>
            </div>

            {chartData.length > 0 && (
                <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
                    <div className="card">
                        <div className="card-header"><span className="card-title">Predictions / Latency</span></div>
                        <div style={{ width: '100%', height: 250 }}>
                            <ResponsiveContainer>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={tc.grid} />
                                    <XAxis dataKey="time" stroke={tc.text} tick={{ fontSize: 11 }} />
                                    <YAxis stroke={tc.text} tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={{ background: tc.tooltipBg, border: `1px solid ${tc.tooltipBorder}`, borderRadius: 8 }} />
                                    <Line type="monotone" dataKey="predictions" stroke={tc.secondary} strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="latency" stroke={tc.accent} strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header"><span className="card-title">Drift Score</span></div>
                        <div style={{ width: '100%', height: 250 }}>
                            <ResponsiveContainer>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={tc.grid} />
                                    <XAxis dataKey="time" stroke={tc.text} tick={{ fontSize: 11 }} />
                                    <YAxis stroke={tc.text} tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={{ background: tc.tooltipBg, border: `1px solid ${tc.tooltipBorder}`, borderRadius: 8 }} />
                                    <Line type="monotone" dataKey="drift" stroke={tc.warning} strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {records.length === 0 && selectedDep && (
                <div className="card">
                    <div className="empty-state"><div className="icon">📡</div><p>No monitoring data yet</p></div>
                </div>
            )}
        </div>
    )
}
