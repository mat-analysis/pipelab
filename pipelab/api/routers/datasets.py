# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Datasets API router — CRUD, versioning, splits."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from pipelab.api.app import get_service
from pipelab.api.schemas import (
    DatasetCreate, DatasetOut,
    DatasetVersionCreate, DatasetVersionOut,
    DataSplitCreate, DataSplitOut,
)

router = APIRouter()


@router.get("/", response_model=list[DatasetOut])
async def list_datasets(project_id: str | None = None):
    svc = get_service("datasets")
    return [DatasetOut(**{k: getattr(d, k) for k in DatasetOut.model_fields})
            for d in svc.list_datasets(project_id)]


@router.get("/{dataset_id}", response_model=DatasetOut)
async def get_dataset(dataset_id: str):
    svc = get_service("datasets")
    d = svc.get_dataset(dataset_id)
    if d is None:
        raise HTTPException(404, "Dataset not found")
    return DatasetOut(**{k: getattr(d, k) for k in DatasetOut.model_fields})


@router.post("/", response_model=DatasetOut, status_code=201)
async def create_dataset(body: DatasetCreate):
    svc = get_service("datasets")
    d = svc.create_dataset(body.label, body.description, body.project_id)
    return DatasetOut(**{k: getattr(d, k) for k in DatasetOut.model_fields})


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str):
    svc = get_service("datasets")
    if not svc.delete_dataset(dataset_id):
        raise HTTPException(404, "Dataset not found")
    return {"ok": True}


# --- Versions -----------------------------------------------------------------

@router.get("/{dataset_id}/versions", response_model=list[DatasetVersionOut])
async def list_versions(dataset_id: str):
    svc = get_service("datasets")
    return [DatasetVersionOut(**{k: getattr(v, k) for k in DatasetVersionOut.model_fields})
            for v in svc.list_versions(dataset_id)]


@router.post("/{dataset_id}/versions", response_model=DatasetVersionOut, status_code=201)
async def create_version(dataset_id: str, body: DatasetVersionCreate):
    svc = get_service("datasets")
    v = svc.create_version(dataset_id, body.version, body.uri, body.metadata)
    return DatasetVersionOut(**{k: getattr(v, k) for k in DatasetVersionOut.model_fields})


# --- Splits -------------------------------------------------------------------

@router.get("/{dataset_id}/splits", response_model=list[DataSplitOut])
async def list_splits(dataset_id: str):
    svc = get_service("datasets")
    return [DataSplitOut(**{k: getattr(s, k) for k in DataSplitOut.model_fields})
            for s in svc.list_splits(dataset_id)]


@router.post("/{dataset_id}/splits", response_model=DataSplitOut, status_code=201)
async def create_split(dataset_id: str, body: DataSplitCreate):
    svc = get_service("datasets")
    s = svc.create_split(dataset_id, body.name, body.method, body.params)
    return DataSplitOut(**{k: getattr(s, k) for k in DataSplitOut.model_fields})
