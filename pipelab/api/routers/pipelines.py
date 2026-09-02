# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Pipelines API router — discovered services and pipeline execution."""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from pipelab.api.app import (
    get_projects, get_project, get_discovered_services, refresh_discovery,
)
from pipelab.api.schemas import DiscoveredServiceOut, PipelineRunResult, PipelineStepResultOut
from pipelab.discovery import instantiate_service, save_project_config, load_project_config
from pipelab.pipeline import PipelineContext
from pipelab.pipelines.engine import PipelineEngine

router = APIRouter()


@router.get("/services", response_model=list[DiscoveredServiceOut])
async def list_discovered_services(project: str | None = None):
    """List all autodiscovered pipeline services, optionally filtered by project."""
    def _enrich(s, proj):
        meta = proj.services.get(s.class_name, {}) if proj else {}
        return DiscoveredServiceOut(
            class_name=s.class_name,
            module_path=s.module_path,
            step_type=s.step_type,
            docstring=s.docstring,
            project_name=s.project_name,
            label=meta.get("label", ""),
            description=meta.get("description", s.docstring),
            experiments=meta.get("experiments", []),
        )

    if project:
        proj = get_project(project)
        return [_enrich(s, proj) for s in get_discovered_services(project)]
    result = []
    for p in get_projects():
        for s in get_discovered_services(p.name):
            result.append(_enrich(s, p))
    return result


class PipelineRunRequest(BaseModel):
    project_name: str
    data_services: list[str] = []
    experiment_services: list[str] = []
    deploy_services: list[str] = []
    dataset_config_name: str | None = None  # name from YAML datasets[]


@router.post("/run", response_model=PipelineRunResult)
async def run_pipeline(body: PipelineRunRequest):
    """Execute a pipeline with the specified services."""
    proj = get_project(body.project_name)
    if proj is None:
        raise HTTPException(404, f"Project '{body.project_name}' not found")

    # Instantiate services
    try:
        data_svcs = [instantiate_service(proj, name) for name in body.data_services]
        exp_svcs = [instantiate_service(proj, name) for name in body.experiment_services]
        dep_svcs = [instantiate_service(proj, name) for name in body.deploy_services]
    except ValueError as exc:
        raise HTTPException(404, str(exc))

    # Look up dataset config from YAML if provided
    dataset_config = None
    if body.dataset_config_name:
        for ds in proj.datasets:
            if ds.get("name") == body.dataset_config_name:
                dataset_config = ds
                break
        if dataset_config is None:
            raise HTTPException(404, f"Dataset config '{body.dataset_config_name}' not found")

    # Build context
    ctx = PipelineContext(
        project_name=proj.name,
        project_path=proj.path,
        config={
            "name": proj.name,
            "description": proj.description,
            "tracking_uri": proj.tracking_uri,
        },
    )

    # Execute
    engine = PipelineEngine(
        data_services=data_svcs,
        experiment_services=exp_svcs,
        deploy_services=dep_svcs,
        dataset_config=dataset_config,
    )
    results = engine.run(ctx)

    overall_status = "completed"
    for r in results:
        if r.status == "failed":
            overall_status = "failed"
            break

    # ── Associate new experiment(s) with the project YAML ─────────────
    created_experiment_names: list[str] = []
    if overall_status == "completed" and ctx.experiment_name:
        from pathlib import Path
        import re

        yaml_path = Path(proj.path) / "pipelab.yaml"
        fresh_proj = load_project_config(yaml_path)
        existing_names = {e.get("name") for e in fresh_proj.experiments}

        dataset_label = (dataset_config or {}).get("name", "dataset")

        # Extract timestamp from ctx.experiment_name (last generated)
        timestamp_pattern = r"\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}"
        match = re.match(timestamp_pattern, ctx.experiment_name)
        ts = match.group(0) if match else ctx.experiment_name.split("_")[0]

        for svc_name in body.experiment_services:
            step_ok = any(
                r.class_name == svc_name and r.step_type == "experiment" and r.status == "success"
                for r in results
            )
            if not step_ok:
                continue

            exp_name = f"{ts}_{dataset_label}_{svc_name}"

            if exp_name not in existing_names:
                fresh_proj.experiments.append({
                    "name": exp_name,
                    "description": f"Pipeline: {dataset_label} + {svc_name}",
                })
                existing_names.add(exp_name)
                created_experiment_names.append(exp_name)

        # Also associate experiment names with the Experiment Provider service metadata
        for svc_name in body.experiment_services:
            svc_meta = fresh_proj.services.get(svc_name, {})
            existing_exps = svc_meta.get("experiments", [])
            for exp_name in created_experiment_names:
                if exp_name not in existing_exps:
                    existing_exps.append(exp_name)
            svc_meta["experiments"] = existing_exps
            fresh_proj.services[svc_name] = svc_meta

        if created_experiment_names:
            save_project_config(fresh_proj)
            refresh_discovery()

    return PipelineRunResult(
        project_name=proj.name,
        status=overall_status,
        experiment_names=created_experiment_names,
        steps=[
            PipelineStepResultOut(
                step_name=r.step_name,
                step_type=r.step_type,
                class_name=r.class_name,
                status=r.status,
                duration_seconds=r.duration_seconds,
                error=r.error,
            )
            for r in results
        ],
    )


