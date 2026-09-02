/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useProject } from '../context/ProjectContext'
import Sidebar from './Sidebar'

const breadcrumbMap = {
    '/': 'Projects',
    '/projects': 'Projects',
    '/dashboard': 'Dashboard',
    '/data/ingestion': 'ETL › Data Providers',
    '/data/preparation': 'ETL › Preparation',
    '/data/eda': 'ETL › EDA',
    '/experiments/train': 'Experiment › Model Providers',
    '/pipelines': 'Experiment › Train Pipeline',
    '/experiments/benchmark': 'Experiment › Benchmark',
    //'/governance/selection': 'Governance › Selection',
    '/governance/registry': 'Governance › Model Registry',
    '/governance/deployment': 'Governance › Deployment Providers',
    '/governance/test-endpoint': 'Governance › Test Endpoint',
    '/governance/monitoring': 'Governance › Monitoring Adapters',
    '/governance/alerts': 'Governance › Lab Alerts',
    '/settings': 'Settings',
}

function getInitialTheme() {
    const saved = localStorage.getItem('pipelab-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return 'light'
}

export default function Layout() {
    const [collapsed, setCollapsed] = useState(false)
    const [theme, setTheme] = useState(getInitialTheme)
    const location = useLocation()
    const navigate = useNavigate()
    const crumb = breadcrumbMap[location.pathname] || 'PipeLab'
    const { selectedProject } = useProject()

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('pipelab-theme', theme)
    }, [theme])

    const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

    return (
        <div className="app-layout">
            <Sidebar
                collapsed={collapsed}
                theme={theme}
                onToggleTheme={toggleTheme}
            />
            <div className="main-content">
                <div className="topbar">
                    <button className="toggle-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                        {collapsed ? '»' : '«'}
                    </button>
                    <span className="breadcrumb">{crumb}</span>
                    {selectedProject && (
                        <span className="project-indicator"
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate('/projects')}
                            title="Click to change project">
                            📁 {selectedProject}
                        </span>
                    )}
                </div>
                <div className="page-content">
                    <Outlet />
                </div>
            </div>
        </div>
    )
}
