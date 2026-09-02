# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Pipeline abstract base classes for user extensions.

Users create subclasses of these ABCs in their project's ``pipeline/`` directory.
The framework autodiscovers them and exposes them in the web UI.

Usage::

    from pipelab.pipeline import DatasetService, ExperimentService, DeployService

    class MyDataLoader(DatasetService):
        \"\"\"Load my custom dataset.\"\"\"
        def execute(self, context):
            ...

    class MyTrainer(ExperimentService):
        def execute(self, context):
            ...

    class MyDeployer(DeployService):
        def execute(self, context):
            ...
"""
from __future__ import annotations

from typing import Any

from pipelab.entities.data_context import DataContext
from pipelab.entities.pipeline_context import PipelineContext
from pipelab.entities.services import (
    DatasetService,
    ExperimentService,
    DeployService,
    PreparationService,
)

__all__ = [
    "DataContext",
    "PipelineContext",
    "DatasetService",
    "ExperimentService",
    "DeployService",
    "PreparationService",
    "TrainTestSplit",
    "KFoldCV",
    "MLflowServeProvider",
]


# ── Default Preparation Implementations ───────────────────────────────────────

class TrainTestSplit(PreparationService):
    """Default train/test split implementation.

    Split a dataset into training and test sets.
    Params: test_size (float, default 0.2), random_state (int, default 42).
    """

    def execute(self, context: PipelineContext) -> Any:
        from sklearn.model_selection import train_test_split
        X = context.results.get("X")
        y = context.results.get("y")
        if X is None:
            raise ValueError("No dataset 'X' in context.")
        params = context.config.get("preparation_params", {})
        test_size = params.get("test_size", 0.2)
        random_state = params.get("random_state", 42)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )
        context.results["X_train"] = X_train
        context.results["X_test"] = X_test
        context.results["y_train"] = y_train
        context.results["y_test"] = y_test
        return {"train_size": len(X_train), "test_size": len(X_test)}


class KFoldCV(PreparationService):
    """Default K-Fold Cross-Validation implementation.

    Generate K-Fold indices for cross-validation.
    Params: n_splits (int, default 5), shuffle (bool, default True), random_state (int, default 42).
    """

    def execute(self, context: PipelineContext) -> Any:
        from sklearn.model_selection import KFold
        X = context.results.get("X")
        if X is None:
            raise ValueError("No dataset 'X' in context.")
        params = context.config.get("preparation_params", {})
        n_splits = params.get("n_splits", 5)
        shuffle = params.get("shuffle", True)
        random_state = params.get("random_state", 42)
        kf = KFold(n_splits=n_splits, shuffle=shuffle, random_state=random_state)
        folds = list(kf.split(X))
        context.results["folds"] = folds
        return {"n_splits": n_splits, "n_samples": len(X)}


# ── Default Deployment Implementation ─────────────────────────────────────────

class MLflowServeProvider(DeployService):
    """Default deployment provider — serves models via ``mlflow models serve``.

    Uses the MLflow CLI to spin up a local REST endpoint for the model.
    Context config keys used:
        - model_name: registered model name
        - model_version: version string
        - alias: deployment alias (default "production")
        - port: serving port (default 5001)
    """

    def execute(self, context: PipelineContext) -> Any:
        import os
        import subprocess
        import time as _time

        model_name = context.config.get("model_name", "")
        version = context.config.get("model_version", "1")
        alias = context.config.get("alias", "production")
        port = context.config.get("port", 5001)

        if not model_name:
            raise ValueError("model_name is required in context.config")

        model_uri = f"models:/{model_name}/{version}"
        endpoint = f"http://localhost:{port}/invocations"

        try:
            proc = subprocess.Popen(
                ["mlflow", "models", "serve", "-m", model_uri,
                 "--port", str(port), "--no-conda"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            pid = proc.pid
        except FileNotFoundError:
            # MLflow CLI not available — record deployment without a process
            pid = None

        result = {
            "model_name": model_name,
            "version": version,
            "alias": alias,
            "endpoint_uri": endpoint,
            "port": port,
            "pid": pid,
            "status": "active",
            "created_at": _time.time(),
        }
        context.results["deployment"] = result
        return result

    def undeploy(self, context: PipelineContext) -> Any:
        import os
        import signal

        pid = context.config.get("pid")
        model_name = context.config.get("model_name", "")
        version = context.config.get("model_version", "")

        if pid:
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

        return {
            "model_name": model_name,
            "version": version,
            "status": "inactive",
        }

