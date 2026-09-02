# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Pydantic request/response schemas for the REST API."""
from __future__ import annotations

from pydantic import BaseModel
from typing import Any


# --- Projects -----------------------------------------------------------------

class ProjectConfigOut(BaseModel):
    name: str
    path: str
    description: str = ""
    tracking_uri: str = "mlruns"
    pipeline_dir: str = "pipeline"
    service_count: int = 0
    experiments: list[dict] = []


# --- Discovered Services ------------------------------------------------------

class DiscoveredServiceOut(BaseModel):
    class_name: str
    module_path: str
    step_type: str  # 'data' | 'experiment' | 'deployment'
    docstring: str = ""
    project_name: str = ""
    label: str = ""
    description: str = ""
    experiments: list[str] = []  # associated MLflow experiment names


class PipelineStepResultOut(BaseModel):
    step_name: str
    step_type: str
    class_name: str
    status: str = "pending"
    duration_seconds: float | None = None
    error: str | None = None


class PipelineRunResult(BaseModel):
    project_name: str
    status: str = "completed"
    experiment_names: list[str] = []
    steps: list[PipelineStepResultOut] = []


# --- Datasets -----------------------------------------------------------------

class DatasetCreate(BaseModel):
    label: str
    description: str | None = None
    project_id: str | None = None

class DatasetOut(BaseModel):
    id: str
    label: str
    description: str | None = None
    version: str | None = None
    uri: str | None = None
    metadata: dict[str, Any] = {}

class DatasetVersionCreate(BaseModel):
    version: str
    uri: str | None = None
    metadata: dict[str, Any] = {}

class DatasetVersionOut(BaseModel):
    dataset_id: str
    version: str
    uri: str | None = None
    description: str | None = None
    metadata: dict[str, Any] = {}
    created_at: float | None = None

class DataSplitCreate(BaseModel):
    name: str
    method: str = "train_test"
    params: dict[str, Any] = {}

class DataSplitOut(BaseModel):
    name: str
    dataset_id: str | None = None
    split_method: str | None = None
    split_params: dict[str, Any] = {}


# --- Experiments --------------------------------------------------------------

class ExperimentCreate(BaseModel):
    name: str
    project_id: str | None = None
    description: str | None = None

class ExperimentOut(BaseModel):
    name: str
    experiment_id: str | None = None
    description: str | None = None
    project_id: str | None = None

class RunOut(BaseModel):
    run_id: str
    experiment_name: str
    name: str | None = None
    status: str = "running"
    timestamp: float | None = None
    parameters: dict[str, Any] = {}
    metrics: dict[str, float] = {}
    tags: dict[str, str] = {}
    artifacts: list[str] = []
    model_uri: str | None = None

class CompareRequest(BaseModel):
    run_ids: list[str]


# --- Models -------------------------------------------------------------------

class ModelRegisterRequest(BaseModel):
    run_id: str
    model_name: str
    artifact_path: str = "model"

class ModelTransitionRequest(BaseModel):
    stage: str   # 'candidate' | 'approved' | 'production' | 'archived'

class ModelRegistryOut(BaseModel):
    model_name: str
    version: int | str
    source: str | None = None
    run_id: str | None = None
    status: str = "candidate"
    description: str | None = None
    created_at: float | None = None
    updated_at: float | None = None
    tags: dict[str, str] = {}


# --- Pipelines ----------------------------------------------------------------

class PipelineCreate(BaseModel):
    name: str
    steps: list[str]
    project_id: str | None = None
    description: str | None = None

class PipelineOut(BaseModel):
    id: str
    name: str
    project_id: str | None = None
    description: str | None = None
    steps: list[str] = []
    status: str = "idle"
    created_at: float | None = None


# --- Deployments --------------------------------------------------------------

class DeployRequest(BaseModel):
    project_name: str
    model_name: str
    version: str
    deploy_service: str = "MLflowServeProvider"
    alias: str = "production"
    port: int = 5001

class DeploymentOut(BaseModel):
    model_name: str
    version: str
    alias: str
    deploy_service: str = ""
    endpoint_uri: str | None = None
    status: str = "active"
    created_at: float | None = None
    port: int | None = None
    pid: int | None = None


# --- Monitoring & Alerts ------------------------------------------------------

class MonitoringRecordOut(BaseModel):
    deployment_id: str
    timestamp: float
    prediction_count: int = 0
    avg_latency_ms: float | None = None
    drift_score: float | None = None

class AlertCreate(BaseModel):
    severity: str
    message: str
    metric_key: str | None = None
    threshold: float | None = None

class AlertOut(BaseModel):
    id: str
    severity: str
    message: str
    metric_key: str | None = None
    threshold: float | None = None
    triggered_at: float | None = None
    resolved: bool = False


# --- Settings -----------------------------------------------------------------

class SettingsOut(BaseModel):
    tracking_uri: str
    version: str = "0.1.0"

class SettingsUpdate(BaseModel):
    tracking_uri: str | None = None
