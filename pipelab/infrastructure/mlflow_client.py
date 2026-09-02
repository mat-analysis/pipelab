# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Thin wrapper around the MLflow Python SDK."""
from __future__ import annotations

import mlflow
from mlflow.tracking import MlflowClient
from mlflow.entities import ViewType

_client: MlflowClient | None = None
_tracking_uri: str = "mlruns"


def configure(tracking_uri: str = "mlruns") -> None:
    """Set the MLflow tracking URI and reset the cached client."""
    global _client, _tracking_uri
    _tracking_uri = tracking_uri
    mlflow.set_tracking_uri(tracking_uri)
    _client = MlflowClient(tracking_uri=tracking_uri)


def get_client() -> MlflowClient:
    """Return the shared MlflowClient, creating it lazily."""
    global _client
    if _client is None:
        configure(_tracking_uri)
    assert _client is not None
    return _client


def get_tracking_uri() -> str:
    return _tracking_uri
