# Copyright (c) 2026 Tarlis Portela <tarlis@tarlis.com.br>
# Licensed under the Apache License, Version 2.0.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ModelRegistry:
    model_name: str
    version: int | str
    source: str | None = None
    run_id: str | None = None
    status: str = "candidate"       # 'candidate' | 'approved' | 'production' | 'archived'
    description: str | None = None
    created_at: float | None = None
    updated_at: float | None = None
    tags: dict[str, str] = field(default_factory=dict)
