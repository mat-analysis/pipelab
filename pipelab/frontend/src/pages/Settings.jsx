/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Settings() {
    const [settings, setSettings] = useState({ tracking_uri: '', version: '' })
    const [uri, setUri] = useState('')
    const [msg, setMsg] = useState('')

    useEffect(() => {
        api.getSettings().then((s) => { setSettings(s); setUri(s.tracking_uri) }).catch(() => { })
    }, [])

    const handleSave = async (e) => {
        e.preventDefault()
        const s = await api.updateSettings({ tracking_uri: uri })
        setSettings(s)
        setMsg('Settings saved successfully')
        setTimeout(() => setMsg(''), 3000)
    }

    return (
        <div>
            <h2 className="page-title">Settings</h2>
            <p className="page-subtitle">Configure PipeLab platform settings</p>

            {msg && (
                <div className="card" style={{ marginBottom: '1rem', background: 'var(--accent-muted)', borderColor: 'var(--success)' }}>
                    <p style={{ color: 'var(--success)', fontWeight: 500 }}>{msg}</p>
                </div>
            )}

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><span className="card-title">Platform Info</span></div>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <div>
                        <span className="form-label">Version</span>
                        <p style={{ fontWeight: 600 }}>{settings.version}</p>
                    </div>
                    <div>
                        <span className="form-label">Backend</span>
                        <p style={{ fontWeight: 600 }}>FastAPI + MLflow</p>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header"><span className="card-title">MLflow Configuration</span></div>
                <form onSubmit={handleSave} style={{ display: 'flex', gap: '0.75rem', alignItems: 'end' }}>
                    <div style={{ flex: 1 }}>
                        <label className="form-label">Tracking URI</label>
                        <input className="form-input" value={uri} onChange={(e) => setUri(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btn-primary">Save</button>
                </form>
            </div>
        </div>
    )
}
