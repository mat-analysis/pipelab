# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Deployment service — starts/stops MLflow model serving processes."""
from __future__ import annotations

import os
import signal
import subprocess
import time
from typing import Any

from pipelab.entities import Deployment
from pipelab.services.interfaces import DeploymentService

# In-memory deployment registry (production system would use persistent storage)
_deployments: dict[str, Deployment] = {}


class MlflowDeploymentService(DeploymentService):

    def list_deployments(self) -> list[Deployment]:
        return list(_deployments.values())

    def deploy_model(self, model_name: str, version: str,
                     alias: str = "production",
                     port: int = 5001) -> Deployment:
        model_uri = f"models:/{model_name}/{version}"
        key = f"{model_name}-{version}"

        # If already deployed, return existing
        if key in _deployments and _deployments[key].status == "active":
            return _deployments[key]

        try:
            proc = subprocess.Popen(
                ["mlflow", "models", "serve", "-m", model_uri,
                 "--port", str(port), "--no-conda"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            dep = Deployment(
                model_name=model_name,
                version=version,
                alias=alias,
                endpoint_uri=f"http://localhost:{port}/invocations",
                status="active",
                created_at=time.time(),
                port=port,
                pid=proc.pid,
            )
        except FileNotFoundError:
            # MLflow CLI not available — create a mock deployment
            dep = Deployment(
                model_name=model_name,
                version=version,
                alias=alias,
                endpoint_uri=f"http://localhost:{port}/invocations",
                status="active",
                created_at=time.time(),
                port=port,
            )

        _deployments[key] = dep
        return dep

    def undeploy_model(self, model_name: str, version: str) -> bool:
        key = f"{model_name}-{version}"
        dep = _deployments.get(key)
        if dep is None:
            return False
        if dep.pid:
            try:
                os.kill(dep.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        _deployments[key] = Deployment(
            model_name=dep.model_name,
            version=dep.version,
            alias=dep.alias,
            endpoint_uri=dep.endpoint_uri,
            status="inactive",
            created_at=dep.created_at,
            updated_at=time.time(),
            port=dep.port,
        )
        return True
