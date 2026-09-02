# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

"""Pipeline execution engine.

Works with the 3 pipeline ABCs: DatasetService, ExperimentService, DeployService.
Builds a PipelineContext and executes steps in order: data → experiment → deploy.

When a ``dataset_config`` is provided the engine automatically runs:
    1. The DatasetService (loads X / y)
    2. The PreparationService indicated by the config (creates folds or splits)
    3. Populates ``context.data`` so ExperimentServices can consume it uniformly.
"""
from __future__ import annotations

import time
from datetime import datetime
from typing import Any

from pipelab.pipeline import (
    PipelineContext, DataContext,
    DatasetService, ExperimentService, DeployService,
    PreparationService,
    TrainTestSplit, KFoldCV,
)
from pipelab.entities.pipeline import PipelineStepResult


# Map of built-in preparation method names → classes
_PREP_REGISTRY: dict[str, type[PreparationService]] = {
    "TrainTestSplit": TrainTestSplit,
    "KFoldCV": KFoldCV,
}


class PipelineEngine:
    """Execute a pipeline composed of DatasetService, ExperimentService,
    and DeployService instances.
    """

    def __init__(
        self,
        data_services: list[DatasetService] | None = None,
        experiment_services: list[ExperimentService] | None = None,
        deploy_services: list[DeployService] | None = None,
        dataset_config: dict[str, Any] | None = None,
    ) -> None:
        self.data_services = data_services or []
        self.experiment_services = experiment_services or []
        self.deploy_services = deploy_services or []
        self.dataset_config = dataset_config  # from YAML datasets[]

    def run(self, context: PipelineContext) -> list[PipelineStepResult]:
        """Execute all steps sequentially: data → (preparation) → experiment → deploy.

        If ``dataset_config`` is set, populates ``context.data`` automatically.
        Returns the list of step results.
        """
        # Wire up convenience references
        if self.data_services:
            context.dataset = self.data_services[0]
        if self.experiment_services:
            context.experiment = self.experiment_services[0]
        if self.deploy_services:
            context.deploy = self.deploy_services[0]

        results: list[PipelineStepResult] = []

        # ── 1. Execute data services ──────────────────────────────────────
        for svc in self.data_services:
            r = self._run_step(svc, context)
            results.append(r)
            if r.status == "failed":
                return results

        # ── 2. Run preparation if dataset_config is set ───────────────────
        dataset_label = (self.dataset_config or {}).get("name", "dataset")
        if self.dataset_config:
            method_name = self.dataset_config.get("preparation_method", "")
            prep_params = self.dataset_config.get("preparation_params", {})
            prep_cls = _PREP_REGISTRY.get(method_name)
            if prep_cls:
                prep_svc = prep_cls()
                # Store params so the prep service can find them
                context.config["preparation_params"] = prep_params
                r = self._run_step(prep_svc, context)
                results.append(r)
                if r.status == "failed":
                    return results

            # ── Populate context.data ─────────────────────────────────────
            dc = DataContext(
                X=context.results.get("X"),
                y=context.results.get("y"),
                method=method_name,
                method_params=prep_params,
                dataset_name=dataset_label,
            )

            if method_name == "KFoldCV":
                dc.folds = context.results.get("folds")
            elif method_name == "TrainTestSplit":
                dc.X_train = context.results.get("X_train")
                dc.X_test = context.results.get("X_test")
                dc.y_train = context.results.get("y_train")
                dc.y_test = context.results.get("y_test")

            context.data = dc

        # ── 3. Execute experiment services ────────────────────────────────
        # Generate a unique experiment name from the pipeline composition
        timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")

        for svc in self.experiment_services:
            context.experiment_name = f"{timestamp}_{dataset_label}_{svc.name}"
            r = self._run_step(svc, context)
            results.append(r)
            if r.status == "failed":
                return results

        # ── 4. Execute deploy services ────────────────────────────────────
        for svc in self.deploy_services:
            r = self._run_step(svc, context)
            results.append(r)
            if r.status == "failed":
                return results

        return results

    @staticmethod
    def _run_step(svc, context: PipelineContext) -> PipelineStepResult:
        start = time.time()
        try:
            output = svc.execute(context)
            duration = time.time() - start
            context.results[svc.name] = output
            return PipelineStepResult(
                step_name=svc.name,
                step_type=svc.step_type,
                class_name=svc.__class__.__name__,
                status="success",
                duration_seconds=round(duration, 3),
                output={"result": str(output)} if output else None,
            )
        except Exception as exc:
            duration = time.time() - start
            return PipelineStepResult(
                step_name=svc.name,
                step_type=svc.step_type,
                class_name=svc.__class__.__name__,
                status="failed",
                duration_seconds=round(duration, 3),
                error=str(exc),
            )
