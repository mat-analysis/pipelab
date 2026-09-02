# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Models API router — registry, versions, stage transitions."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import Any

from pipelab.api.app import get_service
from pipelab.api.schemas import (
    ModelRegisterRequest, ModelTransitionRequest,
    ModelRegistryOut,
)

router = APIRouter()


@router.get("/", response_model=list[dict[str, Any]])
async def list_models():
    svc = get_service("models")
    return svc.list_registered_models()


@router.get("/{model_name}/versions", response_model=list[ModelRegistryOut])
async def get_model_versions(model_name: str):
    svc = get_service("models")
    return [ModelRegistryOut(**{k: getattr(v, k) for k in ModelRegistryOut.model_fields})
            for v in svc.get_model_versions(model_name)]


@router.post("/register", response_model=ModelRegistryOut, status_code=201)
async def register_model(body: ModelRegisterRequest):
    svc = get_service("models")
    v = svc.register_model(body.run_id, body.model_name, body.artifact_path)
    return ModelRegistryOut(**{k: getattr(v, k) for k in ModelRegistryOut.model_fields})


@router.put("/{model_name}/versions/{version}/transition", response_model=ModelRegistryOut)
async def transition_stage(model_name: str, version: str, body: ModelTransitionRequest):
    svc = get_service("models")
    v = svc.transition_model_stage(model_name, version, body.stage)
    return ModelRegistryOut(**{k: getattr(v, k) for k in ModelRegistryOut.model_fields})


@router.delete("/{model_name}")
async def delete_model(model_name: str):
    svc = get_service("models")
    if not svc.delete_model(model_name):
        raise HTTPException(404, "Model not found")
    return {"ok": True}
