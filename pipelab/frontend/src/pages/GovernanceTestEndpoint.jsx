/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState, useRef } from 'react'
import { useProject } from '../context/ProjectContext'
import { api } from '../api'

const EXAMPLE_PAYLOADS = {
    mlflow: {
        label: 'MLflow Serving (dataframe_split)',
        value: JSON.stringify({
            dataframe_split: {
                columns: ["feature_0", "feature_1", "feature_2", "feature_3"],
                data: [[5.1, 3.5, 1.4, 0.2]]
            }
        }, null, 2),
    },
    mlflowRecords: {
        label: 'MLflow Serving (dataframe_records)',
        value: JSON.stringify({
            dataframe_records: [
                { feature_0: 5.1, feature_1: 3.5, feature_2: 1.4, feature_3: 0.2 },
                { feature_0: 6.2, feature_1: 2.8, feature_2: 4.8, feature_3: 1.8 }
            ]
        }, null, 2),
    },
    generic: {
        label: 'Generic JSON',
        value: JSON.stringify({ input: [1.0, 2.0, 3.0, 4.0] }, null, 2),
    },
}

function StatusBadge({ code }) {
    if (!code) return null
    let cls = 'badge '
    if (code >= 200 && code < 300) cls += 'badge-success'
    else if (code >= 400 && code < 500) cls += 'badge-warning'
    else cls += 'badge-danger'
    return <span className={cls} style={{ fontSize: '0.75rem' }}>{code}</span>
}

