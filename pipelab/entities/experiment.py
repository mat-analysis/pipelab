# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Experiment:
    name: str
    experiment_id: str | None = None
    description: str | None = None
    project_id: str | None = None
    metrics: list[str] = field(default_factory=list)
