/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import ProjectModal from '../components/ProjectModal'

export default function Projects() {
    const { projects, selectedProject, selectProject, refresh } = useProject()
    const [showModal, setShowModal] = useState(false)
    const [editProject, setEditProject] = useState(null)
    const navigate = useNavigate()

    const handleSelect = (name) => {
        selectProject(name)
        navigate('/dashboard')
    }

    const openCreate = () => { setEditProject(null); setShowModal(true) }
    const openEdit = (p, e) => { e.stopPropagation(); setEditProject(p); setShowModal(true) }

    return (
        <div>
            <h2 className="page-title">Projects</h2>
            <p className="page-subtitle">Select a project to work with</p>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                    <span className="card-title">All Projects</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-primary" onClick={openCreate}>＋ New Project</button>
                        <button className="btn btn-ghost" onClick={refresh}>🔄 Refresh</button>
                    </div>
                </div>
                {projects.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📁</div>
                        <p>No projects found</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                            Click <strong>＋ New Project</strong> or run <code>pipelab init my-project</code>
                        </p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr><th></th><th>Name</th><th>Description</th><th>Services</th><th>Path</th><th></th></tr>
                        </thead>
                        <tbody>
                            {projects.map((p) => (
                                <tr key={p.name}
                                    style={{
                                        cursor: 'pointer',
                                        background: selectedProject === p.name ? 'var(--accent-alpha, rgba(110,89,255,0.08))' : undefined,
                                    }}
                                    onClick={() => handleSelect(p.name)}>
                                    <td style={{ width: '1.5rem', textAlign: 'center' }}>
                                        {selectedProject === p.name && <span style={{ color: 'var(--highlight)', fontSize: '1.1rem' }}>●</span>}
                                    </td>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                                    <td>{p.description || '—'}</td>
                                    <td><span className="badge badge-info">{p.service_count} services</span></td>
                                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{p.path}</td>
                                    <td>
                                        <button className="btn btn-ghost" onClick={(e) => openEdit(p, e)}
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>✏️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <ProjectModal
                    project={editProject}
                    onClose={() => setShowModal(false)}
                    onSaved={refresh}
                />
            )}
        </div>
    )
}
