/* Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br> */
/* Licensed under the Apache License, Version 2.0. */

const BASE = '/api/v1'

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(err)
    }
    return res.json()
}

export const api = {
    // Projects (discovered from workdir)
    listProjects: () => request('/projects/'),
    getProject: (name) => request(`/projects/${name}`),
    createProject: (name, description) =>
        request('/projects/', {
            method: 'POST',
            body: JSON.stringify({ name, description }),
        }),
    updateProject: (name, data) =>
        request(`/projects/${name}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Discovered pipeline services
    listServices: (project) =>
        request(`/pipelines/services${project ? `?project=${project}` : ''}`),

    // Pipeline execution
    runPipeline: (projectName, dataServices, experimentServices, deployServices, datasetConfigName) =>
        request('/pipelines/run', {
            method: 'POST',
            body: JSON.stringify({
                project_name: projectName,
                data_services: dataServices,
                experiment_services: experimentServices,
                deploy_services: deployServices,
                dataset_config_name: datasetConfigName || null,
            }),
        }),

    // Register service metadata in YAML
    registerMeta: (projectName, serviceType, metadata) =>
        request('/pipelines/register-meta', {
            method: 'POST',
            body: JSON.stringify({
                project_name: projectName,
                service_type: serviceType,
                metadata,
            }),
        }),

    // Refresh discovery
    refreshDiscovery: () => request('/pipelines/refresh', { method: 'POST' }),

    // Update service metadata in project YAML
    updateServiceMeta: (projectName, className, label, description, experiments) =>
        request('/pipelines/services/meta', {
            method: 'PUT',
            body: JSON.stringify({
                project_name: projectName,
                class_name: className,
                label,
                description,
                ...(experiments !== undefined ? { experiments } : {}),
            }),
        }),

    // Dataset configurations (stored in project YAML)
    listDatasetConfigs: (project) =>
        request(`/pipelines/dataset-configs?project=${project}`),
    createDatasetConfig: (projectName, name, description, dataService, prepMethod, prepParams) =>
        request('/pipelines/dataset-configs', {
            method: 'POST',
            body: JSON.stringify({
                project_name: projectName,
                name,
                description,
                data_service: dataService,
                preparation_method: prepMethod,
                preparation_params: prepParams,
            }),
        }),
    deleteDatasetConfig: (project, index) =>
        request(`/pipelines/dataset-configs/${index}?project=${project}`, { method: 'DELETE' }),

    // EDA — load dataset and get analysis data
    edaLoadDataset: (projectName, dataService) =>
        request('/pipelines/eda/load', {
            method: 'POST',
            body: JSON.stringify({ project_name: projectName, data_service: dataService }),
        }),

    // Datasets
    listDatasets: (projectId) =>
        request(`/datasets/${projectId ? `?project_id=${projectId}` : ''}`),
    createDataset: (label, description, projectId) =>
        request('/datasets/', {
            method: 'POST',
            body: JSON.stringify({ label, description, project_id: projectId }),
        }),
    getVersions: (datasetId) => request(`/datasets/${datasetId}/versions`),
    createVersion: (datasetId, version, uri, metadata) =>
        request(`/datasets/${datasetId}/versions`, {
            method: 'POST',
            body: JSON.stringify({ version, uri, metadata }),
        }),
    getSplits: (datasetId) => request(`/datasets/${datasetId}/splits`),
    createSplit: (datasetId, name, method, params) =>
        request(`/datasets/${datasetId}/splits`, {
            method: 'POST',
            body: JSON.stringify({ name, method, params }),
        }),

    // Experiments (MLflow)
    listExperiments: () => request('/experiments/'),
    createExperiment: (name, projectId, description) =>
        request('/experiments/', {
            method: 'POST',
            body: JSON.stringify({ name, project_id: projectId, description }),
        }),
    listRuns: (experimentName) => request(`/experiments/${experimentName}/runs`),
    getRun: (runId) => request(`/experiments/runs/${runId}`),
    getRunArtifacts: (runId) => request(`/experiments/runs/${runId}/artifacts`),
    compareRuns: (runIds) =>
        request('/experiments/compare', {
            method: 'POST',
            body: JSON.stringify({ run_ids: runIds }),
        }),
    benchmarkModels: (experimentNames) =>
        request('/experiments/benchmark', {
            method: 'POST',
            body: JSON.stringify({ experiment_names: experimentNames }),
        }),

    // Models (MLflow registry)
    listModels: () => request('/models/'),
    getModelVersions: (modelName) => request(`/models/${modelName}/versions`),
    registerModel: (runId, modelName, artifactPath) =>
        request('/models/register', {
            method: 'POST',
            body: JSON.stringify({ run_id: runId, model_name: modelName, artifact_path: artifactPath }),
        }),
    transitionStage: (modelName, version, stage) =>
        request(`/models/${modelName}/versions/${version}/transition`, {
            method: 'PUT',
            body: JSON.stringify({ stage }),
        }),
    deleteModel: (modelName) =>
        request(`/models/${modelName}`, { method: 'DELETE' }),

    // Deployments
    listDeployments: () => request('/deployments/'),
    deployModel: (projectName, modelName, version, deployService, alias, port) =>
        request('/deployments/', {
            method: 'POST',
            body: JSON.stringify({
                project_name: projectName,
                model_name: modelName,
                version: String(version),
                deploy_service: deployService || 'MLflowServeProvider',
                alias: alias || 'production',
                port: port || 5001,
            }),
        }),
    undeployModel: (modelName, version, project) =>
        request(`/deployments/${modelName}/${version}${project ? `?project=${project}` : ''}`, { method: 'DELETE' }),
    testEndpoint: (endpointUri, payload, contentType) =>
        request('/deployments/test-endpoint', {
            method: 'POST',
            body: JSON.stringify({
                endpoint_uri: endpointUri,
                payload,
                content_type: contentType || 'application/json',
            }),
        }),

    // Monitoring
    listRecords: (deploymentId, limit) =>
        request(`/monitoring/${deploymentId}/records?limit=${limit || 100}`),
    listAlerts: () => request('/monitoring/alerts'),
    createAlert: (severity, message, metricKey, threshold) =>
        request('/monitoring/alerts', {
            method: 'POST',
            body: JSON.stringify({ severity, message, metric_key: metricKey, threshold }),
        }),
    resolveAlert: (alertId) =>
        request(`/monitoring/alerts/${alertId}/resolve`, { method: 'PUT' }),

    // Settings
    getSettings: () => request('/settings/'),
    updateSettings: (trackingUri) =>
        request('/settings/', {
            method: 'PUT',
            body: JSON.stringify({ tracking_uri: trackingUri }),
        }),
}
