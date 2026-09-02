# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ProjectConfig:
    """Parsed project configuration from ``pipelab.yaml``."""
    name: str
    path: str  # absolute path to the project directory
    description: str = ""
    tracking_uri: str = "mlruns"
    pipeline_dir: str = "pipeline"
    datasets: list[dict[str, Any]] = field(default_factory=list)
    experiments: list[dict[str, Any]] = field(default_factory=list)
    deployments: list[dict[str, Any]] = field(default_factory=list)
    services: dict[str, dict[str, Any]] = field(default_factory=dict)  # class_name -> metadata
    extra: dict[str, Any] = field(default_factory=dict)
