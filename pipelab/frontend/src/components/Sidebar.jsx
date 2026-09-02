/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { NavLink, useLocation } from 'react-router-dom'

const sections = [
    {
        title: 'Overview',
        items: [
            { label: 'Projects', path: '/projects', icon: '📁' },
            { label: 'Dashboard', path: '/dashboard', icon: '📊' },
        ],
    },
    {
        title: 'ETL',
        items: [
            { label: 'Data Providers', path: '/data/ingestion', icon: '📥' },
            { label: 'Preparation', path: '/data/preparation', icon: '🔧' },
        ],
    },
    {
        title: 'Experiment',
        items: [
            { label: 'Model Providers', path: '/experiments/train', icon: '🔌' },
            { label: 'Train Pipeline', path: '/pipelines', icon: '🧪' },
            { label: 'Benchmark', path: '/experiments/benchmark', icon: '📈' },
        ],
    },
    {
        title: 'Governance',
        items: [
            // { label: 'Selection', path: '/governance/selection', icon: '✅' },
            { label: 'Model Registry', path: '/governance/registry', icon: '📦' },
            { label: 'Deployment Providers', path: '/governance/deployment', icon: '🚀' },
            { label: 'Test Endpoint', path: '/governance/test-endpoint', icon: '📡' },
            { label: 'Monitoring Adapters', path: '/governance/monitoring', icon: '🖥️' },
            { label: 'Lab Alerts', path: '/governance/alerts', icon: '🔔' },
        ],
    },
    {
        title: 'System',
        items: [
            { label: 'Settings', path: '/settings', icon: '⚙️' },
        ],
    },
]

export default function Sidebar({ collapsed, theme, onToggleTheme }) {
    return (
        <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
            <div className="sidebar-header">
                <img className="logo" src="/favicon.svg" alt="PipeLab" />
                <h1>PipeLab</h1>
            </div>
            <nav className="sidebar-nav">
                {sections.map((section) => (
                    <div className="nav-section" key={section.title}>
                        <div className="nav-section-title">{section.title}</div>
                        {section.items.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `nav-item${isActive ? ' active' : ''}`
                                }
                                end={item.path === '/projects'}
                                title={collapsed ? item.label : undefined}
                            >
                                <span className="icon">{item.icon}</span>
                                <span className="nav-label">{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>
            <div className="sidebar-footer">
                <button className="theme-toggle-btn" onClick={onToggleTheme} title={collapsed ? (theme === 'light' ? 'Dark mode' : 'Light mode') : undefined}>
                    <span className="icon">{theme === 'light' ? '🌙' : '☀️'}</span>
                    <span className="nav-label">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
                </button>
            </div>
        </aside>
    )
}
