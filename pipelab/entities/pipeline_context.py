# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pipelab.entities.data_context import DataContext


@dataclass
class PipelineContext:
    """Execution context passed to every pipeline service.

    Attributes:
        project_name: Name of the project from ``pipelab.yaml``.
        project_path: Absolute path to the project directory.
        config: Parsed contents of ``pipelab.yaml``.
        results: Accumulated results from previously executed steps.
        data: Prepared data context (populated by engine after data + preparation).
    """
    project_name: str = ""
    project_path: str = ""
    config: dict[str, Any] = field(default_factory=dict)
    results: dict[str, Any] = field(default_factory=dict)
    data: DataContext = field(default_factory=DataContext)

    # Generated experiment name (populated by the engine during pipeline execution)
    experiment_name: str = ""

    # Convenience references to service instances (populated by the engine)
    dataset: Any = None
    experiment: Any = None
    deploy: Any = None
