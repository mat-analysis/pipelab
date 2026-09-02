# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class PipelineStepResult:
    step_name: str
    step_type: str  # 'data' | 'experiment' | 'deployment'
    class_name: str
    status: str = "pending"          # 'pending' | 'running' | 'success' | 'failed'
    duration_seconds: float | None = None
    output: dict[str, Any] | None = None
    error: str | None = None


@dataclass(frozen=True)
class Pipeline:
    id: str
    name: str
    project_id: str | None = None
    description: str | None = None
    steps: list[str] = field(default_factory=list)   # ordered step names
    created_at: float | None = None
    updated_at: float | None = None
    status: str = "idle"             # 'idle' | 'running' | 'completed' | 'failed'
    step_results: list[PipelineStepResult] = field(default_factory=list)
