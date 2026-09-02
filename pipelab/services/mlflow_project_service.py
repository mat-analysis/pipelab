# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Project service backed by MLflow experiments with tags."""
from __future__ import annotations

import uuid
from typing import Any

import mlflow

from pipelab.entities import Project
from pipelab.infrastructure.mlflow_client import get_client
from pipelab.services.interfaces import ProjectService

_TAG_PREFIX = "pipelab."
_PROJECT_TAG = f"{_TAG_PREFIX}project_id"


class MlflowProjectService(ProjectService):

    def list_projects(self) -> list[Project]:
        client = get_client()
        experiments = client.search_experiments(view_type=mlflow.entities.ViewType.ACTIVE_ONLY)
        seen: dict[str, Project] = {}
        for exp in experiments:
            pid = (exp.tags or {}).get(_PROJECT_TAG)
            if pid and pid not in seen:
                seen[pid] = Project(
                    id=pid,
                    name=(exp.tags or {}).get(f"{_TAG_PREFIX}project_name", exp.name),
                    description=(exp.tags or {}).get(f"{_TAG_PREFIX}project_desc"),
                )
        return list(seen.values())

    def get_project(self, project_id: str) -> Project | None:
        for p in self.list_projects():
            if p.id == project_id:
                return p
        return None

    def create_project(self, name: str, description: str | None = None) -> Project:
        project_id = uuid.uuid4().hex[:12]
        client = get_client()
        exp = client.create_experiment(
            name=f"pipelab-{name}",
            tags={
                _PROJECT_TAG: project_id,
                f"{_TAG_PREFIX}project_name": name,
                f"{_TAG_PREFIX}project_desc": description or "",
            },
        )
        return Project(id=project_id, name=name, description=description)

    def delete_project(self, project_id: str) -> bool:
        client = get_client()
        experiments = client.search_experiments(view_type=mlflow.entities.ViewType.ACTIVE_ONLY)
        deleted = False
        for exp in experiments:
            if (exp.tags or {}).get(_PROJECT_TAG) == project_id:
                client.delete_experiment(exp.experiment_id)
                deleted = True
        return deleted
