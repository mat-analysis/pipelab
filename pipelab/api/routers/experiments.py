# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Experiments API router — experiments, runs, compare."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

from pipelab.api.app import get_service
from pipelab.api.schemas import (
    ExperimentCreate, ExperimentOut,
    RunOut, CompareRequest,
)

router = APIRouter()


@router.get("/", response_model=list[ExperimentOut])
async def list_experiments(project_id: str | None = None):
    svc = get_service("experiments")
    return [ExperimentOut(**{k: getattr(e, k) for k in ExperimentOut.model_fields})
            for e in svc.list_experiments(project_id)]


@router.get("/{name}", response_model=ExperimentOut)
async def get_experiment(name: str):
    svc = get_service("experiments")
    e = svc.get_experiment(name)
    if e is None:
        raise HTTPException(404, "Experiment not found")
    return ExperimentOut(**{k: getattr(e, k) for k in ExperimentOut.model_fields})


@router.post("/", response_model=ExperimentOut, status_code=201)
async def create_experiment(body: ExperimentCreate):
    svc = get_service("experiments")
    e = svc.create_experiment(body.name, body.project_id, body.description)
    return ExperimentOut(**{k: getattr(e, k) for k in ExperimentOut.model_fields})


@router.delete("/{name}")
async def delete_experiment(name: str):
    svc = get_service("experiments")
    if not svc.delete_experiment(name):
        raise HTTPException(404, "Experiment not found")
    return {"ok": True}


# --- Runs ---------------------------------------------------------------------

@router.get("/{name}/runs", response_model=list[RunOut])
async def list_runs(name: str):
    svc = get_service("experiments")
    return [RunOut(**{k: getattr(r, k) for k in RunOut.model_fields})
            for r in svc.list_runs(name)]


@router.get("/runs/{run_id}", response_model=RunOut)
async def get_run(run_id: str):
    svc = get_service("experiments")
    r = svc.get_run(run_id)
    if r is None:
        raise HTTPException(404, "Run not found")
    return RunOut(**{k: getattr(r, k) for k in RunOut.model_fields})


@router.get("/runs/{run_id}/artifacts")
async def get_run_artifacts(run_id: str) -> list[dict[str, Any]]:
    svc = get_service("experiments")
    return svc.get_run_artifacts(run_id)


@router.post("/runs/compare", response_model=list[RunOut])
async def compare_runs(body: CompareRequest):
    svc = get_service("experiments")
    return [RunOut(**{k: getattr(r, k) for k in RunOut.model_fields})
            for r in svc.compare_runs(body.run_ids)]


# --- Benchmark ----------------------------------------------------------------

class BenchmarkRequest(BaseModel):
    experiment_names: list[str]


@router.post("/benchmark")
async def benchmark_models(body: BenchmarkRequest) -> list[dict[str, Any]]:
    """
    Aggregate runs from the given experiments, group by model name
    (derived from mlflow.runName tag or run name), and compute
    mean / std of every metric across the runs of each model group.
    Returns a list of model summaries for comparison.
    """
    from statistics import mean, stdev

    svc = get_service("experiments")
    # Collect all runs across selected experiments
    all_runs = []
    for exp_name in body.experiment_names:
        runs = svc.list_runs(exp_name)
        all_runs.extend(runs)

    # Group runs by model name (strip k-fold suffixes like _fold_0, _k0, etc.)
    import re
    def _model_group_name(run_name: str) -> str:
        """Strip trailing fold/k-fold index patterns to group CV runs."""
        # Patterns: _fold_0, _fold0, _k0, _k_0, _cv0, _cv_0, _split_0
        cleaned = re.sub(r'[_\-](fold|k|cv|split)[_\-]?\d+$', '', run_name, flags=re.IGNORECASE)
        return cleaned if cleaned else run_name

    model_groups: dict[str, list] = {}
    for r in all_runs:
        raw_name = r.name or r.tags.get("mlflow.runName") or r.run_id[:8]
        model_name = _model_group_name(raw_name)
        model_groups.setdefault(model_name, []).append(r)

    results = []
    for model_name, runs in model_groups.items():
        # Collect all metric keys
        all_metric_keys = set()
        for r in runs:
            all_metric_keys.update(r.metrics.keys())

        # Compute mean/std for each metric
        metric_summary = {}
        for key in sorted(all_metric_keys):
            values = [r.metrics[key] for r in runs if key in r.metrics]
            if values:
                m = mean(values)
                s = stdev(values) if len(values) > 1 else 0.0
                metric_summary[key] = {
                    "mean": round(m, 6),
                    "std": round(s, 6),
                    "values": [round(v, 6) for v in values],
                    "count": len(values),
                }

        # Parameters (take from first run as representative)
        first_run = runs[0]
        params = dict(first_run.parameters)

        # Collect run IDs
        run_ids = [r.run_id for r in runs]

        # Get experiment name from first run
        experiment_name = first_run.experiment_name

        results.append({
            "model_name": model_name,
            "experiment_name": experiment_name,
            "run_count": len(runs),
            "run_ids": run_ids,
            "metrics": metric_summary,
            "parameters": params,
            "tags": dict(first_run.tags),
            "model_uri": first_run.model_uri,
            "status": first_run.status,
        })

    return results
