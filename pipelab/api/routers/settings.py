# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Settings API router."""
from __future__ import annotations

from fastapi import APIRouter

from pipelab.infrastructure.mlflow_client import get_tracking_uri, configure
from pipelab.api.schemas import SettingsOut, SettingsUpdate

router = APIRouter()


@router.get("/", response_model=SettingsOut)
async def get_settings():
    return SettingsOut(tracking_uri=get_tracking_uri())


@router.put("/", response_model=SettingsOut)
async def update_settings(body: SettingsUpdate):
    if body.tracking_uri:
        configure(body.tracking_uri)
    return SettingsOut(tracking_uri=get_tracking_uri())
