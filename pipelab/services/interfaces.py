# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Abstract service interfaces defining the domain contracts."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pipelab.entities import (
    Project, Dataset, DatasetVersion, DataSplit,
    Experiment, Run, Model, ModelRegistry,
    Deployment, Alert, MonitoringRecord, Pipeline,
)


class ProjectService(ABC):
    """Manage projects (workspaces)."""

    @abstractmethod
    def list_projects(self) -> list[Project]:
        ...

    @abstractmethod
    def get_project(self, project_id: str) -> Project | None:
        ...

    @abstractmethod
    def create_project(self, name: str, description: str | None = None) -> Project:
        ...

    @abstractmethod
    def delete_project(self, project_id: str) -> bool:
        ...


class DatasetService(ABC):
    """Manage datasets, versioning, and splits."""

    @abstractmethod
    def list_datasets(self, project_id: str | None = None) -> list[Dataset]:
        ...

    @abstractmethod
    def get_dataset(self, dataset_id: str) -> Dataset | None:
        ...

    @abstractmethod
    def create_dataset(self, label: str, description: str | None = None,
                       project_id: str | None = None) -> Dataset:
        ...

    @abstractmethod
    def delete_dataset(self, dataset_id: str) -> bool:
        ...

    # Versioning
    @abstractmethod
    def create_version(self, dataset_id: str, version: str,
                       uri: str | None = None,
                       metadata: dict[str, Any] | None = None) -> DatasetVersion:
        ...

    @abstractmethod
    def list_versions(self, dataset_id: str) -> list[DatasetVersion]:
        ...

    # Splits
    @abstractmethod
    def create_split(self, dataset_id: str, name: str,
                     method: str = "train_test",
                     params: dict[str, Any] | None = None) -> DataSplit:
        ...

    @abstractmethod
    def list_splits(self, dataset_id: str) -> list[DataSplit]:
        ...


class ExperimentService(ABC):
    """Manage experiments and training runs."""

    @abstractmethod
    def list_experiments(self, project_id: str | None = None) -> list[Experiment]:
        ...

    @abstractmethod
    def get_experiment(self, name: str) -> Experiment | None:
        ...

    @abstractmethod
    def create_experiment(self, name: str, project_id: str | None = None,
                          description: str | None = None) -> Experiment:
        ...

    @abstractmethod
    def delete_experiment(self, name: str) -> bool:
        ...

    # Runs
    @abstractmethod
    def list_runs(self, experiment_name: str) -> list[Run]:
        ...

    @abstractmethod
    def get_run(self, run_id: str) -> Run | None:
        ...

    @abstractmethod
    def get_run_artifacts(self, run_id: str) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    def compare_runs(self, run_ids: list[str]) -> list[Run]:
        ...


class ModelRegistryService(ABC):
    """Manage model registry: register, version, transition stages."""

    @abstractmethod
    def list_registered_models(self) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    def get_model_versions(self, model_name: str) -> list[ModelRegistry]:
        ...

    @abstractmethod
    def register_model(self, run_id: str, model_name: str,
                       artifact_path: str = "model") -> ModelRegistry:
        ...

    @abstractmethod
    def transition_model_stage(self, model_name: str, version: int | str,
                               stage: str) -> ModelRegistry:
        ...

    @abstractmethod
    def delete_model(self, model_name: str) -> bool:
        ...


class DeploymentService(ABC):
    """Deploy and manage model serving endpoints."""

    @abstractmethod
    def list_deployments(self) -> list[Deployment]:
        ...

    @abstractmethod
    def deploy_model(self, model_name: str, version: str,
                     alias: str = "production",
                     port: int = 5001) -> Deployment:
        ...

    @abstractmethod
    def undeploy_model(self, model_name: str, version: str) -> bool:
        ...


class MonitoringService(ABC):
    """Track deployed model metrics and drift."""

    @abstractmethod
    def list_records(self, deployment_id: str,
                     limit: int = 100) -> list[MonitoringRecord]:
        ...

    @abstractmethod
    def record_prediction(self, deployment_id: str,
                          latency_ms: float,
                          metadata: dict[str, Any] | None = None) -> None:
        ...

    @abstractmethod
    def list_alerts(self, resolved: bool | None = None) -> list[Alert]:
        ...

    @abstractmethod
    def create_alert(self, severity: str, message: str,
                     metric_key: str | None = None,
                     threshold: float | None = None) -> Alert:
        ...

    @abstractmethod
    def resolve_alert(self, alert_id: str) -> bool:
        ...


class PipelineService(ABC):
    """Manage pipeline definitions and execution history."""

    @abstractmethod
    def list_pipelines(self, project_id: str | None = None) -> list[Pipeline]:
        ...

    @abstractmethod
    def get_pipeline(self, pipeline_id: str) -> Pipeline | None:
        ...

    @abstractmethod
    def create_pipeline(self, name: str, steps: list[str],
                        project_id: str | None = None,
                        description: str | None = None) -> Pipeline:
        ...

    @abstractmethod
    def delete_pipeline(self, pipeline_id: str) -> bool:
        ...

    @abstractmethod
    def run_pipeline(self, pipeline_id: str) -> Pipeline:
        ...