class RegisterServiceMeta(BaseModel):
    """Register metadata for a service in the project YAML."""
    project_name: str
    service_type: str  # 'datasets' | 'experiments' | 'deployments'
    metadata: dict[str, Any]


@router.post("/register-meta")
async def register_service_metadata(body: RegisterServiceMeta):
    """Add metadata to a project's pipelab.yaml for a service."""
    proj = get_project(body.project_name)
    if proj is None:
        raise HTTPException(404, f"Project '{body.project_name}' not found")

    if body.service_type == "datasets":
        proj.datasets.append(body.metadata)
    elif body.service_type == "experiments":
        proj.experiments.append(body.metadata)
    elif body.service_type == "deployments":
        proj.deployments.append(body.metadata)
    else:
        raise HTTPException(400, f"Invalid service_type: {body.service_type}")

    save_project_config(proj)
    return {"ok": True, "message": f"Registered {body.service_type} metadata"}


@router.post("/refresh")
async def refresh():
    """Re-scan the workdir for projects and services."""
    refresh_discovery()
    return {"ok": True, "projects": len(get_projects())}


class UpdateServiceMetaRequest(BaseModel):
    project_name: str
    class_name: str
    label: str = ""
    description: str = ""
    experiments: list[str] | None = None  # associated MLflow experiment names


@router.put("/services/meta")
async def update_service_meta(body: UpdateServiceMetaRequest):
    """Update metadata for a specific service in the project YAML."""
    from pipelab.api.app import run_discovery
    proj = get_project(body.project_name)
    if proj is None:
        raise HTTPException(404, f"Project '{body.project_name}' not found")
    existing = proj.services.get(body.class_name, {})
    existing["label"] = body.label
    existing["description"] = body.description
    if body.experiments is not None:
        existing["experiments"] = body.experiments
    proj.services[body.class_name] = existing
    save_project_config(proj)
    run_discovery()
    return {"ok": True}


class DatasetConfigCreate(BaseModel):
    project_name: str
    name: str
    description: str = ""
    data_service: str  # DatasetService class name
    preparation_method: str  # PreparationService class name or built-in
    preparation_params: dict[str, Any] = {}


@router.post("/dataset-configs")
async def create_dataset_config(body: DatasetConfigCreate):
    """Save a dataset configuration to the project YAML."""
    from pipelab.api.app import run_discovery
    proj = get_project(body.project_name)
    if proj is None:
        raise HTTPException(404, f"Project '{body.project_name}' not found")
    config = {
        "name": body.name,
        "description": body.description,
        "data_service": body.data_service,
        "preparation_method": body.preparation_method,
        "preparation_params": body.preparation_params,
    }
    proj.datasets.append(config)
    save_project_config(proj)
    run_discovery()
    return {"ok": True, "config": config}