export default function GovernanceTestEndpoint() {
    const { selectedProject } = useProject()
    const [deployments, setDeployments] = useState([])
    const [selectedDep, setSelectedDep] = useState(null)
    const [endpointUri, setEndpointUri] = useState('')
    const [payload, setPayload] = useState(EXAMPLE_PAYLOADS.mlflow.value)
    const [sending, setSending] = useState(false)
    const [history, setHistory] = useState([])
    const [error, setError] = useState('')
    const [jsonError, setJsonError] = useState('')
    const textareaRef = useRef(null)

    useEffect(() => {
        api.listDeployments().then(deps => {
            setDeployments(deps.filter(d => d.status === 'active'))
        }).catch(() => setDeployments([]))
    }, [])

    // Auto-select endpoint when deployment changes
    const selectDeployment = (dep) => {
        setSelectedDep(dep)
        setEndpointUri(dep.endpoint_uri || `http://localhost:${dep.port || 5001}/invocations`)
        setError('')
    }

    const validateJson = (text) => {
        try {
            JSON.parse(text)
            setJsonError('')
            return true
        } catch (e) {
            setJsonError(e.message)
            return false
        }
    }

    const handlePayloadChange = (val) => {
        setPayload(val)
        if (val.trim()) validateJson(val)
        else setJsonError('')
    }

    const handleSend = async () => {
        if (!endpointUri) return
        if (!validateJson(payload)) return

        setSending(true)
        setError('')
        const startTime = Date.now()

        try {
            const parsed = JSON.parse(payload)
            const result = await api.testEndpoint(endpointUri, parsed)
            setHistory(prev => [{
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                endpoint: endpointUri,
                model: selectedDep ? `${selectedDep.model_name} v${selectedDep.version}` : 'custom',
                request: parsed,
                response: result,
                clientMs: Date.now() - startTime,
            }, ...prev])
        } catch (e) {
            setError(e.message || 'Request failed')
            setHistory(prev => [{
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                endpoint: endpointUri,
                model: selectedDep ? `${selectedDep.model_name} v${selectedDep.version}` : 'custom',
                request: JSON.parse(payload),
                response: { status_code: 0, body: e.message, elapsed_ms: Date.now() - startTime },
                clientMs: Date.now() - startTime,
                error: true,
            }, ...prev])
        }
        setSending(false)
    }

    const handleKeyDown = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            handleSend()
        }
        // Tab key for indentation
        if (e.key === 'Tab') {
            e.preventDefault()
            const start = e.target.selectionStart
            const end = e.target.selectionEnd
            const val = e.target.value
            const newVal = val.substring(0, start) + '  ' + val.substring(end)
            setPayload(newVal)
            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = start + 2
            }, 0)
        }
    }

    const formatPayload = () => {
        try {
            const parsed = JSON.parse(payload)
            setPayload(JSON.stringify(parsed, null, 2))
            setJsonError('')
        } catch (e) {
            setJsonError(e.message)
        }
    }

    if (!selectedProject) {
        return (
            <div>
                <h2 className="page-title">Test Endpoint</h2>
                <div className="card"><div className="empty-state">
                    <div className="icon">📁</div>
                    <p>Select a project from the Dashboard first</p>
                </div></div>
            </div>
        )
    }

    return (
        <div>
            <h2 className="page-title">Test Endpoint</h2>
            <p className="page-subtitle">Send test payloads to deployed model endpoints</p>

            {error && (
                <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'color-mix(in srgb, var(--danger) 8%, transparent)', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', color: 'var(--danger)', fontSize: '0.85rem' }}>
                    {error}
                    <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 700 }}>×</button>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* ── Left: Request Panel ────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Deployment selector */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Target Deployment</span>
                            <span className="badge badge-info">{deployments.length} active</span>
                        </div>
                        {deployments.length === 0 ? (
                            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                No active deployments. Deploy a model first from the Deployment Providers page.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                {deployments.map((d, i) => {
                                    const isSelected = selectedDep && selectedDep.model_name === d.model_name && selectedDep.version === d.version
                                    return (
                                        <div key={`${d.model_name}-${d.version}`}
                                            onClick={() => selectDeployment(d)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                padding: '0.65rem 1rem', cursor: 'pointer',
                                                background: isSelected ? 'var(--accent-alpha)' : 'transparent',
                                                borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                                                borderBottom: i < deployments.length - 1 ? '1px solid var(--border)' : 'none',
                                                transition: 'all 0.15s ease',
                                            }}>
                                            <div style={{
                                                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                                                background: 'var(--success)', boxShadow: '0 0 4px color-mix(in srgb, var(--success) 40%, transparent)',
                                            }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                    {d.model_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>v{d.version}</span>
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {d.deploy_service || 'MLflowServeProvider'} — {d.alias} — :{d.port || '5001'}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        {/* Custom endpoint input */}
                        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                Endpoint URL
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input type="text" value={endpointUri}
                                    onChange={(e) => setEndpointUri(e.target.value)}
                                    placeholder="http://localhost:5001/invocations"
                                    style={{
                                        flex: 1, padding: '0.45rem 0.75rem', borderRadius: '6px',
                                        border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'monospace',
                                    }} />
                            </div>
                        </div>
                    </div>

                    {/* Payload editor */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Request Payload</span>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <select onChange={(e) => {
                                    if (e.target.value && EXAMPLE_PAYLOADS[e.target.value]) {
                                        setPayload(EXAMPLE_PAYLOADS[e.target.value].value)
                                        setJsonError('')
                                    }
                                }} style={{
                                    padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px',
                                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                }} defaultValue="">
                                    <option value="" disabled>Load template...</option>
                                    {Object.entries(EXAMPLE_PAYLOADS).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                    ))}
                                </select>
                                <button onClick={formatPayload} style={{
                                    padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px',
                                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)', cursor: 'pointer',
                                }}>Format</button>
                            </div>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <textarea
                                ref={textareaRef}
                                value={payload}
                                onChange={(e) => handlePayloadChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                spellCheck={false}
                                style={{
                                    width: '100%', minHeight: '220px', padding: '1rem',
                                    fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
                                    fontSize: '0.8rem', lineHeight: '1.5',
                                    border: 'none', borderTop: '1px solid var(--border)',
                                    background: jsonError ? 'color-mix(in srgb, var(--danger) 3%, transparent)' : 'var(--bg-secondary)',
                                    color: 'var(--text-primary)', resize: 'vertical',
                                    outline: 'none', boxSizing: 'border-box',
                                }}
                            />
                            {jsonError && (
                                <div style={{ padding: '0.4rem 1rem', fontSize: '0.7rem', color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 6%, transparent)', borderTop: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)' }}>
                                    JSON Error: {jsonError}
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {'\u2318'}+Enter to send
                            </span>
                            <button className="btn btn-primary"
                                onClick={handleSend}
                                disabled={sending || !endpointUri || !!jsonError}
                                style={{ padding: '0.45rem 1.5rem', fontSize: '0.85rem' }}>
                                {sending ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                                        Sending...
                                    </span>
                                ) : 'Send Request'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Right: Response Panel ───────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Latest response */}
                    <div className="card" style={{ flex: 1 }}>
                        <div className="card-header">
                            <span className="card-title">Response</span>
                            {history.length > 0 && (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <StatusBadge code={history[0].response?.status_code} />
                                    {history[0].response?.elapsed_ms != null && (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            {history[0].response.elapsed_ms.toFixed(0)}ms
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        {history.length === 0 ? (
                            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📡</div>
                                <p style={{ fontSize: '0.85rem' }}>Send a request to see the response here</p>
                                <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.7 }}>
                                    Select a deployment or enter a custom endpoint URL
                                </p>
                            </div>
                        ) : (
                            <div>
                                <pre style={{
                                    margin: 0, padding: '1rem',
                                    fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
                                    fontSize: '0.78rem', lineHeight: '1.5',
                                    background: 'var(--bg-secondary)',
                                    color: history[0].error ? 'var(--danger)' : 'var(--text-primary)',
                                    overflow: 'auto', maxHeight: '350px',
                                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                }}>
                                    {typeof history[0].response?.body === 'object'
                                        ? JSON.stringify(history[0].response.body, null, 2)
                                        : String(history[0].response?.body || '')}
                                </pre>
                                {history[0].response?.headers && (
                                    <details style={{ borderTop: '1px solid var(--border)' }}>
                                        <summary style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                            Response Headers
                                        </summary>
                                        <pre style={{
                                            margin: 0, padding: '0.5rem 1rem', fontSize: '0.65rem',
                                            fontFamily: 'monospace', background: 'var(--bg-secondary)',
                                            color: 'var(--text-muted)', overflow: 'auto', maxHeight: '150px',
                                        }}>
                                            {JSON.stringify(history[0].response.headers, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Request history */}
                    {history.length > 1 && (
                        <div className="card">
                            <div className="card-header">
                                <span className="card-title">History</span>
                                <button onClick={() => setHistory([])} style={{
                                    padding: '0.2rem 0.6rem', fontSize: '0.65rem', borderRadius: '4px',
                                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                    color: 'var(--text-muted)', cursor: 'pointer',
                                }}>Clear</button>
                            </div>
                            <div style={{ maxHeight: '250px', overflow: 'auto' }}>
                                {history.slice(1).map((h) => (
                                    <div key={h.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                                        padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)',
                                        fontSize: '0.75rem', cursor: 'pointer', opacity: 0.8,
                                    }} onClick={() => {
                                        setPayload(JSON.stringify(h.request, null, 2))
                                        setEndpointUri(h.endpoint)
                                        setJsonError('')
                                    }}>
                                        <StatusBadge code={h.response?.status_code} />
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {h.model}
                                        </span>
                                        <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {h.endpoint}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                                            {h.response?.elapsed_ms?.toFixed(0) || h.clientMs}ms
                                        </span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                                            {h.timestamp}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
            `}</style>
        </div>
    )
}
