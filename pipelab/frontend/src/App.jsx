/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

import { Routes, Route, Navigate } from 'react-router-dom'
import { ProjectProvider } from './context/ProjectContext'
import Layout from './components/Layout'
import Projects from './pages/Projects'
import Dashboard from './pages/Dashboard'
import DataIngestion from './pages/DataIngestion'
import DataPreparation from './pages/DataPreparation'
import ExperimentTrain from './pages/ExperimentTrain'
import ExperimentBenchmark from './pages/ExperimentBenchmark'
import GovernanceSelection from './pages/GovernanceSelection'
import GovernanceRegistry from './pages/GovernanceRegistry'
import GovernanceDeployment from './pages/GovernanceDeployment'
import GovernanceTestEndpoint from './pages/GovernanceTestEndpoint'
import GovernanceMonitoring from './pages/GovernanceMonitoring'
import GovernanceAlerts from './pages/GovernanceAlerts'
import Pipelines from './pages/Pipelines'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ProjectProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<Projects />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="data/ingestion" element={<DataIngestion />} />
          <Route path="data/preparation" element={<DataPreparation />} />
          <Route path="experiments/train" element={<ExperimentTrain />} />
          <Route path="experiments/benchmark" element={<ExperimentBenchmark />} />
          <Route path="governance/selection" element={<GovernanceSelection />} />
          <Route path="governance/registry" element={<GovernanceRegistry />} />
          <Route path="governance/deployment" element={<GovernanceDeployment />} />
          <Route path="governance/test-endpoint" element={<GovernanceTestEndpoint />} />
          <Route path="governance/monitoring" element={<GovernanceMonitoring />} />
          <Route path="governance/alerts" element={<GovernanceAlerts />} />
          <Route path="pipelines" element={<Pipelines />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </ProjectProvider>
  )
}