@router.get("/dataset-configs")
async def list_dataset_configs(project: str | None = None):
    """List dataset configurations from project YAML."""
    if not project:
        raise HTTPException(400, "project query param required")
    proj = get_project(project)
    if proj is None:
        raise HTTPException(404, f"Project '{project}' not found")
    return proj.datasets


@router.delete("/dataset-configs/{index}")
async def delete_dataset_config(index: int, project: str | None = None):
    """Delete a dataset config by index from the project YAML."""
    from pipelab.api.app import run_discovery
    if not project:
        raise HTTPException(400, "project query param required")
    proj = get_project(project)
    if proj is None:
        raise HTTPException(404, f"Project '{project}' not found")
    if index < 0 or index >= len(proj.datasets):
        raise HTTPException(404, "Dataset config index out of range")
    removed = proj.datasets.pop(index)
    save_project_config(proj)
    run_discovery()
    return {"ok": True, "removed": removed}


class EdaLoadRequest(BaseModel):
    project_name: str
    data_service: str  # DatasetService class name


@router.post("/eda/load")
async def eda_load_dataset(body: EdaLoadRequest):
    """Execute a DatasetService and return EDA data (head, shape, dtypes, describe, scatter)."""
    import numpy as np
    import pandas as pd

    proj = get_project(body.project_name)
    if proj is None:
        raise HTTPException(404, f"Project '{body.project_name}' not found")

    try:
        svc = instantiate_service(proj, body.data_service)
    except ValueError as e:
        raise HTTPException(404, str(e))

    # Execute service to load data
    ctx = PipelineContext(config={}, project_path=proj.path)
    try:
        svc.execute(ctx)
    except Exception as exc:
        raise HTTPException(500, f"Failed to execute {body.data_service}: {exc}")

    # Build DataFrame from context.results
    X = ctx.results.get("X")
    y = ctx.results.get("y")
    if X is None:
        raise HTTPException(400, "DatasetService did not produce 'X' in context.results")

    if isinstance(X, np.ndarray):
        cols = [f"feature_{i}" for i in range(X.shape[1])]
        df = pd.DataFrame(X, columns=cols)
    elif isinstance(X, pd.DataFrame):
        df = X
    else:
        raise HTTPException(400, f"Unsupported X type: {type(X).__name__}")

    if y is not None:
        if isinstance(y, (np.ndarray, list)):
            df["target"] = y
        elif isinstance(y, pd.Series):
            df["target"] = y.values

    # Head (first 10 rows)
    head = df.head(10).to_dict(orient="records")

    # Shape
    shape = {"rows": int(df.shape[0]), "columns": int(df.shape[1])}

    # Dtypes
    dtypes = {col: str(dt) for col, dt in df.dtypes.items()}

    # Describe (statistics)
    describe = df.describe().round(4).to_dict()

    # Pairwise scatter data (numeric columns only, sample if large)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    sample_df = df.sample(min(200, len(df)), random_state=42) if len(df) > 200 else df
    scatter_pairs = []
    # Limit to first 6 numeric columns to avoid too much data
    limited_cols = numeric_cols[:6]
    for i, c1 in enumerate(limited_cols):
        for c2 in limited_cols[i + 1:]:
            scatter_pairs.append({
                "x_col": c1,
                "y_col": c2,
                "x": sample_df[c1].tolist(),
                "y": sample_df[c2].tolist(),
                "color": sample_df["target"].tolist() if "target" in sample_df.columns else None,
            })

    columns = df.columns.tolist()

    return {
        "head": head,
        "shape": shape,
        "columns": columns,
        "dtypes": dtypes,
        "describe": describe,
        "scatter_pairs": scatter_pairs,
    }


