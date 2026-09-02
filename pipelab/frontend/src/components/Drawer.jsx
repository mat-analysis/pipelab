/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { useEffect, useRef } from 'react'

/**
 * Reusable Drawer component that slides in from the right.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - title: string
 *  - width: string (default '480px')
 *  - children: ReactNode
 */
export default function Drawer({ open, onClose, title, width = '480px', children }) {
    const drawerRef = useRef(null)

    // Close on Escape key
    useEffect(() => {
        if (!open) return
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open, onClose])

    if (!open) return null

    return (
        <div className="drawer-overlay" onClick={onClose}>
            <div
                ref={drawerRef}
                className="drawer-panel"
                style={{ width }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="drawer-header">
                    <h3 className="card-title">{title}</h3>
                    <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: '1.2rem', padding: '0.25rem 0.5rem' }}>✕</button>
                </div>
                <div className="drawer-body">
                    {children}
                </div>
            </div>
        </div>
    )
}
