/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState } from 'react'
import { useProject } from '../context/ProjectContext'
import { api } from '../api'

export default function GovernanceDeployment() {
    const { selectedProject } = useProject()
    const [services, setServices] = useState([])
    const [deployments, setDeployments] = useState([])
    const [models, setModels] = useState([])
    const [modelVersions, setModelVersions] = useState([])
    const [deploying, setDeploying] = useState(false)
    const [error, setError] = useState('')

    // Deploy form state
    const [selectedModel, setSelectedModel] = useState('')
    const [selectedVersion, setSelectedVersion] = useState('')
    const [selectedService, setSelectedService] = useState('')
    const [alias, setAlias] = useState('production')
    const [port, setPort] = useState(5001)
    const [drawerOpen, setDrawerOpen] = useState(false)

    const loadData = () => {
        api.listDeployments().then(setDeployments).catch(() => setDeployments([]))
        if (selectedProject) {
            api.listServices(selectedProject).then((all) =>
                setServices(all.filter((s) => s.step_type === 'deployment'))
            ).catch(() => setServices([]))
            api.listModels().then(setModels).catch(() => setModels([]))
        }
    }

    useEffect(() => {
        if (selectedProject) {
            loadData()
        } else {
            setServices([])
            setModels([])
            setDeployments([])
        }
    }, [selectedProject])

    // Load versions when model changes
    useEffect(() => {
        if (selectedModel) {
            api.getModelVersions(selectedModel)
                .then(setModelVersions)
                .catch(() => setModelVersions([]))
        } else {
            setModelVersions([])
            setSelectedVersion('')
        }
    }, [selectedModel])

    // Set default service when drawer opens
    useEffect(() => {
        if (drawerOpen && services.length > 0 && !selectedService) {
            setSelectedService(services[0].class_name)
        }
    }, [drawerOpen, services])

    const handleDeploy = async () => {
        if (!selectedProject || !selectedModel || !selectedVersion || !selectedService) return
        setDeploying(true)
        setError('')
        try {
            await api.deployModel(
                selectedProject,
                selectedModel,
                selectedVersion,
                selectedService,
                alias,
                port,
            )
            setDrawerOpen(false)
            setSelectedModel('')
            setSelectedVersion('')
            setAlias('production')
            setPort(5001)
            loadData()
        } catch (e) {
            setError(e.message || 'Deployment failed')
        }
        setDeploying(false)
    }

    const handleUndeploy = async (modelName, version) => {
        if (!confirm(`Undeploy ${modelName} v${version}?`)) return
        try {
            await api.undeployModel(modelName, version, selectedProject)
            loadData()
        } catch (e) {
            setError(e.message || 'Undeploy failed')
        }
    }

    if (!selectedProject) {
        return (
            <div>
                <h2 className="page-title">Deployments</h2>
                <div className="card"><div className="empty-state">
                    <div className="icon">📁</div>
                    <p>Select a project from the Dashboard first</p>
                </div></div>
            </div>
        )
    }

    const activeDeployments = deployments.filter(d => d.status === 'active')
    const inactiveDeployments = deployments.filter(d => d.status !== 'active')

    return (
        <div>
            <h2 className="page-title">Deployments</h2>
            <p className="page-subtitle">Deploy and manage model endpoints for <strong>{selectedProject}</strong></p>

            {error && (
                <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'color-mix(in srgb, var(--danger) 8%, transparent)', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', color: 'var(--danger)', fontSize: '0.85rem' }}>
                    {error}
                    <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* ── Deploy Providers ──────────────────────────────────────── */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <span className="card-title">Deploy Providers</span>
                    <span className="badge badge-info">{services.length}</span>
                </div>
                {services.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                        <div className="icon">🚀</div>
                        <p>No deploy providers found</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                            Create a class extending <code>DeployService</code> in <code>pipeline/</code> or use the built-in <strong>MLflowServeProvider</strong>
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {services.map((s, i) => (
                            <div key={s.class_name} style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.7rem 1rem',
                                borderBottom: i < services.length - 1 ? '1px solid var(--border)' : 'none',
                            }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'var(--secondary-muted)', color: 'var(--secondary)', fontSize: '0.9rem',
                                }}>🚀</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                        {s.class_name}
                                        {s.module_path.includes('built-in') && (
                                            <span className="badge badge-success" style={{ fontSize: '0.55rem', marginLeft: '0.5rem' }}>built-in</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {s.module_path}
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '300px' }}>
                                    {s.docstring || s.description || '—'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Active Deployments ───────────────────────────────────── */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <span className="card-title">Active Deployments</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className="badge badge-success">{activeDeployments.length}</span>
                        <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                            onClick={() => { setDrawerOpen(true); setError('') }}
                            disabled={services.length === 0}>
                            + Deploy Model
                        </button>
                    </div>
                </div>
                {activeDeployments.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                        <div className="icon">🚀</div>
                        <p>No active deployments</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                            Click <strong>+ Deploy Model</strong> to deploy a model from the registry
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {activeDeployments.map((d, i) => (
                            <div key={`${d.model_name}-${d.version}`} style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.75rem 1rem',
                                borderBottom: i < activeDeployments.length - 1 ? '1px solid var(--border)' : 'none',
                            }}>
                                <div style={{
                                    width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                                    background: 'var(--success)', boxShadow: '0 0 6px color-mix(in srgb, var(--success) 40%, transparent)',
                                }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                        {d.model_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>v{d.version}</span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.15rem' }}>
                                        <span><strong>Alias:</strong> {d.alias}</span>
                                        <span><strong>Provider:</strong> {d.deploy_service || 'MLflowServeProvider'}</span>
                                        {d.port && <span><strong>Port:</strong> {d.port}</span>}
                                    </div>
                                </div>
                                {d.endpoint_uri && (
                                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--highlight)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {d.endpoint_uri}
                                    </div>
                                )}
                                <button className="btn" style={{
                                    padding: '0.3rem 0.75rem', fontSize: '0.75rem',
                                    background: 'color-mix(in srgb, var(--danger) 8%, transparent)', color: 'var(--danger)',
                                    border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', borderRadius: '6px', cursor: 'pointer',
                                }} onClick={() => handleUndeploy(d.model_name, d.version)}>
                                    Undeploy
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Inactive / History ───────────────────────────────────── */}
            {inactiveDeployments.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Deployment History</span>
                        <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{inactiveDeployments.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {inactiveDeployments.map((d, i) => (
                            <div key={`${d.model_name}-${d.version}-inactive`} style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.6rem 1rem', opacity: 0.6,
                                borderBottom: i < inactiveDeployments.length - 1 ? '1px solid var(--border)' : 'none',
                            }}>
                                <div style={{
                                    width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                                    background: 'var(--text-muted)',
                                }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                        {d.model_name} <span style={{ fontWeight: 400 }}>v{d.version}</span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {d.deploy_service || 'MLflowServeProvider'} — {d.alias}
                                    </div>
                                </div>
                                <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '0.65rem' }}>inactive</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Deploy Drawer (right side) ───────────────────────────── */}
            {drawerOpen && (
                <>
                    <div onClick={() => setDrawerOpen(false)} style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
                        zIndex: 999,
                    }} />
                    <div style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px',
                        background: 'var(--bg-primary)', borderLeft: '1px solid var(--border)',
                        zIndex: 1000, display: 'flex', flexDirection: 'column',
                        boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
                    }}>
                        {/* Header */}
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Deploy Model</h3>
                            <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
                        </div>

                        {/* Form */}
                        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
                            {/* Model selection */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                    Model from Registry
                                </label>
                                {models.length === 0 ? (
                                    <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                        No models in registry. Register a model first.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {models.map((m) => {
                                            const name = m.name || m.model_name
                                            const isSelected = selectedModel === name
                                            return (
                                                <label key={name} style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                                                    padding: '0.6rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                                                    background: isSelected ? 'var(--accent-alpha)' : 'transparent',
                                                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                                    transition: 'all 0.15s ease',
                                                }}>
                                                    <input type="radio" name="deployModel" checked={isSelected}
                                                        onChange={() => setSelectedModel(name)}
                                                        style={{ accentColor: 'var(--accent)' }} />
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isSelected ? 'var(--highlight)' : 'var(--text-primary)' }}>{name}</div>
                                                        {m.latest_versions && (
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                                {m.latest_versions.length} version(s)
                                                            </div>
                                                        )}
                                                    </div>
                                                </label>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Version selection */}
                            {selectedModel && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                        Version
                                    </label>
                                    {modelVersions.length === 0 ? (
                                        <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            Loading versions...
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                            {modelVersions.map((v) => {
                                                const ver = String(v.version)
                                                const isSelected = selectedVersion === ver
                                                return (
                                                    <button key={ver} onClick={() => setSelectedVersion(ver)} style={{
                                                        padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: 'pointer',
                                                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                                        background: isSelected ? 'var(--accent)' : 'var(--bg-secondary)',
                                                        color: isSelected ? '#fff' : 'var(--text-primary)',
                                                        fontWeight: 600, fontSize: '0.8rem',
                                                        transition: 'all 0.15s ease',
                                                    }}>
                                                        v{ver}
                                                        {v.status && <span style={{ marginLeft: '0.3rem', fontSize: '0.65rem', opacity: 0.7 }}>({v.status})</span>}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Deploy service selection */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                    Deploy Provider
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {services.map((s) => {
                                        const isSelected = selectedService === s.class_name
                                        return (
                                            <label key={s.class_name} style={{
                                                display: 'flex', alignItems: 'center', gap: '0.6rem',
                                                padding: '0.6rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                                                background: isSelected ? 'var(--secondary-muted)' : 'transparent',
                                                border: `1px solid ${isSelected ? 'var(--secondary)' : 'var(--border)'}`,
                                                transition: 'all 0.15s ease',
                                            }}>
                                                <input type="radio" name="deployService" checked={isSelected}
                                                    onChange={() => setSelectedService(s.class_name)}
                                                    style={{ accentColor: 'var(--secondary)' }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isSelected ? 'var(--secondary)' : 'var(--text-primary)' }}>
                                                        {s.class_name}
                                                        {s.module_path.includes('built-in') && (
                                                            <span className="badge badge-success" style={{ fontSize: '0.5rem', marginLeft: '0.4rem' }}>built-in</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                        {s.docstring || s.description || s.module_path}
                                                    </div>
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Alias & Port */}
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Alias</label>
                                    <select value={alias} onChange={(e) => setAlias(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                        <option value="production">production</option>
                                        <option value="staging">staging</option>
                                        <option value="champion">champion</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Port</label>
                                    <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))}
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => setDrawerOpen(false)}
                                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                                Cancel
                            </button>
                            <button className="btn btn-primary"
                                onClick={handleDeploy}
                                disabled={deploying || !selectedModel || !selectedVersion || !selectedService}
                                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
                                {deploying ? 'Deploying...' : 'Deploy'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
