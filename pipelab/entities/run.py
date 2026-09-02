# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Run:
    run_id: str
    experiment_name: str
    name: str | None = None
    description: str | None = None
    timestamp: float | None = None
    seed: int | None = None
    status: str = "running"          # 'running' | 'finished' | 'failed'
    parameters: dict[str, Any] = field(default_factory=dict)
    metrics: dict[str, float] = field(default_factory=dict)
    tags: dict[str, str] = field(default_factory=dict)
    artifacts: list[str] = field(default_factory=list)
    model_uri: str | None = None
    data_split_name: str | None = None
    logs: list[str] = field(default_factory=list)
