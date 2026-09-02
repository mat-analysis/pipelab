# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Model registry service backed by MLflow Model Registry."""
from __future__ import annotations

import time
from typing import Any

from pipelab.entities import ModelRegistry
from pipelab.infrastructure.mlflow_client import get_client
from pipelab.services.interfaces import ModelRegistryService

# Maps MLflow stages to pipelab status
_STAGE_TO_STATUS = {
    "None": "candidate",
    "Staging": "candidate",
    "Production": "production",
    "Archived": "archived",
}


class MlflowModelRegistryService(ModelRegistryService):

    def list_registered_models(self) -> list[dict[str, Any]]:
        client = get_client()
        models = client.search_registered_models()
        return [
            {
                "name": m.name,
                "description": m.description,
                "latest_versions": [
                    {"version": v.version, "status": _STAGE_TO_STATUS.get(v.current_stage, v.current_stage),
                     "run_id": v.run_id, "source": v.source}
                    for v in (m.latest_versions or [])
                ],
                "tags": dict(m.tags) if m.tags else {},
            }
            for m in models
        ]

    def get_model_versions(self, model_name: str) -> list[ModelRegistry]:
        client = get_client()
        try:
            versions = client.search_model_versions(f"name='{model_name}'")
        except Exception:
            return []
        return [
            ModelRegistry(
                model_name=model_name,
                version=int(v.version),
                source=v.source,
                run_id=v.run_id,
                status=_STAGE_TO_STATUS.get(v.current_stage, v.current_stage),
                description=v.description,
                created_at=v.creation_timestamp / 1000.0 if v.creation_timestamp else None,
                updated_at=v.last_updated_timestamp / 1000.0 if v.last_updated_timestamp else None,
                tags=dict(v.tags) if v.tags else {},
            )
            for v in versions
        ]

    def register_model(self, run_id: str, model_name: str,
                       artifact_path: str = "model") -> ModelRegistry:
        import mlflow
        model_uri = f"runs:/{run_id}/{artifact_path}"
        result = mlflow.register_model(model_uri=model_uri, name=model_name)
        return ModelRegistry(
            model_name=model_name,
            version=int(result.version),
            source=result.source,
            run_id=run_id,
            status="candidate",
            created_at=time.time(),
        )

    def transition_model_stage(self, model_name: str, version: int | str,
                               stage: str) -> ModelRegistry:
        client = get_client()
        mlf_stage_map = {
            "candidate": "Staging",
            "approved": "Staging",
            "production": "Production",
            "archived": "Archived",
        }
        mlf_stage = mlf_stage_map.get(stage, "None")
        client.transition_model_version_stage(
            name=model_name, version=str(version), stage=mlf_stage,
        )
        versions = self.get_model_versions(model_name)
        for v in versions:
            if str(v.version) == str(version):
                return v
        return ModelRegistry(model_name=model_name, version=int(version),
                             status=stage, updated_at=time.time())

    def delete_model(self, model_name: str) -> bool:
        client = get_client()
        try:
            client.delete_registered_model(name=model_name)
            return True
        except Exception:
            return False
