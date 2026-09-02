# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Experiment/run service backed by MLflow."""
from __future__ import annotations

from typing import Any

import mlflow
from mlflow.entities import ViewType

from pipelab.entities import Experiment, Run
from pipelab.infrastructure.mlflow_client import get_client
from pipelab.services.interfaces import ExperimentService


class MlflowExperimentService(ExperimentService):

    def list_experiments(self, project_id: str | None = None) -> list[Experiment]:
        client = get_client()
        experiments = client.search_experiments(view_type=ViewType.ACTIVE_ONLY)
        result: list[Experiment] = []
        for exp in experiments:
            tags = exp.tags or {}
            if project_id and tags.get("pipelab.project_id") != project_id:
                continue
            result.append(Experiment(
                name=exp.name,
                experiment_id=exp.experiment_id,
                description=tags.get("mlflow.note.content"),
                project_id=tags.get("pipelab.project_id"),
            ))
        return result

    def get_experiment(self, name: str) -> Experiment | None:
        client = get_client()
        exp = client.get_experiment_by_name(name)
        if exp is None:
            return None
        tags = exp.tags or {}
        return Experiment(
            name=exp.name,
            experiment_id=exp.experiment_id,
            description=tags.get("mlflow.note.content"),
            project_id=tags.get("pipelab.project_id"),
        )

    def create_experiment(self, name: str, project_id: str | None = None,
                          description: str | None = None) -> Experiment:
        client = get_client()
        tags: dict[str, str] = {}
        if project_id:
            tags["pipelab.project_id"] = project_id
        if description:
            tags["mlflow.note.content"] = description
        exp_id = client.create_experiment(name, tags=tags)
        return Experiment(name=name, experiment_id=exp_id,
                          description=description, project_id=project_id)

    def delete_experiment(self, name: str) -> bool:
        client = get_client()
        exp = client.get_experiment_by_name(name)
        if exp is None:
            return False
        client.delete_experiment(exp.experiment_id)
        return True

    # Runs ---------------------------------------------------------------------

    def list_runs(self, experiment_name: str) -> list[Run]:
        client = get_client()
        exp = client.get_experiment_by_name(experiment_name)
        if exp is None:
            return []
        mlf_runs = client.search_runs(
            experiment_ids=[exp.experiment_id],
            order_by=["start_time DESC"],
            max_results=200,
        )
        return [self._convert_run(r, experiment_name) for r in mlf_runs]

    def get_run(self, run_id: str) -> Run | None:
        client = get_client()
        try:
            r = client.get_run(run_id)
        except Exception:
            return None
        exp = client.get_experiment(r.info.experiment_id)
        return self._convert_run(r, exp.name)

    def get_run_artifacts(self, run_id: str) -> list[dict[str, Any]]:
        client = get_client()
        artifacts = client.list_artifacts(run_id)
        return [{"path": a.path, "is_dir": a.is_dir,
                 "file_size": a.file_size} for a in artifacts]

    def compare_runs(self, run_ids: list[str]) -> list[Run]:
        return [r for rid in run_ids if (r := self.get_run(rid)) is not None]

    # Helpers ------------------------------------------------------------------

    @staticmethod
    def _convert_run(r: Any, experiment_name: str) -> Run:
        info = r.info
        data = r.data
        status_map = {"RUNNING": "running", "FINISHED": "finished",
                      "FAILED": "failed", "KILLED": "failed"}
        return Run(
            run_id=info.run_id,
            experiment_name=experiment_name,
            name=data.tags.get("mlflow.runName"),
            timestamp=info.start_time / 1000.0 if info.start_time else None,
            status=status_map.get(info.status, info.status),
            parameters=dict(data.params),
            metrics=dict(data.metrics),
            tags=dict(data.tags),
            artifacts=[],
            model_uri=data.tags.get("mlflow.log-model.history"),
        )
