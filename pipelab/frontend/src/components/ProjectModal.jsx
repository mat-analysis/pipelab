/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useState } from 'react'
import { api } from '../api'

export default function ProjectModal({ project, onClose, onSaved }) {
    const isEdit = !!project
    const [name, setName] = useState(project?.name || '')
    const [description, setDescription] = useState(project?.description || '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!name.trim()) { setError('Name is required'); return }
        setSaving(true)
        setError('')
        try {
            if (isEdit) {
                await api.updateProject(project.name, { name, description })
            } else {
                await api.createProject(name, description)
            }
            onSaved?.()
            onClose()
        } catch (err) {
            setError(err.message || 'Failed to save')
        }
        setSaving(false)
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="card-title">{isEdit ? 'Edit Project' : 'Create Project'}</h3>
                    <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: '1.2rem' }}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Name</label>
                        <input className="form-input" value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="my-project"
                            disabled={isEdit}
                        />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Description</label>
                        <input className="form-input" value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Project description"
                        />
                    </div>
                    {isEdit && project?.path && (
                        <div style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Path</label>
                            <input className="form-input" value={project.path} disabled
                                style={{ opacity: 0.6, cursor: 'not-allowed' }}
                            />
                        </div>
                    )}
                    {error && <p style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '0.85rem' }}>{error}</p>}
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Project')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
