/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api'

const ProjectContext = createContext(null)

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? decodeURIComponent(match[2]) : null
}

function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 86400000).toUTCString()
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

export function ProjectProvider({ children }) {
    const [projects, setProjects] = useState([])
    const [selectedProject, setSelectedProject] = useState(getCookie('pipelab-project') || '')
    const [loading, setLoading] = useState(true)

    const fetchProjects = async () => {
        try {
            const list = await api.listProjects()
            setProjects(list)
            // If saved project no longer exists, clear selection
            if (selectedProject && !list.find((p) => p.name === selectedProject)) {
                setSelectedProject('')
                setCookie('pipelab-project', '')
            }
        } catch {
            setProjects([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchProjects() }, [])

    const selectProject = (name) => {
        setSelectedProject(name)
        setCookie('pipelab-project', name)
    }

    const refresh = async () => {
        await api.refreshDiscovery()
        await fetchProjects()
    }

    return (
        <ProjectContext.Provider value={{
            projects, selectedProject, selectProject,
            refresh, loading,
        }}>
            {children}
        </ProjectContext.Provider>
    )
}

export function useProject() {
    const ctx = useContext(ProjectContext)
    if (!ctx) throw new Error('useProject must be used within ProjectProvider')
    return ctx
}
